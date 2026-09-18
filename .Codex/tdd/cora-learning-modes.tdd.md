# CORA Learning Modes — TDD Evidence

## User journeys

- A visitor can open the student experience without Auth0 and receives a stable, namespaced guest learner identity.
- A signed-in student keeps their verified Auth0 subject as the learner identity.
- Guided Learn lists graph-derived concepts, explains one concept at a time, shows PULSTAR connections, includes a quick check, and records mastery.
- Assess creates a three-question adaptive quiz, grades it deterministically, shows explanations and sources, and advances difficulty from visible mastery.
- A single public origin serves the frontend and proxies learning API calls, so the QR link works from another device.
- Missing or malformed learner identity is rejected, and existing protected user/admin routes remain protected.

## RED evidence

Command:

```text
PYTHONDONTWRITEBYTECODE=1 ./venv/bin/python3 -m unittest discover -s tests -p 'test_learning_*.py' -v
```

Initial result: four identity tests errored with `AttributeError: module 'src.auth' has no attribute 'get_learner'`. The three mastery-policy tests passed, confirming that the new tests specifically exposed the missing guest/authenticated identity contract.

## GREEN evidence

The same command now passes all seven tests:

```text
Ran 7 tests in 0.004s
OK
```

Covered behavior:

- verified Auth0 subjects become learner IDs;
- valid UUID v4 guest IDs become `guest:<uuid>` learner IDs;
- missing and malformed guest identity returns HTTP 401;
- new learners start at easy;
- mastery percentages are exposed;
- difficulty changes at explicit thresholds.

## Additional verification

- Frontend production build: passed (`yarn build`).
- Scoped ESLint for every changed frontend file: passed.
- Backend OpenAPI exposes all five `/learning` routes.
- PostgreSQL contains `learner_mastery`, `learning_content_cache`, and `quiz_sessions`.
- Public same-origin guest request to `/api/learning/mastery/demo-concept`: HTTP 200.
- Invalid guest request: HTTP 401.
- Guest request to existing protected `/users`: HTTP 401.
- Browser QA confirmed the public Student shell and the Learn/Assess empty-graph states.
- `git diff --check`: passed.

## Known gaps and blockers

- OpenAI currently returns `429 credit_balance_exhausted`; generated lessons, quizzes, and Chat cannot complete until credits are restored.
- Neo4j currently has no course concepts, so Learn and Assess correctly show their empty states until ingestion succeeds.
- Anonymous access is intentionally limited to `/learning`; legacy Chat and Explore endpoints remain Auth0-protected pending an explicit cost/abuse decision.
- The quick Cloudflare tunnel is temporary and depends on this laptop, Docker, and the tunnel process staying online.
- The backend environment warns that installed PyTorch was built against NumPy 1.x while NumPy 2.5.2 is installed. Tests pass, but dependency compatibility should be repaired before a durable deployment.
- No automated browser test currently covers a narrow mobile viewport; responsive layout was implemented with wrapping/scrolling navigation and mobile-first grids.
