.PHONY: dev install backend frontend stop

# Docker-based dev (hot reload for both services in containers)
# BuildKit's isolated build network intermittently can't reach the npm
# registry from inside `yarn install` (fails with ESOCKETTIMEDOUT); the
# classic builder uses the host's normal Docker network and doesn't hit this.
dev:
	DOCKER_BUILDKIT=0 COMPOSE_BAKE=false docker compose -f docker-compose.dev.yml up --build

# Install backend (venv) + frontend (yarn) deps
install:
	cd backend && python3 -m venv venv && . venv/bin/activate && pip install -r requirements.txt
	cd frontend && yarn install

# Run backend natively (foreground) — Ctrl+C to stop
backend:
	cd backend && . venv/bin/activate && uvicorn score:app --reload --port 8000

# Run frontend natively (foreground) — Ctrl+C to stop
frontend:
	cd frontend && yarn dev

# Kill any stray backend/frontend dev processes (uvicorn, vite)
stop:
	-pkill -f "uvicorn score:app"
	-pkill -f "vite"
