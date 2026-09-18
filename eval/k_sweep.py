"""k-refinement convergence study for CORA's Graph-RAG retrieval.

This is the experiment described in the NUTHOS-15 paper (Section 3.1): we treat the
retrieval depth `k` the way a computational physics study treats mesh density, and
sweep it to see whether the system's answers converge.

For each held-out question we ask CORA the same question at every value of k, holding
everything else fixed (model, temperature, wording, score threshold). Then we measure:

  - selection accuracy : did it pick the right multiple-choice letter?
  - recall@k           : did the chunk that actually contains the answer get retrieved?
  - MRR                : how high up the retrieved list did that chunk appear?

Recall@k and MRR need a labelled `gold_source` on the question. Questions without one
still contribute to selection accuracy; the other two metrics just skip them.

Run it from the repo root:

    python eval/k_sweep.py --questions eval/questions.json

Results land in eval/results/ as both JSON (for the presentation to inline) and CSV
(for a quick look in a spreadsheet). Every answer is cached, so if the run dies
halfway through -- rate limit, dropped wifi -- rerunning picks up where it left off
instead of paying for the same LLM calls twice.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

# The backend package expects to be imported from inside backend/, so put it on the
# path before importing anything from it.
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402

# Load the backend's .env exactly the way the backend does. We never read, print or
# log the values themselves -- they include live Neo4j and LLM credentials.
load_dotenv(BACKEND / ".env")

from langchain_neo4j import Neo4jGraph  # noqa: E402

from src.QA_integration import (  # noqa: E402
    create_retriever,
    get_chat_mode_settings,
    initialize_neo4j_vector,
)
from src.llm import get_llm  # noqa: E402

# The paper's sweep. Dense at the low end where the curve actually moves, sparse at
# the top where we only need to show it has gone flat.
DEFAULT_K_VALUES = [1, 2, 3, 5, 8, 10, 15, 20]

# `graph_vector` is the Graph-RAG path (vector seed + graph traversal) AND it honours
# the document filter, which is how we hold documents out without re-ingesting the
# whole graph. `graph_vector_fulltext`, the app's default, ignores the filter.
DEFAULT_MODE = "graph_vector"

# Asking for one letter and nothing else keeps scoring unambiguous -- no LLM judge,
# no fuzzy string matching, no argument about whether an essay "counts as" correct.
ANSWER_PROMPT = """Answer the following multiple-choice question using ONLY the context provided.

Context:
{context}

Question: {question}

Options:
{options}

