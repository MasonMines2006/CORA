# CORA Handoff

**Updated:** 2026-09-18
**Branch:** `student-frontend` — 18 commits ahead of origin, **50 files uncommitted**
**Target:** NUTHOS-15 conference demo (Sep 2026). Attendees scan a QR code and use the
student app anonymously, on phones.

Read `CLAUDE.md` (Claude) / `AGENTS.md` (Codex) first — they are byte-identical and carry
the design tokens, dev gotchas, and a pointer to `docs/STUDENT_UI.md`.

---
## 0. Resume point — Claude Code, 2026-09-18 07:00 EDT

Picked up Codex's handoff (its own resume note is preserved in git history). Its slice was
verified, two blocking bugs were found and fixed, and the honesty problems on Home were
corrected. Everything below is **uncommitted**.

### Verified, not assumed

| Check | Result |
|---|---|
| Backend suite | **45 tests pass** (`docker exec backend-dev sh -c "cd /code && python -m unittest discover -s tests -p 'test_*.py' -t ."`) |
| Frontend tests | 6 pass across 4 files (`yarn vitest run src/components/Student/`) |
| `tsc --noEmit` | clean |
| `eslint src/components/Student` | clean (it was **not** clean when Codex stopped — 6 errors in its own new files) |
| `yarn build` | passes |
| Browser QA | done at 1280x900 and 390x844, which is what Codex stopped short of |

### The two blocking bugs QA found

Both were in the Graph tab, which Codex's handoff described as working ("search and node
inspection already work against the bounded API"). It returned **HTTP 503**.

1. **Invalid Cypher in `_CONCEPT_NETWORK_QUERY`.** `ORDER BY` / `LIMIT` are sub-clauses of
   the `WITH` above them and must precede that `WITH`'s `WHERE`; the query had `WHERE` then
   `ORDER BY`, which Cypher rejects outright. Fixed with a second `WITH` to order and
   truncate on. The 42-test suite stayed green through this because the unit test hands
   `get_concept_network` a fake graph whose `query()` ignores the Cypher string entirely.
   New test: `backend/tests/test_learning_cypher_syntax.py` runs `EXPLAIN` over every
   `*_QUERY` constant against the live database.

2. **`Neo4jGraph(sanitize=True)` was deleting the results.** That option drops any list in
   a result holding more than 128 elements, to strip embedding vectors. The course-map
   query returns nodes and relationships as two lists, so the relationships vanished
   entirely past 128 of them — HTTP 200, no error, 120 unconnected dots on screen — and
   past 128 concepts the node list went too, emptying the map. Now `sanitize=False`: every
   query in that module returns explicit scalar projections and never a raw node, so it was
   protecting nothing. New test: `backend/tests/test_learning_network_live.py`.

   The Graph tab now renders **120 concepts and 204 connections**.

### Honesty fixes on Home

Both were versions of the anti-pattern in `docs/STUDENT_UI.md` section 3.3 — inventing data
rather than stating what is known.

- The continue card hardcoded `Step 3 of 4 - PULSTAR application` and filled 3 of 4 beat
  segments, next to a progress ring reading **0%**. Nothing persists lesson position, so
  the beat bar is removed until it does; the subline now shows real mastery
  (`N of M correct - difficulty`) or, for an unstarted concept, `N sources - M passages`.
  The CTA reads "Start lesson" rather than "Resume lesson" when nothing has been started.
- The review card computed `Math.max(1, Math.min(4, started_concepts || 1))`, so every
  guest was told "1 cards due for review" before studying anything, with no schedule behind
  it. It now reads "Review what you have studied" until review intervals actually persist.

### Mobile tab bar was 20px tall

`h-20` rendered the bar at **20px**, clipping every label off-screen. Cause: the NDL preset
extends `theme.spacing` with a px scale matching Tailwind's at every key except `20`, which
it sets to `20px` instead of `5rem`/80px. Now `h-[74px]` to match the artboard, with
`pb-[74px]` on `<main>` so content clears it. Measured after the fix: 74px bar, 78x73px
touch targets, labels visible. **This bug class is live elsewhere** — `py-20` on the landing
page renders 20px where the design tokens call for 64-96px. Documented in `CLAUDE.md`.

