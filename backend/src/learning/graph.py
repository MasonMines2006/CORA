"""Read-only Neo4j queries used by CORA's learning modes."""

from __future__ import annotations

import hashlib
import logging
from functools import lru_cache
from typing import TYPE_CHECKING

from src.learning.models import Concept
from src.shared.common_fn import get_value_from_env

if TYPE_CHECKING:
    from langchain_neo4j import Neo4jGraph


# --- Concept list noise filter -------------------------------------------------
#
# The extractor gives every entity a TYPE, which Neo4j stores as an extra label
# next to `__Entity__` (e.g. `Reactivity` is `:__Entity__:Concept:Parameter`).
# That vocabulary is open-ended -- this graph already has ~180 distinct labels,
# most of them one-offs -- so an ALLOWLIST of "teachable" labels would silently
# drop every real concept the next ingestion invents a new label for.
#
# We therefore use a DENYLIST: unknown labels are kept, and an entity is dropped
# only when it carries a label from the list below. That keeps the exclusion rule
# precise (its failure mode is a slightly noisy list, never a missing concept),
# which is what the project owner asked for.
#
# Only labels that are NEVER a teachable topic belong here: people, organizations,
# bibliography/document titles, course administration and regulatory citations.
# Deliberately NOT listed, because they co-occur with real concepts in this graph:
#   Figure   -> "Neutron Life Cycle", "Uranium"
#   Section  -> "Safety Limits", "Limiting Safety System Settings"
#   Header   -> "Cooling Tower Header"
# Comparison is case-insensitive with `_` treated as a space, so `Data_file` and
# `data file` both match.
#
# Tuning without a code change: set LEARNING_EXCLUDED_ENTITY_LABELS to a
# comma-separated list to REPLACE this default, or to an empty string to turn the
# filter off entirely.
_DEFAULT_EXCLUDED_ENTITY_LABELS: tuple[str, ...] = (
    # People and roles
    "Person",
    "Human",
    "Role",
    "Position",
    "Staff",
    "Faculty",
    "Author",
    # Organizations and institutions
    "Organization",
    "Institution",
    "Educational institution",
    "University",
    "College",
    "Committee",
    "Department",
    "Division",
    "Government",
    "Company",
    "Agency",
    "Program",
    "Mission",
    # Documents, bibliography and figures-of-record
    "Document",
    "Document section",
    "Manual",
    "Book",
    "Textbook",
    "Publication",
    "Report",
    "Chapter",
    "Guide",
    "Reference",
    "File",
    "Data_file",
    "Schematic",
    "Table",
    # Course administration
    "Course",
    "Semester",
    "Assignment",
    "Homework",
    "Lab questions",
    "Question",
    "Test",
    "Training",
    # Dates and regulatory citations
    "Date",
    "Time period",
    "License",
    "Docket",
    "Amendment",
    "Regulation",
    "Law",
)

_EXCLUDED_LABELS_ENV_VAR = "LEARNING_EXCLUDED_ENTITY_LABELS"

# Entities with a single relationship are extraction stragglers rather than
# topics. The bar is deliberately low: anything that can plausibly reach the top
# of a connectivity ranking is far above it, so this trims the tail without
# risking a real concept. Override with LEARNING_MIN_CONCEPT_CONNECTIVITY.
_MIN_CONNECTIVITY_ENV_VAR = "LEARNING_MIN_CONCEPT_CONNECTIVITY"
_DEFAULT_MIN_CONNECTIVITY = 2

# Shared by every concept query so the list and the detail lookup agree on what
# counts as a concept. `$excluded_labels` holds pre-normalised (lower-case,
# underscore-free) label names.
_LABEL_FILTER_CLAUSE = """
  AND NOT any(label IN labels(entity)
              WHERE toLower(replace(label, '_', ' ')) IN $excluded_labels)
"""


def _normalize_label(label: str) -> str:
    """Fold label spelling differences (case, underscores, padding) into one form."""
    return label.replace("_", " ").strip().lower()


