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


def configure_openai() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required")

    # get_llm() normalizes model names before looking up their configuration.
    model_key = f"openai_{model}".upper().replace(".", "_").replace("-", "_")
    os.environ[f"LLM_MODEL_CONFIG_{model_key}"] = f"{model},{api_key}"
    os.environ.setdefault("LEARNING_MODEL", f"openai_{model}")
    os.environ.setdefault("INGESTION_MODEL", f"openai_{model}")
    os.environ.setdefault("DEFAULT_DIFFBOT_CHAT_MODEL", f"openai_{model}")
    os.environ.setdefault("GRAPH_CLEANUP_MODEL", f"openai_{model}")


def configure_temporary_auth0() -> None:
    """Keep the current branch deployable until in-house auth replaces Auth0."""
    domain = os.environ.get("AUTH0_DOMAIN", "").strip().rstrip("/")
    if domain and not os.environ.get("AUTH0_ISSUER"):
        os.environ["AUTH0_ISSUER"] = f"https://{domain}/"


def main() -> None:
    configure_postgres()
    configure_neo4j()
    configure_openai()
    configure_temporary_auth0()

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