Also removed the superseded `StudentHome.tsx` (Codex's item 7; nothing imported it —
`StudentApp` and the test both import `StudentHomeArtboard`). Restore with
`git checkout HEAD -- frontend/src/components/Student/StudentHome.tsx` if needed.
Added `backend/tests/__init__.py` so `unittest discover` can find the suite.

### Still open, in priority order

1. **Concept hub.** Still four peer tabs (Lesson / Practice / Cards / Sources) with no
   concept header, no Graph mode, and no right rail. The artboard's structure — concept as
   the page, five modes on it — is the one large piece not yet built. See
   `docs/artboards/png/Concept-*.png`, one per mode.
2. **Review / Flashcards.** `StudentReview.tsx` is a route wrapper over the older
   two-rating tool. The artboard wants progress + time estimate, answer reveal, four
   Again/Hard/Good/Easy buttons **with their intervals printed**, session counters and a
   queue rail. Needs real scheduling state keyed on `learner_id`; nothing persists intervals
   today, which is also what blocks a truthful "cards due" count on Home.
3. **Explore parity.** Nodes render but are not coloured by mastery or sized by passage
   count, and the left type/document filters and Neighbourhood / Whole course toggle are
   missing. The graph also does not zoom to fit — nodes clip at the edges.
4. **Make the scoped "Ask CORA" affordances interactive.** Visual only today.
5. **Persisted lesson position**, which restores the beat bar and the "Step N of 4" line.

### Smaller things found during QA — all now fixed

- **Home promised 50 concepts, the Concepts tab listed 18.** Both screens now read
  `/learning/dashboard`, so they cannot disagree. The rail reads "0 of 50 started".
- **19 requests to draw one concept list** (`/learning/concepts` plus one
  `/learning/mastery/{id}` per concept). The dashboard already joins mastery to every
  concept, so it is one request now — measured in the running app.
- **Review was titled "Course review"** when opened on a concept, because the component
  skipped the fetch that carries the name. Verified: it now reads "Reactivity review".
- **An unset `LEARNING_MIN_CONCEPT_CONNECTIVITY` warned on every request.** Blank and
  unset take the default silently; only a malformed value warns.
- **The frontend suite logged a ref warning on every run** — from the test's own NVL
  mock, not from `StudentExplore`. The mock forwards refs now.

Verification after these: 47 backend tests, 10 frontend tests, `tsc` and `eslint` clean.

## 1. Current state: everything works locally

Stack runs via Docker:

```bash
cd "/Users/masonmines/VSCode Projects/CORA-test"
DOCKER_BUILDKIT=0 COMPOSE_BAKE=false docker compose -f docker-compose.dev.yml up --build -d
```

| Service | URL |
|---|---|
| Student app | http://localhost:8080/student |
| Landing page | http://localhost:8080/ |
| Backend | http://localhost:8000 |
| Neo4j browser | http://localhost:7474 (`neo4j` / `password`) |

**Graph is populated:** 26 NE235 PDFs, 314 chunks (all embedded, 1536-dim OpenAI),
1,797 entities. Vector + fulltext indexes exist.

**Verified working end to end:** Learn (4-beat lessons), Assess (adaptive MCQ + mastery),
Explore (bounded course map, 120 concepts / 204 connections), Chat (grounded answers with
sources). 45 backend tests pass; `tsc`, `eslint` (0 errors) and `yarn build` are green —
all re-run 2026-09-18 07:00, see section 0.

---

## 2. What was fixed (2026-09-17 → 18)

Four silent failures, none of which produced an error message:

1. **Entity extraction returned zero entities for every document.**
   `LLMGraphTransformer` ran with `ignore_tool_usage=True`, parsing entities out of model
   prose instead of a tool-call schema; combined with `ADDITIONAL_INSTRUCTIONS` the model
   drifted off the expected JSON and the parse failure was swallowed. Every ingest
   "succeeded" with chunks but no concepts. Fixed in `backend/src/llm.py`, covered by
   `backend/tests/test_graph_transformer_config.py`.
2. **Blank white page.** `VITE_CHAT_MODES` being set pushed `Constants.ts` onto a branch
   that calls a `Utils.ts` function at module-eval time, and `Utils.ts` imports
   `Constants.ts` — circular import, TDZ crash. Moved the function into `Constants.ts`.
