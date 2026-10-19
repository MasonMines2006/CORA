"""Admin review and publication of ingested source documents.

Ingestion's ``status`` describes processing. ``publicationStatus`` controls
student visibility. Missing publication status means draft, including for
documents created before this feature existed.
"""

import asyncio
import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.auth import require_role
from src.learning.graph import get_learning_graph
from src.shared.constants import CHAT_VECTOR_MODE
from src.shared.published_corpus import published_document

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/materials", tags=["admin materials"])

# Only these roles may see draft material, anywhere. Everyone else -- students,
# TAs, guests, and any role added later -- is held to the published corpus. It
# is an allowlist on purpose: an unknown role fails closed.
PUBLICATION_ADMIN_ROLES = ("admin", "test_full")
admin_only = require_role(list(PUBLICATION_ADMIN_ROLES))

# The one Chat mode whose retrieval query is filtered to published documents
# (VECTOR_SEARCH_QUERY). The graph and community modes walk entities and
# communities that unpublished documents also feed, so learners never get them.
LEARNER_CHAT_MODE = CHAT_VECTOR_MODE
_SESSION_REVISION_MARKER = ":pub:"


def can_read_unpublished(role: str | None) -> bool:
    """True only for roles allowed to see draft, failed or retired material."""
    return role in PUBLICATION_ADMIN_ROLES


def learner_chat_scope(role: str | None, mode: str | None, document_names: str | None) -> tuple[str | None, str | None]:
    """Return the (mode, document_names) a Chat request may actually use.

    Learners get published-only vector retrieval over the whole published
    corpus, whatever they asked for. Selecting documents by name is an admin
    tool, so a learner's list is dropped rather than trusted.
    """
    if can_read_unpublished(role):
        return mode, document_names
    return LEARNER_CHAT_MODE, "[]"


def published_session_id(client_session_id: str, fingerprint: str) -> str:
    """Key a learner's chat history to one revision of the published corpus.

    Old turns can quote a source that has since been unpublished, and the LLM
    reads them back as context. A new revision therefore starts a new history.
    Any marker the client sent is stripped so it cannot pick a revision.
    """
    base = client_session_id.split(_SESSION_REVISION_MARKER, 1)[0]
    return f"{base}{_SESSION_REVISION_MARKER}{fingerprint}"


class MaterialAction(BaseModel):
    file_name: str = Field(min_length=1)


_LIST_QUERY = """
MATCH (document:Document)
WHERE document.fileName IS NOT NULL
OPTIONAL MATCH (document)<-[:PART_OF]-(chunk:Chunk)
WITH document,
     count(DISTINCT CASE WHEN trim(coalesce(chunk.text, chunk.content, chunk.page_content, '')) <> '' THEN chunk END) AS passage_count
RETURN document.fileName AS file_name,
       coalesce(document.status, 'New') AS processing_status,
       coalesce(document.publicationStatus, 'draft') AS publication_status,
       passage_count,
       coalesce(document.errorMessage, '') AS error_message,
       toString(document.publishedAt) AS published_at,
       document.publishedBy AS published_by
ORDER BY file_name
"""

_PREVIEW_QUERY = """
MATCH (document:Document {fileName: $file_name})
OPTIONAL MATCH (document)<-[:PART_OF]-(chunk:Chunk)
WITH document, chunk
ORDER BY size(coalesce(chunk.text, chunk.content, chunk.page_content, '')) DESC
WITH document,
     count(DISTINCT CASE WHEN trim(coalesce(chunk.text, chunk.content, chunk.page_content, '')) <> '' THEN chunk END) AS passage_count,
     collect(CASE WHEN chunk IS NOT NULL THEN coalesce(chunk.text, chunk.content, chunk.page_content, '') END) AS texts
RETURN document.fileName AS file_name,
       coalesce(document.status, 'New') AS processing_status,
       coalesce(document.publicationStatus, 'draft') AS publication_status,
       passage_count,
       [text IN texts[..5] WHERE trim(text) <> '' | left(text, 1800)] AS passages,
       coalesce(document.errorMessage, '') AS error_message,
       toString(document.publishedAt) AS published_at,
       document.publishedBy AS published_by
"""

_PUBLISH_QUERY = """
MATCH (document:Document {fileName: $file_name})
WHERE document.status = 'Completed'
  AND coalesce(document.publicationStatus, 'draft') <> 'published'
MATCH (document)<-[:PART_OF]-(chunk:Chunk)
WHERE trim(coalesce(chunk.text, chunk.content, chunk.page_content, '')) <> ''
WITH document, count(DISTINCT chunk) AS passage_count
WHERE passage_count > 0
SET document.publicationStatus = 'published',
    document.publishedAt = datetime(),
    document.publishedBy = $actor
RETURN document.fileName AS file_name, passage_count
"""

_UNPUBLISH_QUERY = """
MATCH (document:Document {fileName: $file_name})
WHERE document.publicationStatus = 'published'
SET document.publicationStatus = 'draft',
    document.unpublishedAt = datetime(),
    document.unpublishedBy = $actor
RETURN document.fileName AS file_name
"""


def _query(query: str, params: dict | None = None) -> list[dict]:
    return get_learning_graph().query(query, params=params or {})


_PUBLISHED_FINGERPRINT_QUERY = """
MATCH (document:Document)
WHERE """ + published_document("document") + """
RETURN document.fileName AS file_name,
       toString(document.publishedAt) AS published_at
ORDER BY file_name
"""


def publication_fingerprint(graph) -> str:
    """Separate chat histories whenever the visible document set changes."""
    rows = graph.query(_PUBLISHED_FINGERPRINT_QUERY)
    visible = "\n".join(f"{row['file_name']}:{row['published_at']}" for row in rows)
    return hashlib.sha256(visible.encode("utf-8")).hexdigest()[:16]


@router.get("")
async def list_materials(_admin: dict = Depends(admin_only)):
    try:
        return await asyncio.to_thread(_query, _LIST_QUERY)
    except Exception as exc:
        logger.exception("Could not list materials")
        raise HTTPException(status_code=503, detail="Materials are unavailable") from exc


@router.get("/{file_name:path}")
async def preview_material(file_name: str, _admin: dict = Depends(admin_only)):
    try:
        rows = await asyncio.to_thread(_query, _PREVIEW_QUERY, {"file_name": file_name})
    except Exception as exc:
        logger.exception("Could not preview material")
        raise HTTPException(status_code=503, detail="Material preview is unavailable") from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Material was not found")
    return rows[0]


@router.post("/publish")
async def publish_material(action: MaterialAction, admin: dict = Depends(admin_only)):
    try:
        rows = await asyncio.to_thread(
            _query, _PUBLISH_QUERY,
            {"file_name": action.file_name, "actor": admin["auth0_sub"]},
        )
    except Exception as exc:
        logger.exception("Could not publish material")
        raise HTTPException(status_code=503, detail="Publication failed") from exc
    if not rows:
        raise HTTPException(
            status_code=409,
            detail="Material must finish processing and contain readable passages before publication",
        )
    return rows[0]


@router.post("/unpublish")
async def unpublish_material(action: MaterialAction, admin: dict = Depends(admin_only)):
    try:
        rows = await asyncio.to_thread(
            _query, _UNPUBLISH_QUERY,
            {"file_name": action.file_name, "actor": admin["auth0_sub"]},
        )
    except Exception as exc:
        logger.exception("Could not unpublish material")
        raise HTTPException(status_code=503, detail="Unpublication failed") from exc
    if not rows:
        raise HTTPException(status_code=409, detail="Material is not published")
    return rows[0]
