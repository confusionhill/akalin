# LLM System Prompt Evaluation - Backend

The backend of the LLM System Prompt Evaluation Dashboard is built using Go and the Echo web framework. It exposes a RESTful API, handles project and configuration persistence, orchestrates LLM calls for evaluation, tracks multi-turn execution stack traces and token usage, and manages PostgreSQL using `sqlx` (without an ORM) and validates payloads using `go-playground/validator/v10`.

---

## Requirements

- **Go**: 1.22 or higher
- **PostgreSQL**: 15 or higher (or Docker)
- **Docker & Docker Compose**: For local containerized development and quick-start postgres.

---

## Setup & Local Development

### 1. Environment Variables
Create a `.env` file in this directory (or set environment variables) with the following values:
```env
PORT=8080
DATABASE_URL="postgres://postgres:postgres@localhost:5433/llm_eval?sslmode=disable"
JWT_SIGNING_KEY="dev-secret-key-change-this-in-production"
```

### 2. Run with Docker Compose (Recommended)
You can start the entire backend stack along with PostgreSQL (Alpine-based) using Docker Compose. The database schema will be automatically injected on startup via the `init.sql` script.

From the repository root or the backend folder (depending on where docker-compose config is placed):
```bash
docker compose up -d --build
```
This command spin up:
- **PostgreSQL container**: Configured with the alpine distribution, automatically executing schema setup and seeding mock data.
- **Go API server**: Re-building and running on local port `8080`.

### 3. Run Locally (Go compiler)
If you prefer running the Go binary locally against a local database instance:
1. Make sure your database exists and run the tables defined in `init.sql` against it.
2. Download dependencies:
   ```bash
   go mod tidy
   ```
3. Start the server:
   ```bash
   go run cmd/server/main.go
   ```

---

## Testing
To run Go unit and integration tests (when tests are added):
```bash
go test -v ./...
```

---

## Deployment
For production builds, use the multi-stage Dockerfile:
```bash
docker build -t llm-eval-backend:latest .
```
This builds a minimal, alpine-based image containing only the compiled Go binary.