def excluded_entity_labels() -> frozenset[str]:
    """Return the normalised entity labels that are not teachable concepts."""
    raw = get_value_from_env(
        _EXCLUDED_LABELS_ENV_VAR,
        default_value=",".join(_DEFAULT_EXCLUDED_ENTITY_LABELS),
        data_type=str,
    )
    # An explicitly empty env var is a valid "disable the filter" setting.
    labels = (_normalize_label(part) for part in str(raw or "").split(","))
    return frozenset(label for label in labels if label)


def min_concept_connectivity() -> int:
    """Return the minimum relationship count an entity needs to be listed."""
    try:
        value = get_value_from_env(
            _MIN_CONNECTIVITY_ENV_VAR,
            default_value=_DEFAULT_MIN_CONNECTIVITY,
            data_type=int,
        )
    except Exception:  # a typo in the env var must not break the endpoint
        logging.warning(
            "Invalid %s; falling back to %s", _MIN_CONNECTIVITY_ENV_VAR, _DEFAULT_MIN_CONNECTIVITY
        )
        return _DEFAULT_MIN_CONNECTIVITY
    if not isinstance(value, int) or value < 0:
        return _DEFAULT_MIN_CONNECTIVITY
    return value


@lru_cache(maxsize=1)
def get_learning_graph() -> Neo4jGraph:
    """Create one read-only graph client from server-side environment settings."""
    from langchain_neo4j import Neo4jGraph

    uri = get_value_from_env("NEO4J_URI", default_value=None, data_type=str)
    username = get_value_from_env("NEO4J_USERNAME", default_value=None, data_type=str)
    password = get_value_from_env("NEO4J_PASSWORD", default_value=None, data_type=str)
    database = get_value_from_env("NEO4J_DATABASE", default_value="neo4j", data_type=str)
    if not uri or not username or not password:
        raise RuntimeError("Neo4j connection settings are missing")
    return Neo4jGraph(
        url=uri,
        username=username,
        password=password,
        database=database,
        refresh_schema=False,
        # sanitize=True silently DELETES any list in a result holding more than
        # 128 elements. It exists to strip embedding vectors from responses, but
        # every query in this module returns explicit scalar projections and
        # never a raw node, so it protects nothing here -- it only truncated the
        # course map's nodes and relationships into an empty graph, with a 200
        # and no error. See tests/test_learning_network_live.py.
        sanitize=False,
    )


_LIST_CONCEPTS_QUERY = """
MATCH (entity:__Entity__)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE document.status = 'Completed'
  AND NOT toLower(coalesce(document.fileName, '')) CONTAINS 'key'
""" + _LABEL_FILTER_CLAUSE + """
WITH entity,
     count(DISTINCT chunk) AS chunk_count,
     count(DISTINCT document) AS document_count,
     collect(DISTINCT document.fileName)[..5] AS sources
WITH entity, chunk_count, document_count, sources,
     COUNT { (entity)--() } AS connectivity
WHERE connectivity >= $min_connectivity
RETURN coalesce(toString(entity.id), toString(entity.name), elementId(entity)) AS id,
       coalesce(toString(entity.name), toString(entity.id), 'Unnamed concept') AS name,
       chunk_count,
       document_count,
       connectivity,
       [source IN sources WHERE source IS NOT NULL] AS sources
ORDER BY connectivity DESC, chunk_count DESC, name ASC
LIMIT $limit
"""


# Same label filter as the list query: a concept hidden from the list must not be
# reachable through the detail lookup either, or lessons could be generated for
# "Reactor Theory Manual".
_CONCEPT_ROWS_QUERY = """
MATCH (entity:__Entity__)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE coalesce(toString(entity.id), toString(entity.name), elementId(entity)) = $concept_id
  AND document.status = 'Completed'
  AND NOT toLower(coalesce(document.fileName, '')) CONTAINS 'key'
""" + _LABEL_FILTER_CLAUSE + """
WITH entity,
     count(DISTINCT chunk) AS chunk_count,
     count(DISTINCT document) AS document_count,
     collect(DISTINCT document.fileName)[..5] AS sources
RETURN coalesce(toString(entity.id), toString(entity.name), elementId(entity)) AS id,
       coalesce(toString(entity.name), toString(entity.id), 'Unnamed concept') AS name,
       chunk_count,
       document_count,
       COUNT { (entity)--() } AS connectivity,
       [source IN sources WHERE source IS NOT NULL] AS sources
LIMIT 1
"""


