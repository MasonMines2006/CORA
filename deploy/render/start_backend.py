"""Translate Render service URLs into CORA's existing environment variables."""

import os
import shlex
from urllib.parse import unquote, urlparse


def configure_postgres() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    parsed = urlparse(database_url)
    if not all((parsed.hostname, parsed.path, parsed.username, parsed.password)):
        raise RuntimeError("DATABASE_URL is incomplete")

    os.environ["POSTGRES_HOST"] = parsed.hostname
    os.environ["POSTGRES_PORT"] = str(parsed.port or 5432)
    os.environ["POSTGRES_DB"] = parsed.path.lstrip("/")
    os.environ["POSTGRES_USER"] = unquote(parsed.username)
    os.environ["POSTGRES_PASSWORD"] = unquote(parsed.password)


def configure_neo4j() -> None:
    neo4j_host = os.environ.get("NEO4J_HOST")
    if not neo4j_host:
        raise RuntimeError("NEO4J_HOST is required")
    os.environ["NEO4J_URI"] = f"bolt://{neo4j_host}:7687"


def model_key_for(model: str) -> str:
    """The key CORA uses for an OpenAI model, e.g. "gpt-4.1-mini" -> "openai_gpt_4_1_mini".

    backend/src/llm.py finds a model's settings by upper-casing its key and turning
    "." into "_" (and nothing else). So the key must not contain "-": an env name
    like LLM_MODEL_CONFIG_OPENAI_GPT-4_1_MINI can never be set.
    """
    return f"openai_{model}".lower().replace("-", "_").replace(".", "_")


def configure_openai() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required")

    model_key = model_key_for(model)
    # The settings line get_llm() reads: "<model name>,<api key>".
    os.environ[f"LLM_MODEL_CONFIG_{model_key.upper()}"] = f"{model},{api_key}"
    # Every feature uses this one model unless the dashboard sets something else.
    for setting in ("LEARNING_MODEL", "LEARNER_CHAT_MODEL", "INGESTION_MODEL", "DEFAULT_DIFFBOT_CHAT_MODEL",
                    "GRAPH_CLEANUP_MODEL"):
        os.environ.setdefault(setting, model_key)
    # Guests (no login): off unless the dashboard says otherwise. GUEST_USES_OPENAI=true
    # puts them on this paid model; GUEST_LLM_MODEL=guest_free plus a
    # LLM_MODEL_CONFIG_GUEST_FREE line puts them on a free provider (see docs/DEPLOYMENT.md).
    if os.environ.get("GUEST_USES_OPENAI", "").strip().lower() == "true":
        os.environ.setdefault("GUEST_LLM_MODEL", model_key)


def main() -> None:
    configure_postgres()
    configure_neo4j()
    configure_openai()

    port = os.environ.get("PORT", "10000")
    workers = os.environ.get("WEB_CONCURRENCY", "1")
    command = [
        "gunicorn",
        "score:app",
        "--worker-class",
        "uvicorn.workers.UvicornWorker",
        "--workers",
        workers,
        "--bind",
        f"0.0.0.0:{port}",
        "--timeout",
        "300",
        "--access-logfile",
        "-",
        "--error-logfile",
        "-",
    ]
    print(f"Starting CORA with: {shlex.join(command)}")
    os.execvp(command[0], command)


if __name__ == "__main__":
    main()
