# CODEX HANDOFF — CORA Learning Modes

**Written:** 2026-09-17
**Author:** Claude Code session (working in parallel — see Ownership Split before touching any file)
**Goal:** Ship three learning modes today, deployable behind a public URL for a conference presentation.

Read `AGENTS.md` in the repo root first — it has the design tokens and component patterns. This document adds the current runtime state, the decisions already made, and your scope boundary.

---

## 1. Ownership Split (READ FIRST)

Another agent (Claude Code) is working in this repo **at the same time** on the presentation/deployment track. To avoid collisions:

### You own (Codex)
- `backend/src/learning/` — **new directory, create it**. All new endpoints live here.
- `backend/src/user_store.py` — progress/mastery tables (additive only; do not change existing `app_users` columns)
- `frontend/src/components/Student/StudentLearn.tsx` — rewrite for guided mode
- `frontend/src/components/Student/StudentAssess.tsx` — **new file**, assessment mode
- `frontend/src/API/` — new API client functions

### You do NOT own (Claude is editing these — do not modify)
- `frontend/src/components/Student/StudentApp.tsx` — tab registration, layout, mobile
- `frontend/src/components/Auth/Auth.tsx` — guest/anonymous access
- `frontend/src/components/Student/StudentChat.tsx`
- `backend/score.py` — route registration only; Claude will mount your router
- `docker-compose.dev.yml`, deployment config

**If you need a new tab registered in `StudentApp.tsx`, do not edit it.** Export your component with a default export and state the props contract at the bottom of this file under "Integration Requests". Claude will wire it up.

---

## 2. Current Runtime State

### Stack (running locally via Docker)
```bash
cd "/Users/masonmines/VSCode Projects/CORA-test"
DOCKER_BUILDKIT=0 COMPOSE_BAKE=false docker compose -f docker-compose.dev.yml up --build -d
```

| Service | Container | URL |
|---|---|---|
| Frontend (Vite) | `frontend-dev` | http://localhost:8080 |
| Backend (FastAPI) | `backend-dev` | http://localhost:8000 |
| Neo4j | `neo4j-dev` | bolt://localhost:7687 (browser :7474) |
| Postgres | `postgres-dev` | localhost:5432 |

Neo4j creds: `neo4j` / `password`. Postgres: `cora` / `cora`, db `cora_users`.

### Two bugs already fixed — do not revert
1. **`backend/score.py`**: `load_dotenv(override=True)` → `load_dotenv()`.
   The `./backend` volume mount put `.env` inside the container, and `override=True` clobbered real container env vars — `POSTGRES_HOST=postgres` was being overwritten back to `localhost`, so Postgres connections died at startup. Real env must win over the file.
2. **`docker-compose.dev.yml`**: added `NEO4J_URI=bolt://neo4j:7687` to the backend service's `environment:` block.
   `backend/.env` says `bolt://localhost:7687`, which is correct for running uvicorn natively but wrong inside a container. Compose `environment:` beats `env_file:`, so the Docker path gets the service name and native runs are unaffected.

### ⚠️ The graph is currently EMPTY
`MATCH (n) RETURN count(n)` returns nothing. Ingestion of the 26 NE235 PDFs in `data/` is being kicked off separately. **Everything you build reads from this graph**, so until ingestion finishes you are coding blind — write your Cypher defensively and test against the graph once it populates.

---

## 3. Design Decisions (already settled — do not re-litigate)

These came from a direct requirements interview with Mason. They are decided.

| Decision | Choice | Notes |
|---|---|---|
| Concept/topic source | **Auto-derived from graph nodes** | Explicitly NOT a curated list. Mason wants the real final-version behavior, accepting that entity extraction may surface noisy nodes. Rank by connectivity. |
| Quiz format | **Multiple choice only** | No free response, no numeric problems. Deterministic auto-grading, no LLM judge. |
| Difficulty adaptation | **Mastery score per concept** | Running correct/attempts ratio per concept selects easy/medium/hard. Must be transparent/inspectable — Mason wants to show the number. |
| Guided lesson structure | **Fixed 4-beat template per concept** | Same four beats every time: (1) core idea, (2) how it works, (3) **PULSTAR-specific application**, (4) quick check. The PULSTAR connection is a guaranteed slot, not left to model discretion. |

---

## 4. Schema Facts You Need

