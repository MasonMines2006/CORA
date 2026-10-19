"""Who owns a chat session.

The browser invents a chat session id and sends it with every question. If the
server stored history under that id as-is, anyone who learned someone else's id
(from a shared screenshot, a log line, a shoulder-surf) could read that
conversation back or clear it.

So the server never uses the client's id directly. It builds the storage key from
two parts:

    chat:<hash of the verified learner id>:<the client's id>

The learner id comes from authentication (Auth0 subject, dev login, or the guest
UUID), never from the request body, so a caller can only ever reach keys inside
their own namespace. Hashing it keeps the key a fixed shape (no way to smuggle a
second owner in with a ":" or "|") and keeps raw identities out of the Session
nodes that admins can browse in Neo4j.
"""

import hashlib
from uuid import uuid4

# Long enough for any UUID-based id the frontend makes; anything longer is not ours.
MAX_CLIENT_SESSION_ID_LENGTH = 128


def _owner_hash(learner_id: str) -> str:
    # 16 hex chars = 64 bits: plenty to keep learners apart, short enough to read in logs.
    return hashlib.sha256(learner_id.encode("utf-8")).hexdigest()[:16]


def clean_client_session_id(client_session_id) -> str:
    """The client's id, trimmed and length-capped. A new random id if it sent none."""
    text = str(client_session_id or "").strip()
    if not text:
        return str(uuid4())
    return text[:MAX_CLIENT_SESSION_ID_LENGTH]


def owned_session_id(learner_id: str, client_session_id: str) -> str:
    """The server-side history key for this learner's copy of `client_session_id`."""
    if not learner_id:
        # Every chat route authenticates first, so this means a programming error.
        # Refuse rather than fall back to a shared, ownerless key.
        raise ValueError("A chat session needs an owner")
    return f"chat:{_owner_hash(learner_id)}:{clean_client_session_id(client_session_id)}"
