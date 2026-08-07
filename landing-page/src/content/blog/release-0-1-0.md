---
title: 'Syukuran Release v0.1.0 — Database is Stable & Our First Major Milestone!'
description: 'Celebrating the official release of Akalin v0.1.0! Featuring database schema stability, full-featured multi-tenancy, join tokens with expiration, and our roadmap to v1.0.0 including Agent CLI.'
pubDate: '2026-08-08'
heroImage: '/dashboard-preview.png'
draft: false
---

# Syukuran Release v0.1.0 — Database is Stable & Our First Major Milestone! 🎉

Today is a big day for Akalin! We are thrilled to celebrate the release of **Akalin v0.1.0** — our very first major milestone release! 🥳

Building a comprehensive prompt evaluation pipeline hasn't been a walk in the park, but today we celebrate a major landmark: **our database schema is now rock-solid and stable**. 

Whether you are designing system prompts, benchmarking tool-calling agentic pipelines, or fine-tuning evaluation rubrics, you can now rely on Akalin for stable database persistence and seamless evaluation workflows.

---

## 🛢️ Milestone Unlocked: Database Schema Stability

With **v0.1.0**, the core database architecture has matured into a stable foundation. 

All core domain tables—from `evaluation_configs` and `evaluation_runs` to `rubric_drafts`, `provider_configs`, `tools`, `system_prompts`, and `test_cases`—are fully specified with PostgreSQL migration scripts and native JSONB compatibility layers. Your prompt data and evaluation history are safe and sound!

---

## 🚀 Everything Packed in Release v0.1.0

Akalin v0.1.0 brings together our complete suite of prompt engineering and LLM evaluation tools in one unified platform:

### 🎛️ Advanced Core Behavioral Parameters
- **Model Tuning Control** — Configure `Temperature`, `Top-P`, `Top-K`, and `Max Tokens` per evaluation preset or individual run.
- **Rubric Calibration Tuning** — Apply custom behavioral parameters to Meta-LLMs during automated rubric calibration.
- **Toggleable UI & Run Auditing** — Easily toggle advanced settings on demand in the dashboard and inspect configured behavioral parameters on completed run details pages.

### 🪄 Auto-Refine & Rubric Calibration
- **CSV Dataset Calibration** — Auto-generate custom evaluation rubrics from baseline training dataset CSVs.
- **Low-Score Meta-LLM Auto-Refinement** — Automatically analyze historical low-scoring evaluation runs to produce refined, edge-case-resilient evaluation prompts.

### 🔍 Interactive Stack Tracing & Token Metrics
- **Vertical Execution Timelines** — Step-by-step visual lifecycle tracing for agentic tool workflows (`User Input` → `AI Tool Call` → `Tool Output` → `AI Final Answer`).
- **Granular Token Metrics** — Real-time prompt (`in`), completion (`out`), and total token consumption breakdown per step.

### 🛠️ Mock Tool Calling & Blacklisting
- **Global & Project Tool Management** — Define global mock tools with custom parameters and mock outputs, and map them to projects.
- **Per-Run Tool Blacklisting** — Toggle active tools on or off per evaluation run to test LLM tool-calling decision-making and fallbacks.

### ⚙️ Evaluation Presets & Config Management
- **Reusable Pipeline Presets** — Save and reload pipeline configurations (System Prompt, Evaluation Rubric, Target Provider & Model, Evaluator Provider & Model, Pass Threshold, and Advanced Settings).
- **Quality Gates** — Configurable pass/fail score thresholds (e.g., average score ≥ 0.8) with visual run status indicators.

### 🔑 Bring Your Own Key (BYOK) & Model Catalog
- **OpenAI-Compatible BYOK** — Connect any provider (OpenAI, OpenRouter, Ollama, Anthropic proxy, local vLLM) with custom Base URLs, API Keys, and Custom Headers.
- **LLM Model Registry** — Tenant-level catalog of saved models with built-in connectivity test tools.

### ⚡ Async Background Queue & Cancellation
- **PostgreSQL Worker Pool** — Asynchronous evaluation runner powered by PostgreSQL `FOR UPDATE SKIP LOCKED` locking for high concurrency.
- **Mid-Run Cancellation** — Cancel pending or running evaluation jobs in real-time.

### 🔐 Multi-Tenant Workspace & Join Token System
- **M:N Multi-Tenancy** — Create or join multiple independent workspaces, and switch active workspace sessions on demand directly from the sidebar.
- **Self-Hosted Join Tokens** — Administrators can generate unique join tokens bound to user emails, making team onboarding easy for self-hosted deployments.
- **Configurable Expiration & Custom Picker** — Set join token expiration periods using presets (1 day, 3 days, 1 week, 30 days) or a custom date and hour picker.
- **Role Enforcement & Security** — Manage user permissions (`Owner`, `Admin`, `Member`) with strict logic checks (e.g. Admins cannot delete other Admins/Owners).
- **Clean Service Architecture** — Decoupled Go package structure (`internal/service/<domain>`) following a strict `Handler -> Usecase -> Repository` pattern.

---

## 🏁 Roadmap: What Does Release v1.0.0 Look Like?

While **v0.1.0** celebrates **Database Stability**, our ultimate vision for **v1.0.0 (General Availability)** is complete end-to-end stability across all technical pillars, alongside dedicated agentic tooling:

1. **API Stability** — Strict semantic versioning for all RESTful API endpoints, guaranteed backward compatibility, and full OpenAPI documentation.
2. **Database Stability** — Battle-tested zero-downtime database migrations, automated schema verification, and backup hooks.
3. **Frontend Stability** — Pixel-perfect UI/UX polish, complete responsiveness, accessibility compliance, and end-to-end (E2E) automated browser test coverage.
4. **CLI for Agent Interaction** — Dedicated CLI tool enabling AI coding agents and automated workflows to interact directly with Akalin (triggering runs, pulling results, and calibrating rubrics programmatically).

When **API**, **Database**, and **Frontend** reach full production stability together with the **Agent CLI**, Akalin will officially launch **v1.0.0**!

Thank you to everyone testing and building with Akalin. Enjoy Release v0.1.0! 🥳🥂