### Neo4j (from the llm-graph-builder upstream ingestion pipeline)
Node labels and relationships actually used by this codebase:
- `Document` — has `status` property; completed docs are `{status:'Completed'}`
- `Chunk` — text chunks
- `__Entity__` — extracted entities (these are your **concept candidates**)
- Relationships: `HAS_ENTITY` (Chunk→Entity), `PART_OF` (Chunk→Document), `NEXT_CHUNK`, `FIRST_CHUNK`

Concept derivation should rank `__Entity__` nodes by degree/connectivity and pull their linked `Chunk` text as source material for lessons and questions.

### Postgres — existing table (do not alter columns)
```sql
CREATE TABLE app_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auth0_sub TEXT UNIQUE NOT NULL,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('student','ta','admin','test_full')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
Schema is created at startup by `ensure_users_table()` in `backend/src/user_store.py`, called from the FastAPI `startup` event in `score.py`. **Follow that same pattern** for your new tables — additive `CREATE TABLE IF NOT EXISTS` in the same module, called at startup. No migration framework is in use.

### ⚠️ Identity: accounts are NOT guaranteed
Claude is adding **anonymous guest sessions** so conference attendees can scan a QR code and use the app without an Auth0 account. This directly affects your schema design:

**Do not key progress tables to `app_users.id` or `auth0_sub` alone.** Use a nullable-auth subject key that works for both cases — e.g. a `learner_id TEXT` that holds either the Auth0 sub or an anonymous session UUID. A guest must be able to take a quiz and get adaptive difficulty. Claude will supply the anonymous ID from the frontend via the same mechanism as the auth token; see Integration Requests.

---

## 5. Your Tasks

### Task A — Concept spine (do this first; everything depends on it)
`GET /learning/concepts`
- Query Neo4j for `__Entity__` nodes ranked by connectivity
- Return: concept id, display name, and enough linkage to fetch source chunks later
- This replaces hardcoded topic lists in two places (currently duplicated in `StudentLearn.tsx` as `topics` and `StudentChat.tsx` as `suggestedPrompts`)
- Must return a sane empty response when the graph is empty, not a 500

### Task B — Progress schema + mastery
- New tables in `user_store.py` pattern (see identity warning above)
- Minimum shape: `(learner_id, concept_id, attempts, correct, last_seen)`
- Expose current mastery so the UI can display it

### Task C — Assessment mode
- `POST /learning/quiz/generate` — MCQ from a concept's chunks, difficulty-tagged, difficulty selected by that learner's mastery score
- `POST /learning/quiz/grade` — grade deterministically, write mastery back
- `frontend/src/components/Student/StudentAssess.tsx` — quiz UI + visible mastery
- Questions must be grounded in retrieved chunk text, not model general knowledge

### Task D — Guided learning mode
- `GET /learning/lesson/{concept_id}` — returns the 4 beats for that concept
- Rewrite `StudentLearn.tsx`: step-by-step navigation through the beats, not the current 6 static cards that fire a single chat prompt
- Beat 3 must explicitly tie to PULSTAR using retrieved content

### Styling
Follow `AGENTS.md` design tokens exactly — red-600 primary, rounded-full buttons, rounded-2xl cards. **Note the Tailwind gotcha:** preflight is DISABLED, so there is no global `box-sizing: border-box`. Add `box-border` or an explicit style on layout roots.

**Mobile matters.** Attendees will scan a QR code and open this on phones. Do not build fixed-width desktop layouts.

---

## 6. Gotchas

- `backend/.env` contains **real credentials** (OpenAI key, Auth0 config). Already gitignored. Never commit it, never echo it into logs.
- The repo is a fork of `neo4j-labs/llm-graph-builder` and is large. Mason's actual work is confined to `frontend/src/components/{Landing,Student,Auth}/` and `backend/src/{auth,user_store}.py`. Don't wander into upstream code.
- `DEFAULT_ROLE=student`, and roles live in Postgres, not Auth0. First login writes the row.
- Backend takes **several minutes** to start (large import tree). "No response on :8000" usually means still booting, not crashed — check `docker logs backend-dev`.
- Backend runs with `--reload`, so Python edits hot-reload; each reload pays that import cost again.
- Current branch: `student-frontend`, 6 commits ahead of origin, with substantial uncommitted work.

---

## 7. Integration Requests (fill this in for Claude)

When you need something wired into a file you don't own, append it here:

- **Assess tab registration**: state your component's default export path and props contract, and Claude will add it to `StudentApp.tsx`.
- **Router mounting**: state your APIRouter object and prefix, and Claude will mount it in `score.py`.
- **Anonymous learner ID**: Claude will expose the guest/auth subject to the frontend API layer; state what shape you want it delivered in.
