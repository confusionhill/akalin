---
title: "Getting Started with Akalin"
description: "Learn how to set up the Akalin LLM Evaluation Pipeline Dashboard locally."
---

# Getting Started

Welcome to Akalin, an interactive platform to design, test, track, and grade LLM system prompts. 

This guide covers how to get the backend and frontend running locally.

---

## Prerequisites

Before you begin, ensure you have the following installed:
- **Go**: 1.22 or higher
- **Node.js**: 20 or higher (LTS recommended)
- **Docker & Docker Compose**: (Recommended) For local containerized database and backend.

---

## 1. Environment Setup

Create a `.env` file in the `backend/` directory with the following values:

```env
PORT=8080
DATABASE_URL="postgres://postgres:postgres@localhost:5433/llm_eval?sslmode=disable"
JWT_SIGNING_KEY="dev-secret-key-change-this-in-production"
```

---

## 2. Start the Backend

There are 3 options available for building and running the backend server:

### Option 1: Use Docker Compose (Recommended)
Spins up both the PostgreSQL container (with automatic schema seeding via `init.sql`) and the Go backend API container:

```bash
docker compose up -d --build
```

- **PostgreSQL**: Running on local port `5433` (or `5432`).
- **Go Backend API**: Running on local port `8080`.

---

### Option 2: Build via Dockerfile
If you already have a PostgreSQL instance running, you can build and run the standalone Docker image for the Go API server:

```bash
cd backend
docker build -t akalin-backend .
docker run -p 8080:8080 --env-file .env akalin-backend
```

---

### Option 3: Build Go by yourself
For direct local Go development:

1. Ensure PostgreSQL is running and schema from `backend/init.sql` has been executed.
2. Run the Go server directly:

```bash
cd backend
go run ./cmd/server
```

*(Or compile a production binary: `go build -o server ./cmd/server` and execute `./server`)*


---

## 3. Start the Frontend

The frontend is a React + Vite application. 

1. Navigate to the `frontend/` directory.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. (Optional) Configure the Backend API URL:
   Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_BASE_URL="http://localhost:8080/api"
   ```
   *(If not set, it defaults to `/api` which is proxied locally to `http://localhost:8080`)*

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   
The dashboard will typically be available at `http://localhost:5173`. Open this URL in your browser to start evaluating prompts!
