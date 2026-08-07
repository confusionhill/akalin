# Akalin — LLM Prompt Evaluation Pipeline

> **Check at [akalin.space](https://akalin.space)**

Akalin is an enterprise-grade interactive platform designed to build, benchmark, track, and auto-refine LLM system prompts and agentic tool workflows.

Akalin allows developers to test system prompts across test cases, evaluate model outputs with custom rubrics (scored 0.0–1.0), tune model-level behavioral parameters, track step-by-step tool invocation stack traces with token consumption, auto-calibrate evaluation rubrics via meta-LLMs, and run evaluations asynchronously with a PostgreSQL-backed worker queue.

---

## Key Features

### 🎛️ Advanced Core Behavioral Parameters
- **Fine-Grained Parameter Tuning** — Configure `Temperature`, `Top-P`, `Top-K`, and `Max Tokens` per evaluation preset or individual run.
- **Rubric Calibration Tuning** — Apply custom behavioral parameters to Meta-LLMs during automated rubric calibration.
- **Toggleable UI & Run Auditing** — Toggle advanced settings on demand in the frontend dashboard and inspect configured behavioral parameters on completed run detail pages.

### 🪄 Auto-Refine & Rubric Calibration
- **CSV Data Calibration** — Auto-generate new evaluation rubrics from baseline training dataset CSVs.
- **Low-Score Meta-LLM Auto-Refinement** — Automatically analyze historical low-scoring evaluation runs to produce refined, edge-case-resilient evaluation prompts.

### 🔍 Interactive Stack Tracing & Token Metrics
- **Vertical Execution Timelines** — Step-by-step visual lifecycle tracing for agentic tool workflows (`User Input` → `AI Tool Call` → `Tool Output` → `AI Final Answer`).
- **Granular Token Metrics** — Real-time prompt (`in`), completion (`out`), and total token consumption breakdown per step.

### 🛠️ Mock Tool Calling & Blacklisting
- **Global & Project Tool Management** — Define global mock tools with custom parameters and mock outputs, and map them to projects.
- **Per-Run Tool Blacklisting** — Toggle active tools on or off per evaluation run to test LLM tool-calling logic and fallback behavior.

### ⚙️ Evaluation Presets & Config Management
- **Reusable Pipeline Presets** — Save and reload pipeline configurations (System Prompt, Evaluation Rubric, Target Provider & Model, Evaluator Provider & Model, Pass Threshold, and Advanced Settings).
- **Quality Gates** — Configurable pass/fail score thresholds (e.g., average score ≥ 0.8) with visual run status indicators.

### 🔑 Bring Your Own Key (BYOK) & Model Catalog
- **OpenAI-Compatible BYOK** — Connect any provider (OpenAI, OpenRouter, Ollama, Anthropic proxy, local vLLM) with custom Base URLs, API Keys, and Custom Headers.
- **LLM Model Registry** — Catalog of saved models with built-in connectivity test tools.

### ⚡ Async Background Queue & Cancellation
- **PostgreSQL Worker Pool** — Asynchronous evaluation runner powered by PostgreSQL `FOR UPDATE SKIP LOCKED` locking for high concurrency.
- **Mid-Run Cancellation** — Cancel pending or running evaluation jobs in real-time.

### 🔐 Auth & Account Isolation
- **Authentication & Security** — User registration, JWT authentication, user account isolation, and profile management (profile details & password updates).
- **Granular Audit Trails** — Track creation and modification history for prompts, presets, test cases, tools, and evaluation runs.

---

## 🏁 Version Milestones & Roadmap

- **v0.1.0 (Current)** — **Database Schema Stability**: Core database architecture and domain models are stable and locked in.
- **v1.0.0 (Target)** — **Full Production Stability & Agent CLI**:
  - **API Stability**: Semantic versioning and fully specified OpenAPI schemas.
  - **Database Stability**: Battle-tested zero-downtime migrations.
  - **Frontend Stability**: Pixel-perfect UI/UX and comprehensive E2E test coverage.
  - **CLI for Agent Interaction**: Command Line Interface allowing AI coding assistants and autonomous agents to trigger runs, fetch evaluation results, and calibrate rubrics programmatically.

---

## Architecture

Akalin uses a decoupled, clean service-oriented architecture:

```text
llm-evaluation-pipeline-dashboard/
├── backend/          # Go API server (Echo + sqlx + PostgreSQL)
│   ├── cmd/server/   # API entrypoint
│   └── internal/
│       ├── db/       # Database connection & schema setup
│       ├── middleware/# Auth & HTTP middleware
│       ├── models/   # Shared domain entities & DTOs
│       ├── validator/# Custom validator bridge
│       └── service/  # Clean domain services (auth, evaluation, evaluator, llmmodel, project, prompt, provider, rubric, testcase, tool, worker)
├── frontend/         # React + Vite + TypeScript + Shadcn UI
└── landing-page/     # Astro marketing website (akalin.space)
```

---

## Quick Start

For detailed setup, local development, and deployment guides, refer to:

- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
