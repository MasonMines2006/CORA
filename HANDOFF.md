# CORA Handoff

## What this project is
CORA (Cognitive Operator Reactor Assistant) is a student-facing learning tool built on top of Neo4j's open-source `llm-graph-builder`. It ingests nuclear engineering course materials (PDFs, docs) into a Neo4j knowledge graph, then lets students query it via chat, explore the graph visually, and follow guided study paths. It's being developed by Mason Mines at UNC for potential presentation at NUTHOS-15 (Sep 2026).

## Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS v4, Vite — in `frontend/`
- **Backend**: Python 3.12, FastAPI, LangChain, Neo4j — in `backend/`
- **Database**: Neo4j (Aura cloud instance, credentials in `backend/.env`) + PostgreSQL (user profiles, optional)
- **Auth**: Auth0 (configured; `VITE_SKIP_AUTH=true` set in `frontend/.env` for local dev — bypasses login + Postgres)

**Run locally (no Docker):**
```bash
# Terminal 1 — backend
cd backend
source venv/bin/activate   # venv exists but deps NOT yet installed
pip install -r requirements.txt   # skip -c constraints.txt, it has a conflict
uvicorn score:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
yarn dev
```
Frontend → http://localhost:5173 · Backend → http://localhost:8000

**Known install issue**: `pip install -r requirements.txt -c constraints.txt` fails due to a torch version conflict in `constraints.txt`. Drop the `-c constraints.txt` flag and it installs fine.

## Current state
Mason's custom work sits on top of the upstream neo4j-labs/llm-graph-builder. The upstream is the admin app (graph ingestion pipeline, file upload, entity extraction). Mason added:
- `frontend/src/components/Landing/Landing.tsx` — polished public landing page (PULSTAR-branded, red color scheme, live NVL graph preview)
- `frontend/src/components/Student/` — authenticated student app with three tabs:
  - `StudentChat.tsx` — wired to the Chatbot component, PULSTAR-specific suggested prompts, auto-connects to Neo4j
  - `StudentExplore.tsx` — fetches real graph entities from `/graph_query` API on mount, falls back to demo graph if empty
  - `StudentLearn.tsx` — 6 PULSTAR topic cards (criticality, moderation, safety systems, etc.) that navigate to Chat with preloaded questions
- `frontend/src/components/Auth/Auth.tsx` + `Callback.tsx` — Auth0 integration with role-based routing (admin → `/app`, student → `/student`)
- `CLAUDE.md` — design tokens, component patterns, file structure (read this first)

**Changes made this session (all uncommitted):**
- Fixed suggested prompt click bug — prompts now actually fire via `pendingMessage` prop on Chatbot
- Connected `StudentExplore` to real Neo4j data via `graphQueryAPI`
- Extracted shared demo nodes/rels to `Constants.ts` (removed duplication between Landing + Explore)
- Rebuilt `StudentLearn` with real PULSTAR topics that fire into Chat
- Added `docker-compose.dev.yml` local Neo4j service + `neo4j_data` volume (for offline dev)
- Set `VITE_SKIP_AUTH=true` in `frontend/.env` for local dev
- Added 25 NE235 course PDFs to `data/` (Theory Manual, PULSTAR Tech Specs, 6 lab guides, homeworks, quizzes)

## Uncommitted work
All changes above are unstaged. Key files:
- `frontend/src/components/Student/` — entirely new directory (StudentApp, StudentChat, StudentExplore, StudentLearn)
- `frontend/src/components/ChatBot/Chatbot.tsx` — pendingMessage prop + handleSubmit override
- `frontend/src/types.ts` — added pendingMessage/onPendingMessageConsumed to ChatbotProps
- `frontend/src/utils/Constants.ts` — added landingDemoNodes/landingDemoRels exports
- `frontend/src/components/Landing/Landing.tsx` — imports from Constants instead of inline
- `data/*.pdf` — 25 NE235 course PDFs (untracked, should be gitignored or committed)
- `docker-compose.dev.yml` — added neo4j service + volume
- `backend/.env` — has real credentials (Neo4j Aura URI + password, OpenAI key) — DO NOT COMMIT

## What's next
Get the app running locally and ingest the NE235 PDFs:
1. Install backend deps (see above — drop `-c constraints.txt`)
2. `uvicorn score:app --reload` + `yarn dev`
3. Hit http://localhost:5173 — should land on the CORA landing page, skip auth (VITE_SKIP_AUTH=true)
4. Go to `/app` (admin) → upload PDFs from `data/` → run graph extraction
5. Then hit `/student` → Explore tab should show real PULSTAR graph nodes

After ingestion, consider exporting a Neo4j dump so the graph doesn't need to be re-ingested from scratch.

**Longer term:**
- Talk to Jason about NUTHOS-15 angle — is there an existing populated Aura instance?
- StudentExplore needs filtering/search (currently dumps all entities with no UX)
- StudentLearn topics are hardcoded — could be driven by the actual graph schema
- The "Coming soon" features (quizzes, flashcards) are worth scoping

## Key gotchas
- `VITE_SKIP_AUTH=true` is set — flip to `false` when testing real Auth0 login or showing to Jason
- `backend/.env` has real credentials — already in `.gitignore` presumably, but double-check before committing anything
- Korea navigation: use Naver Map + KakaoMap, NOT Google Maps (unreliable in Korea) — unrelated but it's in Mason's CLAUDE.md context
- The upstream repo (neo4j-labs/llm-graph-builder) is huge — Mason's work is isolated to `Landing/`, `Student/`, `Auth/` in frontend and `auth.py` + `user_store.py` in backend
- `CLAUDE.md` in the repo root has design tokens and component patterns — read before touching any UI

## How to start
```bash
cd "/Users/masonmines/VSCode Projects/CORA-test"
cat CLAUDE.md   # design system + architecture
git status      # see all uncommitted changes
```
First question to ask Mason: "Do you want to get the app running first, or keep building features?"
