"""
One-off script to ingest the NE235 course PDFs directly against Neo4j,
bypassing the HTTP API / Auth0 layer (same underlying functions the
/upload and /extract routes call). Mirrors the pattern in
test_integrationqa.py's create_source_node_local / test_graph_from_file_local.

Usage:
    ./venv/bin/python3 ingest_pdfs.py "Some File.pdf"        # one file (smoke test)
    ./venv/bin/python3 ingest_pdfs.py --all                  # every PDF in ../data
"""
import argparse
import asyncio
import logging
import shutil
import sys
from datetime import datetime as dt
from pathlib import Path

from dotenv import load_dotenv

from src.entities.source_extract_params import SourceScanExtractParams
from src.entities.source_node import sourceNode
from src.graphDB_dataAccess import graphDBdataAccess
from src.main import create_graph_database_connection, extract_graph_from_file_local_file
from src.shared.common_fn import Neo4jCredentials, get_value_from_env

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR.parent / "data"
MERGED_DIR = BASE_DIR / "merged_files"
MERGED_DIR.mkdir(exist_ok=True)

MODEL = get_value_from_env("INGESTION_MODEL", "openai_gpt_4o_mini")

credentials = Neo4jCredentials(
    uri=get_value_from_env("NEO4J_URI"),
    userName=get_value_from_env("NEO4J_USERNAME"),
    password=get_value_from_env("NEO4J_PASSWORD"),
    database=get_value_from_env("NEO4J_DATABASE"),
)


def create_source_node_local(graph, model: str, file_name: str, file_size: int) -> None:
    source_node = sourceNode()
    source_node.file_name = file_name
    source_node.file_type = "pdf"
    source_node.file_size = str(file_size)
    source_node.file_source = "local file"
    source_node.model = model
    source_node.created_at = dt.now()
    graphDBdataAccess(graph).create_source_node(source_node)


def ingest_one(file_name: str) -> dict:
    src_path = DATA_DIR / file_name
    if not src_path.exists():
        return {"file_name": file_name, "status": "Failed", "error": "file not found in data/"}

    merged_path = MERGED_DIR / file_name
    shutil.copyfile(src_path, merged_path)

    graph = create_graph_database_connection(credentials)
    create_source_node_local(graph, MODEL, file_name, src_path.stat().st_size)

    params = SourceScanExtractParams(
        model=MODEL,
        source_url="",
        file_name=file_name,
        allowedNodes="",
        allowedRelationship="",
        # 100-token chunks (the upstream default) are ~75 words — too thin to extract
        # reliable concepts from, and too thin to serve as lesson source text later.
        token_chunk_size=int(get_value_from_env("INGESTION_CHUNK_SIZE", "400")),
        chunk_overlap=int(get_value_from_env("INGESTION_CHUNK_OVERLAP", "40")),
        chunks_to_combine=1,
        retry_condition=None,
        additional_instructions="",
    )
    result = asyncio.run(extract_graph_from_file_local_file(credentials, params, str(merged_path)))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="*", help="PDF filename(s) in data/, e.g. '2025 Quiz#1.pdf'")
    parser.add_argument("--all", action="store_true", help="ingest every PDF in data/")
    args = parser.parse_args()

    targets = sorted(p.name for p in DATA_DIR.glob("*.pdf")) if args.all else args.files
    if not targets:
        print("No files given. Pass filenames or --all.", file=sys.stderr)
        sys.exit(1)

    for name in targets:
        print(f"\n=== Ingesting: {name} ===")
        try:
            res = ingest_one(name)
            print(res)
        except Exception as e:
            logging.exception(f"Failed on {name}")
            print({"file_name": name, "status": "Failed", "error": str(e)})
