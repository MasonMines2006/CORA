"""The single definition of "published" for every student-facing query.

Students and guests may only read from documents an admin has published (see
src/publication.py). Every query that reaches course content -- Chat retrieval,
the concept list, the course map, sources, lessons, quizzes, review cards and
suggestions -- must constrain each `Document` it binds with this predicate.

Why a helper instead of writing the condition inline: the condition used to be
copied into a dozen queries by hand. A copy that drifts (a typo, or a missing
`status` check) still parses and still passes every fake-graph unit test, and it
would quietly put draft material in front of students. One source of truth plus
tests/test_published_corpus_boundary.py, which checks every student query uses
it, makes that drift loud.

This module imports nothing from the app so that both src/shared/constants.py
(upstream chat queries) and src/learning/graph.py can use it without cycles.
"""

import re

# Ingestion's `status` says processing finished; `publicationStatus` says an
# admin approved it for students. Both are required. A missing
# publicationStatus counts as draft, because `NULL = 'published'` is not true.
COMPLETED_STATUS = "Completed"
PUBLISHED_STATUS = "published"

# Only a bare Cypher identifier may be spliced into a query string.
_CYPHER_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def published_document(variable: str) -> str:
    """Return the Cypher condition that `variable` is a published Document.

    Use it after WHERE or AND, e.g.
    ``"WHERE " + published_document("document")``.
    """
    if not _CYPHER_IDENTIFIER.match(variable or ""):
        raise ValueError(f"Not a Cypher variable name: {variable!r}")
    return (
        f"{variable}.status = '{COMPLETED_STATUS}' "
        f"AND {variable}.publicationStatus = '{PUBLISHED_STATUS}'"
    )
