# CORA evaluation — k-refinement convergence study

This runs the experiment described in Section 3.1 of the NUTHOS-15 paper: sweep the
retrieval depth `k` the way a computational physics study sweeps mesh density, and see
whether CORA's answers converge.

Output is `results/k_sweep.json`, shaped so the NUTHOS presentation can inline it
directly — the convergence curve in the talk is then the real measured curve, not a
drawing of one.

## Before you run: the leakage problem

The graph currently contains the NE 235 answer keys (`2025_HW3 KEY.pdf`,
`2025 Quiz#2 - Key.pdf`, and friends). If you build questions out of those homeworks and
leave the keys in the graph, retrieval will find the key, the model will read the answer
straight off it, and accuracy will be ~100% at every value of `k`. The curve will be
flat, and it will be meaningless.

Two ways to avoid that, both supported:

**Option A — hold the keys out at retrieval time (no re-ingest).** Pass `--exclude`, and
the retriever is handed an allow-list of every document *except* the ones matching:

```bash
python eval/k_sweep.py --questions eval/questions.json --exclude Key KEY
```

This is why the default mode is `graph_vector` rather than the app's usual
`graph_vector_fulltext` — only the former honours the document filter.

**Option B — use NRC GFE questions.** The GFE bank is public and is *not* currently in
your graph, so those questions are held out by construction. You lose `recall@k` and
`MRR` for them (there is no gold chunk to find), but selection accuracy still works, and
it tests something genuinely interesting: can the PULSTAR/NE 235 corpus answer general
fundamentals questions?

The realistic answer is to do both — a mixed question set gives you the full metric
suite from the NE 235 half and the harder generalization signal from the GFE half.

## Building the question set

Copy the example and fill it in:

```bash
cp eval/questions.example.json eval/questions.json
```

Each entry needs `question`, `options` (A–D), and `answer`. `id` is generated if you
omit it. `gold_source` is optional — it's the filename of the document that actually
contains the answer, and it's what makes `recall@k` and `MRR` computable. Questions
without it still count toward selection accuracy.

Aim for **25–40 questions**. Below about 20, a single question flipping moves accuracy
by 5 percentage points and the curve looks like noise. GFE questions are already
multiple choice, which is why the harness uses MCQ throughout — scoring is a letter
comparison, with no LLM judge and nothing to argue about in Q&A.

## Running it

```bash
cd "/Users/masonmines/VSCode Projects/CORA-test"
source backend/venv/bin/activate
python eval/k_sweep.py --questions eval/questions.json --exclude Key KEY
```

Useful flags:

| Flag | Default | Notes |
| --- | --- | --- |
| `--k` | `1 2 3 5 8 10 15 20` | the paper's sweep; dense low, sparse high |
| `--model` | `openai_gpt_4o` | must match a model key configured in `backend/.env` |
| `--mode` | `graph_vector` | the Graph-RAG path that respects `--exclude` |
| `--exclude` | none | filename substrings to hold out of retrieval |

Credentials come from `backend/.env` the same way the backend loads them. The script
never prints or logs their values.

## Cost and time

One LLM call per (question × k). At 30 questions and 8 k-values that's 240 calls —
single-digit dollars on GPT-4o, less on a smaller model, and roughly 10–15 minutes
wall clock with the built-in pacing.

Every answer is cached in `results/.answer_cache.json`, keyed by question, k, and model.
If a run dies partway through, rerun the same command — it resumes instead of paying
again. Delete that file to force a clean re-run.

## Reading the result

You're looking for accuracy that rises with `k` and then goes flat. The `k` where it
flattens is the analogue of grid independence, and it's the number you quote in the
talk: *"beyond k = N, retrieval depth stops mattering."*

Watch the `declined` count too. A system that returns INSUFFICIENT at k=1 and answers
correctly at k=8 is behaving honestly — that's a different and better story than one
that confidently guesses wrong at low k, and it's worth a sentence on the slide.

If the curve is flat from k=1, suspect leakage before you celebrate.

## Next: prompt perturbation

The paper's second study fixes `k` at whatever this sweep says is converged, then varies
the *wording* — synonyms, reordering, filler, punctuation, typos, acronym expansion —
and measures agreement against the baseline answer. That harness isn't written yet
because it needs this sweep's converged `k` as its input. Run this one first.
