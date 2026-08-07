# LLM System Prompt Evaluation — Backend

The backend of Akalin is built with **Go** and the **Echo** web framework. It provides a RESTful API, orchestrates multi-turn LLM agent execution, tracks execution step trace steps and token usage, executes background worker jobs using a PostgreSQL queue, auto-calibrates evaluation rubrics, and enforces user authentication and domain decoupling.

---

## Architecture & Package Structure

The backend uses a decoupled, clean domain service architecture (`internal/service/<domain>`):

```text
backend/
├── cmd/
│   └── server/          # Entrypoint (main.go)
├── config/              # App environment configuration loader
└── internal/
    ├── db/              # Database connection & schema setup
    ├── middleware/      # Auth & HTTP middlewares
    ├── models/          # Shared domain structs, DTOs, JSONB scanners
    ├── validator/       # Echo custom validator bridge
    └── service/         # Domain services (Handler -> Usecase -> Repository)
        ├── auth/        # User authentication & profile management
        ├── evaluation/  # Evaluation run orchestration & preset configs
        ├── evaluator/   # Core LLM client (completions, tools, memory, tracing)
        ├── llmmodel/    # Tenant LLM model registry & connectivity tests
        ├── project/     # Project workspace management
        ├── prompt/      # System prompt & evaluation prompt versioning
        ├── provider/    # BYOK LLM provider configurations
        ├── rubric/      # Rubric auto-refinement & calibration
        ├── testcase/    # Test case dataset CRUD
        ├── tool/        # Mock tool calling registry
        └── worker/      # Async evaluation worker pool (FOR UPDATE SKIP LOCKED)
```

---

## Core Capabilities

- **LLM Core Behavioral Parameter Support** — Configurable `Temperature`, `Top-P`, `Top-K`, and `Max Tokens` serialized via JSONB in database tables (`evaluation_configs`, `evaluation_runs`) and applied dynamically to target model completions.
- **Auto-Refine & Rubric Calibration Meta-LLM** — Asynchronous meta-LLM engine (`GenerateRefinedRubric`) generating evaluation rubrics from baseline CSV datasets or low-scoring execution runs.
- **Agent Execution Tracing & Token Audit** — Multiturn function calling loop supporting tools, tracing each step (`user_input`, `tool_call`, `tool_output`, `ai_answer`), and recording prompt, completion, and total tokens.
- **Async PostgreSQL Queue & Worker Pool** — Concurrent worker pool fetching jobs via `FOR UPDATE SKIP LOCKED` with mid-run cancellation support.
- **Bring Your Own Key (BYOK)** — Supports any OpenAI-compatible provider endpoint with configurable custom HTTP headers and API key authorization.
- **Programmatic & LLM Scoring Layers** — Dual-layer evaluation combining JSON format validation (Layer 1) with rubric LLM grading (Layer 2).

---

## Requirements

- **Go**: 1.22 or higher
- **PostgreSQL**: 15 or higher (or Docker)
- **Docker & Docker Compose**: For local containerized development and quick-start postgres.

---

## Setup & Local Development

### 1. Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=8080
DATABASE_URL="postgres://postgres:postgres@localhost:5433/llm_eval?sslmode=disable"
JWT_SIGNING_KEY="dev-secret-key-change-this-in-production"
```

### 2. Run with Docker Compose (Recommended)
From the repository root:
```bash
docker compose up -d --build
```

This spins up:
- **PostgreSQL container** (`llm-eval-db`): Port 5433, automatically running `init.sql` schema migration and seeding mock data.
- **Go API server** (`llm-eval-backend`): Local port `8080`.

### 3. Run Locally (Go compiler)
1. Ensure your PostgreSQL database is running and executed against `init.sql`.
2. Download dependencies:
   ```bash
   go mod tidy
   ```
3. Start the server:
   ```bash
   go run cmd/server/main.go
   ```

---

## Code Quality & Testing

To compile and verify code formatting and vet rules:
```bash
go build ./...
go vet ./...
```

---

## Deployment

Build a production container image using the multi-stage Dockerfile:
```bash
docker build -t llm-eval-backend:latest .
```