def list_concepts(graph: Neo4jGraph, limit: int = 18) -> list[Concept]:
    """Return graph-derived concepts ranked by their connectivity and coverage.

    Entities whose extracted type is not teachable (see
    `_DEFAULT_EXCLUDED_ENTITY_LABELS`) are left out so students see topics rather
    than document titles, staff roles and course metadata.
    """
    rows = graph.query(
        _LIST_CONCEPTS_QUERY,
        params={
            "limit": limit,
            "excluded_labels": sorted(excluded_entity_labels()),
            "min_connectivity": min_concept_connectivity(),
        },
    )
    return [Concept(**row) for row in rows]


def get_concept(graph: Neo4jGraph, concept_id: str) -> Concept | None:
    return next(iter(_concept_rows(graph, concept_id)), None)


def _concept_rows(graph: Neo4jGraph, concept_id: str) -> list[Concept]:
    rows = graph.query(
        _CONCEPT_ROWS_QUERY,
        params={
            "concept_id": concept_id,
            "excluded_labels": sorted(excluded_entity_labels()),
        },
    )
    return [Concept(**row) for row in rows]


# Lesson beat 3 is a guaranteed PULSTAR slot, so a few PULSTAR-specific chunks are
# reserved in every context window. Ranking purely by chunk size crowds them out:
# the Theory Manual has the longest passages, so an all-theory context makes the
# model correctly but uselessly report that it found no PULSTAR connection.
_PULSTAR_CHUNK_QUOTA = 3

_SOURCE_CONTEXT_QUERY = """
MATCH (entity:__Entity__)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE coalesce(toString(entity.id), toString(entity.name), elementId(entity)) = $concept_id
  AND document.status = 'Completed'
  AND NOT toLower(coalesce(document.fileName, '')) CONTAINS 'key'
  AND ($pulstar_only = false
       OR toLower(coalesce(document.fileName, '')) CONTAINS 'pulstar'
       OR toLower(coalesce(chunk.text, '')) CONTAINS 'pulstar')
WITH chunk, document, size(coalesce(chunk.text, chunk.content, chunk.page_content, '')) AS text_size
ORDER BY text_size DESC
RETURN coalesce(chunk.text, chunk.content, chunk.page_content, '') AS text,
       coalesce(document.fileName, 'Unknown source') AS source
LIMIT $limit
"""


def get_source_context(graph: Neo4jGraph, concept_id: str, limit: int = 8) -> tuple[str, list[str], str]:
    """Fetch bounded, non-answer-key source text and a stable hash for caching."""
    pulstar_rows = graph.query(
        _SOURCE_CONTEXT_QUERY,
        params={"concept_id": concept_id, "limit": _PULSTAR_CHUNK_QUOTA, "pulstar_only": True},
    )
    general_rows = graph.query(
        _SOURCE_CONTEXT_QUERY,
        params={"concept_id": concept_id, "limit": limit, "pulstar_only": False},
    )

    # PULSTAR chunks lead so they survive the character cap below; dict.fromkeys
    # keeps first-seen order while dropping the duplicates the two queries share.
    ordered_text = dict.fromkeys(
        str(row.get("text", "")) for row in [*pulstar_rows, *general_rows]
    )
    by_text = {}
    for row in [*pulstar_rows, *general_rows]:
        by_text.setdefault(str(row.get("text", "")), row)
    rows = [by_text[text] for text in ordered_text][:limit]

    usable = [row for row in rows if str(row.get("text", "")).strip()]
    context = "\n\n".join(
        f"SOURCE: {row['source']}\n{str(row['text']).strip()}" for row in usable
    )
    sources = list(dict.fromkeys(str(row["source"]) for row in usable))
    source_hash = hashlib.sha256(context.encode("utf-8")).hexdigest()
    return context[:24000], sources, source_hash


