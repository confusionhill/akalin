# Future Plan

This document outlines planned features and improvements for the LLM Evaluation Pipeline Dashboard. It serves as a roadmap for future development and a reference for prioritizing work.

## Status Legend

- [ ] Not started
- [ ] In progress
- [x] Partially implemented
- [ ] Complete

## Release Milestones

### v0.1.0 — Current (Database Stability)
- [x] Database schema stability (`evaluation_configs`, `evaluation_runs`, `rubric_drafts`, `provider_configs`, `tools`, etc.)
- [x] Advanced Core Behavioral Parameters (`Temperature`, `Top-P`, `Top-K`, `Max Tokens`)
- [x] Auto-Refine & Rubric Calibration Meta-LLM
- [x] Interactive Stack Tracing & Token Metrics
- [x] Mock Tool Calling & Blacklisting Controls
- [x] Async PostgreSQL Worker Queue with `FOR UPDATE SKIP LOCKED`
- [x] BYOK Provider & LLM Model Catalog

### v1.0.0 — Target (General Availability)
- [ ] **CLI for Agent Interaction**
  - Command Line Interface enabling AI coding assistants (Cursor, Antigravity, Claude Code, Aider) and automated agentic loops to interact programmatically with Akalin.
  - Commands for triggering evaluations, pulling run results, inspecting stack traces, and calibrating rubrics via CLI.
- [ ] **API Stability** — Strict semantic versioning and full OpenAPI specs.
- [ ] **Database Stability** — Battle-tested zero-downtime database migrations.
- [ ] **Frontend Stability** — Pixel-perfect UI/UX polish and comprehensive E2E test coverage.

## Detailed Feature Roadmap

### v1.1 - Enhancement

- [x] Model tracking per evaluation
  - Store which model was used for each evaluation run
  - Display model information in the UI so users can see which model performed better

- [x] Visual comparison charts
  - Side-by-side scoring tables or trend line charts over time
  - Performance summary cards with progress bars showing average scores per model
  - Interactive tooltips showing detailed information

- [ ] Export to CSV/JSON
  - Export evaluations, test cases, or full results for reporting or external analysis

- [ ] Model versioning
  - Track which model, provider, and API version was used per evaluation

- [ ] Duplicate evaluation
  - Clone an existing run to create a new one with same config

- [ ] Saved comparisons
  - Save custom comparison tables and re-use

### v1.2 - Core

- [ ] Scheduled evaluations
  - Run periodic evaluations automatically (cron-style)

- [ ] Multi-user Tenant Management & Member Invitations
  - Support inviting multiple users to a shared tenant workspace with role-based access control.

- [ ] User permissions & audit logs
  - Track who created/edited each evaluation and why

- [ ] Rate limiting & API keys
  - Per-project or per-tenant limits on API calls

- [ ] Beta test groups
  - A/B testing setups for new models or prompts

- [ ] Global settings
  - Tenant-level defaults (e.g., max retry count, timeout, cost limits)

### v1.3 - Infrastructure

- [ ] Caching layer
  - Cache results and reduce redundant API calls

- [ ] Multi-region deployments
  - Deploy to multiple geographic regions