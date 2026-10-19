# CORA demo runbook

A short checklist for running CORA end to end on your laptop: the landing page, the student
app, the admin app, and chat. Last checked: 2026-10-18.

> **Read "Known blockers" first.** As of 2026-10-18, chat, lessons and quizzes do not work
> until the OpenAI key is replaced, and students see an empty course until an admin
> publishes the documents.

---

## 1. Prerequisites

| You need | Why |
|---|---|
| Docker Desktop, running | All four services (frontend, backend, Neo4j, Postgres) run in containers |
| `backend/.env` and `frontend/.env` | Real credentials. They are gitignored, so they exist only on your machine. Never commit them or paste them anywhere |
| A **working OpenAI API key** in `backend/.env` | Every model CORA uses is OpenAI: chat, lessons and quizzes, plus the embeddings used to search the graph |
| An Auth0 login that has the `admin` role | Needed only for the admin app (`/app`, `/admin`). The student app works without one, in guest mode |

You do **not** need Neo4j Aura. The dev stack uses its own local Neo4j container (see
"Known blockers", item 3).

---

## 2. Start the stack

```bash
cd "/Users/masonmines/VSCode Projects/CORA-test"
open -a Docker                      # start Docker Desktop if it is not running
make dev                            # builds and starts everything, with logs in the foreground
```

`make dev` holds the terminal. To get your terminal back, use detached mode instead:

```bash
DOCKER_BUILDKIT=0 COMPOSE_BAKE=false docker compose -f docker-compose.dev.yml up --build -d
```

(`DOCKER_BUILDKIT=0` avoids an npm timeout during the frontend build. The Makefile
explains it.)

**Wait for the backend to finish booting.** It has a large import tree, so it can take
anywhere from under a minute to several minutes. If nothing answers yet, it is usually
still starting, not crashed.

```bash
curl http://localhost:8000/health           # expect {"healthy":true}
docker logs -f backend-dev                  # wait for "Application startup complete."
```

| What | URL |
|---|---|
| Landing page | http://localhost:8080/ |
| Student app (guest or logged in) | http://localhost:8080/student |
| Admin app (Auth0 login, admin role) | http://localhost:8080/app |
| Publish materials (admin) | http://localhost:8080/admin |
| Backend health | http://localhost:8000/health |
| Neo4j browser | http://localhost:7474 (the dev login is in `docker-compose.dev.yml`) |

To stop the stack, run `docker compose -f docker-compose.dev.yml down`. Your data is kept
in Docker volumes. **Do not add `-v`**: that deletes the volumes, which wipes the graph and
all user accounts.

---

## 3. Accounts and roles

- **Guest:** open `/student` without signing in. Nothing to set up. Guest chat is limited to
  `GUEST_CHAT_HOURLY_LIMIT` questions per hour (default 10).
- **Student / TA / Admin:** sign in with Auth0. Passwords are not stored in this repo, so
  ask Mason for the demo logins.
- **Roles are stored in Postgres, not in Auth0.** The first time someone logs in, they get
  `DEFAULT_ROLE` (set to `student`) from `backend/.env`. As of 2026-10-18 the local
  `app_users` table is **empty**, so whoever logs in first starts out as a student. To
  promote your own account to admin, log in once and then run:

  ```bash
  docker exec postgres-dev psql -U cora -d cora_users \
    -c "UPDATE app_users SET role='admin' WHERE email='YOUR_EMAIL';"
  ```

  Then reload the page. There is no role-editing screen in the frontend yet, so use the same
  command for other accounts (TA: `role='ta'`). The roles the backend checks are listed in `backend/score.py` (`ALLOWED_ADMIN_ROLES`,
  `ALLOWED_MANAGER_ROLES`).

---

## 4. Before the demo (one time)

1. **Make sure the OpenAI key works.** This call is free and spends no tokens. It prints
   only the HTTP status, never the key:

   ```bash
   docker exec backend-dev python -c "import os,requests;print(requests.get('https://api.openai.com/v1/models',headers={'Authorization':'Bearer '+os.environ['OPENAI_API_KEY']},timeout=15).status_code)"
   ```

   `200` means the key works. `401` means it does not (see blocker 1).
2. **Publish the course documents.** Students only see published material. Log in as an
   admin, open http://localhost:8080/admin, and publish the documents you want to show.
   All 26 NE235 documents are ingested but still in **draft**.
3. Open `/student` in a private window and check that **Concepts** and **Graph** show data.

---

## 5. Five-minute click path

1. **Landing (30 s).** Open http://localhost:8080/. Explain: CORA turns course PDFs into a
   knowledge graph and teaches from it.
2. **Student home (1 min).** Click **Get started**, or open `/student` directly. Show the
   dashboard: concept count, mastery colours, and the "pick up where you left off" card.
3. **Graph (1 min).** Open **Graph**. It shows the course map: concepts sized by how many
   passages mention them, with links between related concepts. Click a node.
4. **Concept → lesson → quiz (1.5 min).** From **Concepts**, open one concept. Step through
   the four-beat lesson (core idea, how it works, PULSTAR application, quick check), then
   take a short quiz and show the mastery number change.
5. **Chat (30 s).** Ask one question in the chat box, for example *"What is a neutron
   reflector?"*, and point out that the answer is grounded in the published course material.
   (Chat draws its answer with an animation that pauses in a background tab. If the bubble
   stays empty, bring the tab to the front.)
6. **Admin (30 s).** Logged in as admin, open `/admin` to show the publish/unpublish
   control, then `/app` to show the ingestion and graph tools.

---

## 6. Known blockers (as of 2026-10-18)

| # | Blocker | Effect | Fix (Mason) |
|---|---|---|---|
| 1 | **`OPENAI_API_KEY` in `backend/.env` is rejected by OpenAI** (`401 invalid_api_key`). The `LLM_MODEL_CONFIG_openai_*` entries use the same key | Chat, lessons, quizzes and question embeddings all fail. Pages load, but every AI feature errors | Create a new key in the OpenAI dashboard, then replace the value of `OPENAI_API_KEY` **and** the key at the end of each `LLM_MODEL_CONFIG_openai_*` line. Then run `docker compose -f docker-compose.dev.yml up -d --force-recreate backend` and repeat the check in step 4.1 |
| 2 | **No documents are published** (26 Completed, 0 published) | The student app shows 0 concepts, an empty graph, and chat has nothing to ground on | Publish from `/admin` as an admin (step 4.2) |
| 3 | Neo4j Aura instance `cora-test` is paused and will be deleted around 2026-10-20 | **None for the local demo.** `docker-compose.dev.yml` sets `NEO4J_URI=bolt://neo4j:7687`, the local `neo4j-dev` container, and `backend/.env` points at `localhost`. The graph lives in the `cora-test_neo4j_data` Docker volume | Nothing for the demo. Only matters for a future hosted deployment |
| 4 | Anthropic key `cora-test` expired 2026-10-17 (`ANTHROPIC_API_KEY`, and the `LLM_MODEL_CONFIG_anthropic_*` lines; it returns 401) | **None** as long as you only choose OpenAI models. `VITE_LLM_MODELS` limits the UI to `openai_gpt_4o_mini`, and `LEARNING_MODEL`, `INGESTION_MODEL` and `GRAPH_CLEANUP_MODEL` are all OpenAI | Leave it, or delete the `anthropic` lines so nobody selects them by mistake |
| 5 | Local `app_users` table is empty | The first Auth0 login starts as a student | Promote yourself (section 3) |
| 6 | Some font files return 404 | Cosmetic only. Text falls back to a system font | None needed |
