## Overview

Akalin is an open-source LLM System Prompt Evaluation Pipeline Dashboard designed to systematically benchmark prompts, manage custom rubrics, BYOK provider endpoints, and intercept mock function calling.

## Workspace Subdirectories

- `backend/`: Go (Echo + sqlx + PostgreSQL) REST API and async evaluation engine.
- `frontend/`: React 19 + Vite + TypeScript + Shadcn UI dashboard application.
- `landing-page/`: Astro 5 static landing page, blog, and documentation site.

## Development

Spin up full infrastructure using Docker Compose:

```bash
docker compose up -d --build
```

Run subprojects individually:

```bash
# Backend (Go)
cd backend && go run ./cmd/server

# Frontend (React)
cd frontend && npm run dev

# Landing Page (Astro)
cd landing-page && npm run dev
```

## Verification & Build Commands

```bash
# Backend build
cd backend && go build ./...

# Frontend typecheck & build
cd frontend && npm run typecheck && npm run build

# Landing page build
cd landing-page && npm run build
```

## Documentation

- GitHub Repository: https://github.com/confusionhill/akalin
- Project Guide: [README.md](README.md)
- Backend Guide: [backend/README.md](backend/README.md)
- Frontend Guide: [frontend/README.md](frontend/README.md)
