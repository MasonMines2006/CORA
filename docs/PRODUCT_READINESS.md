# CORA Product Readiness — 2026-10-19

## Verdict

**Phase 1 is complete. The Friday product is not yet showcase-ready.**

The published-corpus boundary, course-neutral learning content, chat-session ownership,
fail-closed dev login, paid-metric authorization, and whole-course dashboard counts are
implemented and covered by tests. The local stack has a usable published corpus.

The main product phases still outstanding are in-house authentication and model tiers,
the approved redesign implementation, and Playwright coverage. The configured OpenAI key
currently returns HTTP 401, so Chat, generated lessons, and generated quizzes cannot work
until Mason replaces it and recreates the backend container.

## Branch and repository state

- Branch: `demo/friday-readiness`
- Phase 1 base: `student-frontend`
- Phase 1 implementation contains 16 local commits from `88ac834` through `638d504`;
  this readiness report is committed separately.
- Nothing was pushed, and no pull request was opened.
- `docs/STUDENT_UI.md` is Mason's pre-existing uncommitted edit. Do not stage it.
- `docs/redesign/` is a completed but uncommitted design artifact awaiting Mason's approval.

## What Phase 1 completed

- One server-enforced published-material boundary for student concepts, graph, sources,
  lessons, quizzes, review cards, suggestions, and Chat retrieval.
- Admin-only access for paid `/metric` and `/additional_metrics` calls.
- A local-only dev login that requires both `DEV_AUTH_BYPASS=true` and
  `APP_ENV=development`, rejects invalid/disabled bypass attempts, and is absent from the
  production-style Compose file.
- Course-neutral generated lesson copy and suggested Chat prompts.
- Chat histories keyed to the verified learner and published-corpus revision; clearing a
  conversation reaches only that learner's exact history.
- Whole-course counts from Neo4j rather than totals inferred from the dashboard's ranked
  sample.
- Real relationship types restored in concept-neighbour responses.
- A local published demo corpus: 17 documents, 282 distinct passages, and 1,231 concepts.

## Verification evidence

| Check | Result | Evidence |
|---|---|---|
| Backend suite in Docker | PASS | 232 tests passed: `python -m unittest discover -s tests -p 'test_*.py' -t .` |
| Frontend suite | PASS | 99 tests passed across 14 files: `yarn test` |
| Course-size focused tests | PASS | 16 tests passed: `ConceptIndex.test.tsx` and `StudentHome.test.tsx` |
| Frontend production build | PASS | `yarn build` completed after TypeScript and Vite compilation |
| Pre-commit hook | PASS WITH NOTE | The hook passed on final fixes `3c8b87e` and `638d504`; the stopped agent reported bypassing it on one test commit, then ran Prettier with no remaining changes |
| Published dashboard smoke test | PASS | Guest dashboard returned 17 documents, 282 passages, and 1,231 concepts |
| Published concept discovery | PASS | `/learning/concepts?limit=3` returned concepts grounded in published documents |
| OpenAI credential check | FAIL | `GET /v1/models` returned HTTP 401; no key value was printed |
| Full frontend lint | FAIL (legacy debt) | 69 warnings in pre-existing upstream files; no errors and none in the Phase 1-owned files |
| Coverage threshold | NOT MEASURED | The repository does not currently have a working coverage gate configured for both stacks |

### Non-blocking warnings observed

- Two `StudentExplore` tests log React `act(...)` warnings while still passing.
- The production build warns about unresolved runtime font URLs, one nested CSS rule,
  mixed static/dynamic imports, and large bundles.
- Neo4j reports deprecation and unknown-property notifications during live Cypher tests;
  the tests still pass, but these should be cleaned up after Friday-critical work.

## Remaining Friday-critical work

1. Replace Auth0 with CORA-issued credentials and JWTs, including allowlist activation,
   the open-enrollment toggle, admin-issued reset links, roles, account deactivation, and
   the guarded dev-login equivalent.
2. Add configurable guest/signed-in LLM tiers. Guests use an OpenAI-compatible free model
   plus local embeddings; signed-in users use OpenAI.
3. Have Mason approve `docs/redesign/prototype/index.html`, then implement the phased plan
   in `docs/redesign/DESIGN.md`.
4. Add Playwright flows for enrollment on/off, login, admin invite/publish/reset, and all
   three learning modes. Mock the LLM except for one budget-capped smoke test.
5. Resolve the learner-safe citation/source endpoint, then verify inline citations end to
   end.
6. Update the demo/runbook documentation after the new auth and UI settle.

## Coordination boundary

Use `~/Documents/llm-vault/Projects/CORA/Handoff — 2026-10-19 Product Push.md` as the
source of truth for active ownership. Only one writer should touch auth or frontend files
at a time. Separate agents should work in separate worktrees or on non-overlapping files,
and each agent should record its exact file ownership in the handoff before editing.

## Recommended next action

Mason should first replace the OpenAI key and approve or revise the redesign. After that,
assign one writer to Phase 2 auth/model tiers. Do not start redesign implementation in a
second checkout while Phase 2 still owns shared frontend auth and API files.