Respond with ONLY the single letter of the correct option (A, B, C or D).
If the context does not contain enough information to answer, respond with exactly: INSUFFICIENT
"""

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(message)s")
log = logging.getLogger("k_sweep")


@dataclass
class Question:
    """One held-out test question with a known correct answer."""

    id: str
    question: str
    options: dict[str, str]
    answer: str
    # Filename of the document that actually contains the answer, if known. Only
    # questions carrying this can contribute to recall@k and MRR.
    gold_source: str | None = None

    @staticmethod
    def from_dict(raw: dict, index: int) -> "Question":
        missing = [f for f in ("question", "options", "answer") if f not in raw]
        if missing:
            raise ValueError(f"question #{index} is missing required field(s): {', '.join(missing)}")

        options = {str(k).strip().upper(): str(v) for k, v in raw["options"].items()}
        answer = str(raw["answer"]).strip().upper()
        if answer not in options:
            raise ValueError(
                f"question #{index} has answer {answer!r}, which is not one of its options "
                f"({', '.join(sorted(options))})"
            )

        return Question(
            id=str(raw.get("id") or f"q{index:03d}"),
            question=str(raw["question"]).strip(),
            options=options,
            answer=answer,
            gold_source=raw.get("gold_source"),
        )


@dataclass
class Metrics:
    """Running tallies for a single value of k."""

    answered: int = 0
    correct: int = 0
    insufficient: int = 0
    # Only questions with a gold_source contribute to these two.
    scored_for_recall: int = 0
    recall_hits: int = 0
    reciprocal_ranks: list[float] = field(default_factory=list)

    @property
    def accuracy(self) -> float:
        return self.correct / self.answered if self.answered else 0.0

    @property
    def recall(self) -> float:
        return self.recall_hits / self.scored_for_recall if self.scored_for_recall else 0.0

    @property
    def mrr(self) -> float:
        return sum(self.reciprocal_ranks) / len(self.reciprocal_ranks) if self.reciprocal_ranks else 0.0


class AnswerCache:
    """Disk cache of LLM answers, keyed by (question, k, model).

    A full sweep is hundreds of LLM calls. Without this, one rate-limit error near the
    end means paying for the whole run again.
    """

    def __init__(self, path: Path):
        self.path = path
        self.entries: dict[str, dict] = {}
        if path.exists():
            try:
                self.entries = json.loads(path.read_text())
            except json.JSONDecodeError:
                log.warning("cache at %s was unreadable; starting fresh", path)
                self.entries = {}

    @staticmethod
    def key(question_id: str, k: int, model: str) -> str:
        raw = f"{question_id}|{k}|{model}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def get(self, question_id: str, k: int, model: str) -> dict | None:
        return self.entries.get(self.key(question_id, k, model))

    def put(self, question_id: str, k: int, model: str, value: dict) -> None:
        self.entries[self.key(question_id, k, model)] = value
        self.path.write_text(json.dumps(self.entries, indent=2))


def load_questions(path: Path) -> list[Question]:
    raw = json.loads(path.read_text())
    if not isinstance(raw, list):
        raise ValueError(f"{path} must contain a JSON array of question objects")
    questions = [Question.from_dict(item, i) for i, item in enumerate(raw)]
    if not questions:
        raise ValueError(f"{path} contains no questions")
    return questions


def resolve_document_names(graph: Neo4jGraph, exclude: list[str]) -> list[str] | None:
    """Return every document in the graph except the excluded ones.

    This is how we hold the answer keys out of retrieval without rebuilding the graph:
    the retriever is handed an explicit allow-list that simply omits them.

    Returns None when nothing is excluded, which tells the retriever not to filter.
    """
    if not exclude:
        return None

    rows = graph.query("MATCH (d:Document) RETURN d.fileName AS name")
    all_names = sorted({row["name"] for row in rows if row.get("name")})
    if not all_names:
        raise RuntimeError(
            "No :Document nodes found in the graph. Is the database populated, and is "
            "the backend .env pointing at the right one?"
        )

    excluded = {name for name in all_names if any(pattern in name for pattern in exclude)}
    if not excluded:
        log.warning("None of the --exclude patterns matched any document in the graph.")

    kept = [name for name in all_names if name not in excluded]
    if not kept:
        raise RuntimeError("Every document was excluded; nothing left to retrieve from.")

    print(f"  holding out {len(excluded)} document(s), retrieving from {len(kept)}")
    for name in sorted(excluded):
        print(f"    held out: {name}")
    return kept


def format_options(options: dict[str, str]) -> str:
    return "\n".join(f"{letter}. {text}" for letter, text in sorted(options.items()))


def parse_letter(response: str, valid: set[str]) -> str | None:
    """Pull a single option letter out of the model's reply.

    Returns None for INSUFFICIENT or anything unparseable -- both count as "not
    correct" but we track INSUFFICIENT separately, because a system that honestly
    declines at low k is behaving very differently from one that guesses wrong.
    """
    text = response.strip().upper()
    if "INSUFFICIENT" in text:
        return None
    match = re.search(r"\b([A-D])\b", text)
    if match and match.group(1) in valid:
        return match.group(1)
    return None


def score_retrieval(documents: list, gold_source: str) -> tuple[bool, float]:
    """Did the gold document show up, and how high in the list?

    Returns (hit, reciprocal_rank). Rank is 1-based over the retrieved order.
    """
    for rank, doc in enumerate(documents, start=1):
        source = (doc.metadata or {}).get("fileName", "")
        if gold_source in source:
            return True, 1.0 / rank
    return False, 0.0


def run_single(llm, retriever, question: Question) -> dict:
    """Retrieve at the current k, ask the model, and record what happened."""
    documents = retriever.invoke(question.question)
    context = "\n\n---\n\n".join(doc.page_content for doc in documents)

    prompt = ANSWER_PROMPT.format(
        context=context if context else "(no context retrieved)",
        question=question.question,
        options=format_options(question.options),
    )
    reply = llm.invoke(prompt)
    text = reply.content if hasattr(reply, "content") else str(reply)

    selected = parse_letter(text, set(question.options))

    result = {
        "selected": selected,
        "raw_response": text.strip()[:200],
        "retrieved_count": len(documents),
        "retrieved_sources": [(d.metadata or {}).get("fileName", "") for d in documents],
    }

    if question.gold_source:
        hit, rr = score_retrieval(documents, question.gold_source)
        result["recall_hit"] = hit
        result["reciprocal_rank"] = rr

    return result


def sweep(
    questions: list[Question],
    k_values: list[int],
    model: str,
    mode: str,
    exclude: list[str],
    cache_path: Path,
) -> dict:
    print(f"\nConnecting to Neo4j and loading the '{mode}' retrieval config...")
    graph = Neo4jGraph(
        url=os.environ["NEO4J_URI"],
        username=os.environ["NEO4J_USERNAME"],
        password=os.environ["NEO4J_PASSWORD"],
        database=os.environ.get("NEO4J_DATABASE", "neo4j"),
        sanitize=True,
        refresh_schema=False,
    )

    document_names = resolve_document_names(graph, exclude)
    chat_mode_settings = get_chat_mode_settings(mode=mode)
    neo_db = initialize_neo4j_vector(graph, chat_mode_settings)

    # temperature=0 so that re-running gives the same answer. Any variation we see
    # across the sweep should come from k, not from sampling noise.
    llm, _ = get_llm(model=model)
    if hasattr(llm, "temperature"):
        llm.temperature = 0

    cache = AnswerCache(cache_path)
    with_gold = sum(1 for q in questions if q.gold_source)

    print(f"\n{len(questions)} questions x {len(k_values)} values of k "
          f"= {len(questions) * len(k_values)} evaluations")
    print(f"{with_gold} question(s) carry a gold_source, so recall@k and MRR "
          f"are computed over those.\n")

    per_k: dict[int, Metrics] = {}
    detail_rows: list[dict] = []

    for k in k_values:
        metrics = Metrics()
        retriever = create_retriever(
            neo_db=neo_db,
            document_names=document_names,
            chat_mode_settings=chat_mode_settings,
            search_k=k,
            score_threshold=0.0,  # let k alone control how much comes back
            ef_ratio=int(os.environ.get("EFFECTIVE_SEARCH_RATIO", 5)),
        )

        print(f"k = {k:>2} ", end="", flush=True)
        for question in questions:
            cached = cache.get(question.id, k, model)
            if cached is None:
                try:
                    cached = run_single(llm, retriever, question)
                except Exception as exc:  # noqa: BLE001 - one bad question must not kill the sweep
                    log.warning("question %s at k=%s failed: %s", question.id, k, exc)
                    print("!", end="", flush=True)
                    continue
                cache.put(question.id, k, model, cached)
                time.sleep(0.2)  # be polite to the API
                print(".", end="", flush=True)
            else:
                print("c", end="", flush=True)

            metrics.answered += 1
            if cached["selected"] is None:
                metrics.insufficient += 1
            elif cached["selected"] == question.answer:
                metrics.correct += 1

            if question.gold_source and "recall_hit" in cached:
                metrics.scored_for_recall += 1
                if cached["recall_hit"]:
                    metrics.recall_hits += 1
                metrics.reciprocal_ranks.append(cached["reciprocal_rank"])

            detail_rows.append({
                "k": k,
                "question_id": question.id,
                "expected": question.answer,
                "selected": cached["selected"] or "INSUFFICIENT",
                "correct": cached["selected"] == question.answer,
                "retrieved_count": cached["retrieved_count"],
                "recall_hit": cached.get("recall_hit", ""),
                "reciprocal_rank": cached.get("reciprocal_rank", ""),
            })

        per_k[k] = metrics
        print(f"  accuracy {metrics.accuracy:.1%}"
              f"  recall@k {metrics.recall:.1%}"
              f"  MRR {metrics.mrr:.3f}"
              f"  (declined {metrics.insufficient})")

    return {
        "config": {
            "model": model,
            "mode": mode,
            "k_values": k_values,
            "question_count": len(questions),
            "questions_with_gold_source": with_gold,
            "excluded_documents": exclude,
            "temperature": 0,
        },
        "curve": [
            {
                "k": k,
                "accuracy": round(m.accuracy, 4),
                "recall_at_k": round(m.recall, 4),
                "mrr": round(m.mrr, 4),
                "answered": m.answered,
                "correct": m.correct,
                "insufficient": m.insufficient,
            }
            for k, m in sorted(per_k.items())
        ],
        "detail": detail_rows,
    }


def write_outputs(results: dict, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "k_sweep.json"
    json_path.write_text(json.dumps(results, indent=2))

    csv_path = out_dir / "k_sweep.csv"
    with csv_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(results["curve"][0]))
        writer.writeheader()
        writer.writerows(results["curve"])

    print(f"\nWrote {json_path}")
    print(f"Wrote {csv_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--questions", type=Path, default=REPO_ROOT / "eval" / "questions.json",
                        help="JSON array of held-out questions (see questions.example.json)")
    parser.add_argument("--model", default="openai_gpt_4o",
                        help="LLM key as named in the backend's .env (e.g. openai_gpt_4o, anthropic_claude_4_sonnet)")
    parser.add_argument("--mode", default=DEFAULT_MODE,
                        help=f"retrieval mode (default: {DEFAULT_MODE}, the Graph-RAG path that honours document filters)")
    parser.add_argument("--k", type=int, nargs="+", default=DEFAULT_K_VALUES,
                        help="k values to sweep")
    parser.add_argument("--exclude", nargs="*", default=[],
                        help="substrings of filenames to hold out of retrieval, e.g. --exclude Key KEY")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "eval" / "results",
                        help="directory for k_sweep.json and k_sweep.csv")
    args = parser.parse_args()

    if not args.questions.exists():
        parser.error(
            f"{args.questions} not found. Copy eval/questions.example.json to "
            f"eval/questions.json and fill it in."
        )

    questions = load_questions(args.questions)
    results = sweep(
        questions=questions,
        k_values=sorted(args.k),
        model=args.model,
        mode=args.mode,
        exclude=args.exclude,
        cache_path=args.out / ".answer_cache.json",
    )
    write_outputs(results, args.out)


if __name__ == "__main__":
    main()
