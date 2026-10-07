"""Read-only Neo4j queries used by CORA's learning modes."""

from __future__ import annotations

import hashlib
import logging
import os
from functools import lru_cache
from typing import TYPE_CHECKING

from src.learning.models import Concept
from src.shared.common_fn import get_value_from_env
from src.shared.published_corpus import published_document

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
    # Read the raw value first. Handing an unset or blank override to an int
    # conversion raises, and the old code treated that as a misconfiguration --
    # so simply not setting this optional variable, which is the normal case,
    # logged "Invalid ...; falling back to 2" on every single request and buried
    # the warnings that actually meant something.
    raw = os.environ.get(_MIN_CONNECTIVITY_ENV_VAR)
    if raw is None or not raw.strip():
        return _DEFAULT_MIN_CONNECTIVITY

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
WHERE """ + published_document("document") + """
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
  AND """ + published_document("document") + """
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


_SOURCE_CONTEXT_QUERY = """
MATCH (entity:__Entity__)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE coalesce(toString(entity.id), toString(entity.name), elementId(entity)) = $concept_id
  AND """ + published_document("document") + """
WITH chunk, document, size(coalesce(chunk.text, chunk.content, chunk.page_content, '')) AS text_size
ORDER BY document.publishedAt DESC, text_size DESC
RETURN coalesce(chunk.text, chunk.content, chunk.page_content, '') AS text,
       coalesce(document.fileName, 'Unknown source') AS source,
       toString(document.publishedAt) AS version
LIMIT $limit
"""


def get_source_context(graph: Neo4jGraph, concept_id: str, limit: int = 8) -> tuple[str, list[str], str]:
    """Fetch bounded published source text and a stable hash for caching."""
    rows = graph.query(
        _SOURCE_CONTEXT_QUERY,
        params={"concept_id": concept_id, "limit": limit},
    )
    ordered_text = dict.fromkeys(str(row.get("text", "")) for row in rows)
    by_text = {}
    for row in rows:
        by_text.setdefault(str(row.get("text", "")), row)
    rows = [by_text[text] for text in ordered_text][:limit]

    usable = [row for row in rows if str(row.get("text", "")).strip()]
    context = "\n\n".join(
        f"SOURCE: {row['source']}\n{str(row['text']).strip()}" for row in usable
    )
    sources = list(dict.fromkeys(str(row["source"]) for row in usable))
    source_versions = "\n".join(
        f"{row['source']}:{row.get('version') or ''}" for row in usable
    )
    source_hash = hashlib.sha256(f"{source_versions}\n{context}".encode("utf-8")).hexdigest()
    return context[:24000], sources, source_hash


_SOURCE_PASSAGES_QUERY = """
MATCH (entity:__Entity__)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE coalesce(toString(entity.id), toString(entity.name), elementId(entity)) = $concept_id
  AND """ + published_document("document") + """
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
WHERE """ + published_document("document") + """
""" + _LABEL_FILTER_CLAUSE + """
WITH entity,
     count(DISTINCT chunk) AS chunk_count,
     count(DISTINCT document) AS document_count,
     collect(DISTINCT document.fileName)[..5] AS sources
WITH entity, chunk_count, document_count, sources,
     COUNT { (entity)--() } AS connectivity
WHERE connectivity >= $min_connectivity
// ORDER BY / LIMIT are sub-clauses of WITH and must come before its WHERE, so
// filtering first needs a second WITH to order and truncate on. Collapsing
// these two into one clause is a Cypher syntax error, not a style choice.
WITH entity, chunk_count, document_count, sources, connectivity
ORDER BY connectivity DESC, chunk_count DESC
LIMIT $limit
// The nodes are collected twice on purpose: `selected` stays a list of NODES
// because `neighbor IN selected` below compares nodes, while `node_rows` is the
// projected shape the map draws with. Projecting only maps would break the
// relationship match; collecting only nodes would lose the per-node coverage
// (passage count, documents) that the Explore artboard sizes and filters on.
WITH collect(entity) AS selected,
     collect({
       id: coalesce(toString(entity.id), toString(entity.name), elementId(entity)),
       name: coalesce(toString(entity.name), toString(entity.id), 'Unnamed concept'),
       labels: [label IN labels(entity) WHERE label <> '__Entity__'],
       chunk_count: chunk_count,
       document_count: document_count,
       sources: [source IN sources WHERE source IS NOT NULL]
     }) AS node_rows
UNWIND selected AS entity
OPTIONAL MATCH (entity)-[relationship]-(neighbor:__Entity__)
WHERE neighbor IN selected
  AND EXISTS {
    MATCH (entity)<-[:HAS_ENTITY]-(shared:Chunk)-[:HAS_ENTITY]->(neighbor)
    MATCH (shared)-[:PART_OF]->(published:Document)
    WHERE """ + published_document("published") + """
  }
WITH node_rows, collect(DISTINCT relationship) AS relationships
RETURN node_rows AS nodes,
       [relationship IN relationships WHERE relationship IS NOT NULL | {
         id: elementId(relationship),
         from_id: coalesce(toString(startNode(relationship).id), toString(startNode(relationship).name), elementId(startNode(relationship))),
         to_id: coalesce(toString(endNode(relationship).id), toString(endNode(relationship).name), elementId(endNode(relationship))),
         type: 'RELATED_TO'
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


# --- One concept's neighbourhood, and "suggested next" -------------------------
#
# Both queries walk ONE hop out from known concepts. The course map above only
# draws the top-ranked concepts, so a concept outside that set would otherwise
# show no neighbours at all.
#
# Every neighbour must pass the same rules as list_concepts(), or the concept hub
# would list "Reactor Operations Homework #3" as a linked concept:
#   * no excluded (noise) label           -> _LABEL_FILTER_CLAUSE
#   * grounded in a completed, published document
#   * at least min_concept_connectivity() relationships
# The candidate neighbour is called `entity` in both queries so the shared label
# clause applies to it unchanged.

# Relationship types that only say "these two are connected". When a pair is
# joined several ways (Reactivity and Keff are joined three ways), a specific type
# such as CALCULATED_FROM tells a student more, so these are chosen last. Every
# spelling listed here occurs in the dev graph.
_GENERIC_RELATIONSHIP_TYPES = frozenset(
    {"RELATED_TO", "RELATEDTO", "IS_RELATED_TO", "ASSOCIATED_WITH", "CONNECTED_TO"}
)
_FALLBACK_LINK = {"type": "RELATED_TO", "direction": "out"}


_CONCEPT_NEIGHBOURHOOD_QUERY = """
MATCH (centre:__Entity__)
WHERE coalesce(toString(centre.id), toString(centre.name), elementId(centre)) = $concept_id
// One hop, to entities only. Chunks also hang off every concept via HAS_ENTITY;
// they are passages, not neighbours.
MATCH (centre)-[relationship]-(entity:__Entity__)
WHERE entity <> centre
  AND EXISTS {
    MATCH (centre)<-[:HAS_ENTITY]-(shared:Chunk)-[:HAS_ENTITY]->(entity)
    MATCH (shared)-[:PART_OF]->(published:Document)
    WHERE """ + published_document("published") + """
  }
