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

You can start the entire backend stack along with PostgreSQL using Docker Compose. The database schema will be automatically injected on startup via the `init.sql` script.

From the repository root or the `backend/` folder, run:

```bash
docker compose up -d --build
```

This spins up:
- **PostgreSQL container**: Configured with the alpine distribution, automatically executing schema setup.
- **Go API server**: Running on local port `8080`.

*(Alternatively, you can run the Go binary locally with `go run cmd/server/main.go` after starting PostgreSQL manually).*

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