3. **All borders and shadows were dead app-wide.** `@neo4j-ndl/base` ships an *unlayered*
   Tailwind preflight that outranks Tailwind's `@layer utilities`, so `border`, `shadow-*`,
   `p-*` and `bg-*` silently produced nothing. Fixed by importing NDL into a named cascade
   layer in `src/index.css`. Separately, the NDL preset replaces `theme.boxShadow`, which
   deleted the whole `shadow-*` scale — restored via `@theme` in `index.css`.
4. **Explore showed a fake 6-node graph.** `JSON.stringify(undefined)` put the literal
   string `"undefined"` in the request body; the backend returned HTTP **200** with a
   `"Failed"` payload, and the component only had `.catch()`, which never fires on a 200.
   Fixed, and the demo-data fallback removed.

Also: concept list filtered of extraction noise, Learn tab rebuilt as a working two-column
layout, vector index rebuilt at the correct dimension, chat/ingestion/lesson models moved
off Anthropic (no credit) onto OpenAI.

---

## 3. Known issues

| Issue | Severity | Notes |
|---|---|---|
| `/app` admin route 404s in Docker dev | Medium | Container WORKDIR `/app` collides with the route. Fix = change WORKDIR. Ingest via `backend/ingest_pdfs.py` instead. |
| Explore takes ~25 s | Medium | Graph query expands every chunk/entity per document; limited to 3 documents. Needs a scoped backend query. |
| "Ne235 Reactor Operations" still in concept list | Low | Its labels give no evidence it's a course name. Hard-code the string if it bothers you. |
| PyTorch/NumPy version warning | Low | Noisy only. `torch`, `transformers`, `cv2`, `onnxruntime` (~1.4 GB) are unused — embeddings are OpenAI. Dropping them would halve the deploy image. |
| Backend swallows `None` in `QA_integration` | Low | Turns real LLM errors into "Something went wrong". |

---

## 4. Costs and credentials

- **Budget is in OpenAI** (~$10). The Anthropic account has **no credit** — do not point
  anything at `anthropic_*` models or it will fail with a 400.
- Models in use: ingestion `openai_gpt_4o_mini`, lessons/quizzes `openai_gpt_4o`,
  chat `openai_gpt_4o_mini` (~$0.0008/question).
- Spent so far: roughly **$1**, mostly two full ingestion runs. A re-ingest is ~$0.50.
- `backend/.env` and `frontend/.env` hold real credentials and are gitignored. Never commit
  or echo them.
- Guest chat is rate-limited by `GUEST_CHAT_HOURLY_LIMIT` (default 10/hour/guest).

---

## 5. Next steps, in priority order

1. **Commit.** ~40 files of work from two agents sit uncommitted. Do this first.
2. **Get a public URL.** Nothing is tunnelled. A Cloudflare *named* tunnel (not a quick
   tunnel, which dies with its process) is the lowest-risk option for the conference —
   the stack stays warm, so there is no cold-start problem. Bring a hotspot.
3. **Post-conference: deploy properly.** Render works, but not the free tier — the backend
   takes minutes to boot, and a spun-down service behind a QR code is a failed demo. Use a
   paid always-on instance, **Neo4j AuraDB Free** for the graph (Render has no managed
   Neo4j), and slim the dependencies first.
4. **Build the redesign.** `docs/STUDENT_UI.md` + `docs/artboards/` hold the agreed
   direction: Home dashboard → Explore search/filter → concept-first hub → flashcards →
   source viewer.

---

## 6. Design direction

`docs/STUDENT_UI.md` is the source of truth. Visual reference: the five annotated
artboards now live in [`docs/artboards/`](docs/artboards/README.md) — PNGs, standalone
HTML, and a written build spec. The hosted canvas that was linked here is deleted.

Core decision: **the concept is the unit of navigation**, not the tab. Learn / Practice /
Cards / Graph / Sources become modes on a concept, so the knowledge graph drives navigation
instead of sitting in its own tab.

---

## 7. Debugging lesson worth keeping

Every major bug this session was **silent** — no error, no warning, classes present in the
DOM, endpoints returning 200. The habit that actually found them: **measure, don't read.**
`getComputedStyle` on a probe element, the raw network response body rather than the
rendered text, and `curl` against the live endpoint. Re-reading the source would not have
found any of them.