""" + _LABEL_FILTER_CLAUSE + """
// Keep every relationship between the pair; pick_relationship() chooses one.
WITH centre, entity,
     collect(DISTINCT {type: 'RELATED_TO', direction: 'out'}) AS links
// The concept list's coverage rule: a neighbour with no published passage
// drops out here. `shared_passages` counts the passages
// that mention BOTH concepts -- the strength of the link.
MATCH (entity)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE """ + published_document("document") + """
WITH centre, entity, links,
     count(DISTINCT chunk) AS chunk_count,
     count(DISTINCT CASE WHEN EXISTS { (chunk)-[:HAS_ENTITY]->(centre) } THEN chunk END) AS shared_passages,
     COUNT { (entity)--() } AS connectivity
WHERE connectivity >= $min_connectivity
// ORDER BY cannot follow the WHERE above (it belongs to that WITH), so it gets a
// WITH of its own.
WITH entity, links, chunk_count, shared_passages, connectivity,
     coalesce(toString(entity.name), toString(entity.id), 'Unnamed concept') AS name
ORDER BY shared_passages DESC, connectivity DESC, name ASC
// Collect ALL eligible neighbours so linked_count covers them, then return the
// strongest $limit. collect() keeps the order set just above.
WITH collect({
       id: coalesce(toString(entity.id), toString(entity.name), elementId(entity)),
       name: name,
       labels: [label IN labels(entity) WHERE label <> '__Entity__'],
       chunk_count: chunk_count,
       shared_passages: shared_passages,
       links: links
     }) AS neighbours
RETURN size(neighbours) AS linked_count, neighbours[..$limit] AS neighbours
"""


_SUGGESTED_CONCEPTS_QUERY = """
// `anchor` is a concept the learner has started; $started_ids is ordered most
// recently seen first.
MATCH (anchor:__Entity__)
WITH anchor, coalesce(toString(anchor.id), toString(anchor.name), elementId(anchor)) AS anchor_id
WHERE anchor_id IN $started_ids
// One hop out, to entities the learner has NOT started.
MATCH (anchor)-[relationship]-(entity:__Entity__)
WHERE NOT coalesce(toString(entity.id), toString(entity.name), elementId(entity)) IN $started_ids
  AND EXISTS {
    MATCH (anchor)<-[:HAS_ENTITY]-(shared:Chunk)-[:HAS_ENTITY]->(entity)
    MATCH (shared)-[:PART_OF]->(published:Document)
    WHERE """ + published_document("published") + """
  }
""" + _LABEL_FILTER_CLAUSE + """
WITH anchor, anchor_id, entity,
     collect(DISTINCT {type: 'RELATED_TO', direction: 'out'}) AS links
// Same coverage rule and link strength as the neighbourhood query above.
MATCH (entity)<-[:HAS_ENTITY]-(chunk:Chunk)-[:PART_OF]->(document:Document)
WHERE """ + published_document("document") + """
WITH anchor, anchor_id, entity, links,
     count(DISTINCT chunk) AS chunk_count,
     count(DISTINCT document) AS document_count,
     collect(DISTINCT document.fileName)[..5] AS sources,
     count(DISTINCT CASE WHEN EXISTS { (chunk)-[:HAS_ENTITY]->(anchor) } THEN chunk END) AS shared_passages,
     COUNT { (entity)--() } AS connectivity