_SOURCE_PASSAGES_QUERY = """
MATCH (entity:__Entity__)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE coalesce(toString(entity.id), toString(entity.name), elementId(entity)) = $concept_id
  AND document.status = 'Completed'
  AND NOT toLower(coalesce(document.fileName, '')) CONTAINS 'key'
  AND trim(coalesce(chunk.text, chunk.content, chunk.page_content, '')) <> ''
WITH DISTINCT chunk, document,
     coalesce(chunk.text, chunk.content, chunk.page_content, '') AS text
ORDER BY document.fileName ASC, size(text) DESC
RETURN text, coalesce(document.fileName, 'Unknown source') AS source
LIMIT $limit
"""


def get_source_passages(graph: Neo4jGraph, concept_id: str, limit: int = 12) -> list[dict[str, str]]:
    """Return readable, grounded passages for the concept source viewer."""
    rows = graph.query(
        _SOURCE_PASSAGES_QUERY,
        params={"concept_id": concept_id, "limit": limit},
    )
    passages = []
    for row in rows:
        text = str(row.get("text", "")).strip()
        if text:
            passages.append(
                {
                    "text": text,
                    "source": str(row.get("source") or "Unknown source"),
                }
            )
    return passages[:limit]


_CONCEPT_NETWORK_QUERY = """
MATCH (entity:__Entity__)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE document.status = 'Completed'
  AND NOT toLower(coalesce(document.fileName, '')) CONTAINS 'key'
""" + _LABEL_FILTER_CLAUSE + """
WITH entity, count(DISTINCT chunk) AS chunk_count,
     count(DISTINCT document) AS document_count,
     COUNT { (entity)--() } AS connectivity
WHERE connectivity >= $min_connectivity
// ORDER BY / LIMIT are sub-clauses of WITH and must come before its WHERE, so
// filtering first needs a second WITH to order and truncate on. Collapsing
// these two into one clause is a Cypher syntax error, not a style choice.
WITH entity, chunk_count, document_count, connectivity
ORDER BY connectivity DESC, chunk_count DESC
LIMIT $limit
WITH collect(entity) AS selected
UNWIND selected AS entity
OPTIONAL MATCH (entity)-[relationship]-(neighbor:__Entity__)
WHERE neighbor IN selected
WITH selected, collect(DISTINCT relationship) AS relationships
RETURN [node IN selected | {
         id: coalesce(toString(node.id), toString(node.name), elementId(node)),
         name: coalesce(toString(node.name), toString(node.id), 'Unnamed concept'),
         labels: [label IN labels(node) WHERE label <> '__Entity__']
       }] AS nodes,
       [relationship IN relationships WHERE relationship IS NOT NULL | {
         id: elementId(relationship),
         from_id: coalesce(toString(startNode(relationship).id), toString(startNode(relationship).name), elementId(startNode(relationship))),
         to_id: coalesce(toString(endNode(relationship).id), toString(endNode(relationship).name), elementId(endNode(relationship))),
         type: type(relationship)
       }] AS relationships
"""


def get_concept_network(graph: Neo4jGraph, limit: int = 120) -> dict[str, list[dict]]:
    """Return a bounded entity-only network suitable for interactive exploration."""
    rows = graph.query(
        _CONCEPT_NETWORK_QUERY,
        params={
            "limit": limit,
            "excluded_labels": sorted(excluded_entity_labels()),
            "min_connectivity": min_concept_connectivity(),
        },
    )
    if not rows:
        return {"nodes": [], "relationships": []}
    row = rows[0]
    return {
        "nodes": list(row.get("nodes") or []),
        "relationships": list(row.get("relationships") or []),
    }
