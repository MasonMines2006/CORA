# CORA permanent deployment

## Recommendation

Use a **Render Blueprint** for the first public deployment.

The root `render.yaml` describes one stack:

- `cora-web`: the React app on Render's static CDN
- `cora-api`: the FastAPI backend in a Docker container
- `cora-postgres`: managed PostgreSQL for users and learning state
- `cora-neo4j`: a private Neo4j service with a persistent disk

Render links the Blueprint to one Git branch. Each commit to that branch automatically
rebuilds only the affected services. Keep `production` as the deployment branch so normal
feature work does not immediately change the public site.

## Why this instead of the other project patterns?

### Senate

[Senate](https://github.com/cssgunc/senate) deploys FastAPI, Next.js, and SQL Server to
UNC CloudApps/OKD. Its CloudApps configuration includes persistent volume claims and an
OpenShift Git mirror/build trigger. A manual GitHub Actions workflow can call OpenShift
webhooks as a fallback. See Senate's
[CloudApps runbook](https://github.com/cssgunc/senate/blob/main/deploy/cloudapps/README.md)
and [deployment workflow](https://github.com/cssgunc/senate/blob/main/.github/workflows/deploy.yml).

That is a good institutional-production model, especially if NC State eventually offers
CORA managed Kubernetes/OpenShift. It is not the quickest first deployment because it
depends on university infrastructure, cluster access, and more operational knowledge.

### Peer2Peer

[Peer2Peer](https://github.com/cssgunc/peer2peer) does not currently define a production
deployment in its repository. Its
[CI workflow](https://github.com/cssgunc/peer2peer/blob/main/.github/workflows/ci.yml)
checks linting, types, migrations, backend tests, frontend tests, and the frontend build on
pushes and pull requests. CORA should copy that quality gate later, but CI alone does not
create a public application.

### Railway

Railway is the best second choice. It also supports GitHub auto-deploys, databases, private
networking, and persistent volumes. Its Hobby plan has a $5 monthly minimum that counts
toward usage, then bills actual RAM, CPU, disk, and egress. That can be cheaper for a quiet
demo, but its usage bill is less predictable and this four-service stack needs more manual
dashboard wiring. Render's one-file Blueprint is easier for another student developer or
agent to reproduce and audit.

## Before deploying

Do not deploy directly from a feature branch. First integrate the completed auth, model-tier,
and redesign work into a clean local `production` branch, run the full test suites, and then
push that branch only after Mason approves the push.

Required gates:

1. **Rotate the exposed Neo4j credential.** `backend/dbtest.py` previously contained a
   credential in tracked source. Removing it does not invalidate copies in Git history.
   Rotate it at Neo4j before the repository or deployment becomes public. Do not rewrite
   shared Git history without coordinating with every active checkout.
2. Replace the rejected OpenAI key. Test only the status code from `GET /v1/models`; never
   print the key.
3. Confirm the deployment commit includes the guest-model tier (merged into
   `demo/friday-readiness` as `deee0f9`) and configure its provider variables. Without that
   code, guest AI calls can still use the paid OpenAI path.
4. Finish or deliberately retain the current Auth0 setup. The present branch still needs
   Auth0 values; the planned in-house auth work will replace them.
5. Run backend tests, frontend tests, and the frontend production build on the exact commit
   that will become `production`.
6. Decide which approved course documents may leave the laptop. The cloud Neo4j database
   starts empty; local Docker volumes are not pushed with Git.

## One-time Render setup

These steps create billable external resources. Review Render's price estimate before the
last step.

1. Push an approved `production` branch to GitHub.
2. In Render, choose **New → Blueprint** and connect
   `MasonMines2006/CORA-test`.
3. Select the `production` branch and the root `render.yaml` file.
4. Supply the prompted secrets:
   - `OPENAI_API_KEY` for `cora-api`
   - `AUTH0_DOMAIN` for `cora-api` while Auth0 is still present
   - `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` for `cora-web` while Auth0 is still present
5. Review the resources and monthly estimate, then deploy the Blueprint.
6. If Auth0 is retained temporarily, add the new `cora-web` URL to Auth0's allowed callback,
   logout, and web-origin lists. The callback path is `/callback`.

Render generates and shares the Neo4j password internally. It also supplies the private
Postgres connection string. Neither secret belongs in Git.

The selected compute sizes favor reliability over the smallest possible bill. The backend
and Neo4j each receive 2 GB RAM because CORA loads an embedding model and Neo4j is a JVM
database. The frontend is static. The Postgres instance and Neo4j disk are persistent.

The backend image is intentionally large (about 1.39 GB in the local verification build).
It contains CPU-only PyTorch, OCR tools, LibreOffice, document parsers, and the local
embedding model. A first build or a cold rebuild will therefore take several minutes; do
not remove those packages without checking the ingestion formats CORA still promises to
support.

## Seed the public course

The first deploy has empty Neo4j and Postgres databases. This is intentional: code pushes
must never silently copy local student, course, or credential data to a third party.

For the Friday showcase, the simplest safe path is:

1. Confirm the 17 approved demo documents are allowed on Render.
2. Sign in as an administrator after auth is ready.
3. Ingest those documents into the production graph with the configured model.
4. Publish the intended subset.
5. Verify that a guest sees only published material and that admin-only endpoints still
   reject guests.

Exporting the existing local Neo4j database would be faster and cheaper than regenerating
it, but it needs a separate reviewed migration because a database dump may contain more
than the published corpus. Do not upload the whole local volume by default.

## Verification after each deployment

Check these in order:

1. `https://<cora-api-host>/health` returns a healthy response.
2. The `cora-web` URL loads and a hard refresh on `/student` still returns the SPA.
3. A guest can list published concepts and cannot reach admin routes.
4. An authorized user can sign in and retain the expected role.
5. One grounded question returns an answer with the expected source behavior.
6. Render shows healthy Postgres and Neo4j connections with no restart loop.

## Automatic updates and rollback

`autoDeployTrigger: commit` means a push to the linked `production` branch starts a deploy.
Render keeps the previous deployment available for rollback in its dashboard. If a release
is bad, roll the affected service back first, then revert the bad Git commit so the branch
and the running service agree.

Code rollback does not roll database data back. Before a risky content migration, make an
explicit PostgreSQL backup and Neo4j database dump. Render disk snapshots are useful for
filesystem recovery, but Render warns against treating a custom database's disk snapshot
as its normal database backup method.

## Current security baseline

The Blueprint deliberately includes a small but important baseline:

- HTTPS is terminated by Render.
- The dev-login bypass is hard-disabled in production.
- PostgreSQL has no public IP allowlist entries.
- Neo4j is private, password-protected, and reachable only over Render's private network.
- Secrets are generated by Render or entered through its dashboard, never committed.
- The frontend sends basic clickjacking, MIME-sniffing, referrer, and browser-permission
  headers.

Before broad public use, add CI-gated deploys, restrict backend CORS to the public frontend,
add login and guest rate limits from the auth/model-tier work, automate database backups,
and add monitoring/alerts. If in-house auth uses cookies, correct CORS and cookie settings
are a launch blocker, not an optional hardening task.