WHERE connectivity >= $min_connectivity
// A candidate linked to several started concepts must appear once. Keep its
// strongest link: most shared passages, then the most recently seen anchor
// (its position in $started_ids).
WITH entity, chunk_count, document_count, sources, connectivity,
     anchor, anchor_id, links, shared_passages,
     [index IN range(0, size($started_ids) - 1) WHERE $started_ids[index] = anchor_id][0] AS anchor_rank
ORDER BY shared_passages DESC, anchor_rank ASC
WITH entity, chunk_count, document_count, sources, connectivity,
     collect({
       id: anchor_id,
       name: coalesce(toString(anchor.name), toString(anchor.id), 'Unnamed concept'),
       links: links,
       shared_passages: shared_passages
     })[0] AS strongest
WITH entity, chunk_count, document_count, sources, connectivity, strongest,
     coalesce(toString(entity.name), toString(entity.id), 'Unnamed concept') AS name
ORDER BY strongest.shared_passages DESC, connectivity DESC, name ASC
LIMIT $limit
RETURN coalesce(toString(entity.id), toString(entity.name), elementId(entity)) AS id,
       name,
       chunk_count,
       document_count,
       connectivity,
       [source IN sources WHERE source IS NOT NULL] AS sources,
       strongest AS because_of
"""


def pick_relationship(links: list[dict]) -> dict[str, str]:
    """Choose the one relationship to show when a pair is linked several ways.

    Specific types beat generic ones; ties go alphabetically so the choice never
    flickers between requests, then outgoing ("centre TYPE neighbour") before
    incoming.
    """
    usable = [link for link in links or [] if link and link.get("type")]
    if not usable:
        return dict(_FALLBACK_LINK)

    def rank(link: dict) -> tuple[bool, str, bool]:
        is_generic = link["type"] in _GENERIC_RELATIONSHIP_TYPES
        is_incoming = link.get("direction") != "out"
        return (is_generic, link["type"], is_incoming)

    best = min(usable, key=rank)
    return {
        "type": str(best["type"]),
        "direction": "out" if best.get("direction") == "out" else "in",
    }


def _eligibility_params() -> dict:
    """The concept-list rules, as query parameters."""
    return {
        "excluded_labels": sorted(excluded_entity_labels()),
        "min_connectivity": min_concept_connectivity(),
    }


def _neighbour_from_row(row: dict) -> dict:
    link = pick_relationship(row.get("links") or [])
    return {
        "id": str(row["id"]),
        "name": str(row["name"]),
        "labels": list(row.get("labels") or []),
        "chunk_count": int(row.get("chunk_count") or 0),
        "relationship": link["type"],
        "direction": link["direction"],
        "shared_passages": int(row.get("shared_passages") or 0),
    }


def get_concept_neighbourhood(graph: Neo4jGraph, concept_id: str, limit: int = 8) -> dict:
    """Return one concept's eligible neighbours, strongest link first.

    `linked_count` counts every eligible neighbour rather than only the `limit`
    returned, so the hub can say "linked to 25 other concepts" while drawing
    eight. An unknown concept comes back as an empty neighbourhood; the router
    decides whether that is a 404.
    """
    rows = graph.query(
        _CONCEPT_NEIGHBOURHOOD_QUERY,
        params={"concept_id": concept_id, "limit": limit, **_eligibility_params()},
    )
    if not rows:
        return {"linked_count": 0, "neighbours": []}
    row = rows[0]
    return {
        "linked_count": int(row.get("linked_count") or 0),
        "neighbours": [_neighbour_from_row(neighbour) for neighbour in row.get("neighbours") or []],
    }


def get_suggested_concepts(graph: Neo4jGraph, started_ids: list[str], limit: int = 3) -> list[dict]:
    """Suggest unstarted concepts linked to the ones the learner has started.

    `started_ids` should be ordered most recently seen first; that order breaks
    ties between two started concepts that link to the same suggestion. Returns
    one dict per suggestion: the Concept, the started concept it came from, the
    relationship between them and their shared passage count.
    """
    if not started_ids:
        return []
    rows = graph.query(
        _SUGGESTED_CONCEPTS_QUERY,
        params={"started_ids": list(started_ids), "limit": limit, **_eligibility_params()},
    )

    suggestions = []
    for row in rows:
        because_of = row.get("because_of") or {}
        link = pick_relationship(because_of.get("links") or [])
        concept = Concept(
            id=row["id"],
            name=row["name"],
            chunk_count=row["chunk_count"],
            document_count=row["document_count"],
            connectivity=row["connectivity"],
            sources=row.get("sources") or [],
        )
        suggestions.append(
            {
                "concept": concept,
                "because_of": {"id": str(because_of["id"]), "name": str(because_of["name"])},
                "relationship": link["type"],
                "shared_passages": int(because_of.get("shared_passages") or 0),
            }
        )
    return suggestions
