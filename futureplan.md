# Future Plan

This document outlines planned features and improvements for the LLM Evaluation Pipeline Dashboard. It serves as a roadmap for future development and a reference for prioritizing work.

## Status Legend

- [ ] Not started
- [ ] In progress
- [ ] Partially implemented
- [x] Complete

## Features

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

- [ ] User permissions & audit logs
  - Track who created/edit each evaluation and why

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

- [ ] Integration with other tools
  - Connect with CI/CD pipelines, Slack, Notion, etc.

### v2.0 - Three-Layered Eval-Driven Development (EDD)

Inspired by Airbnb's *"Eval-driven development: Lessons from evaluating GenAI at scale"*:

- [/] **Layer 1: Programmatic Checks (Deterministic First-Pass Filtering)**
  - Fast, format-based validation rules (JSON validity, Plain Text) to filter obvious errors before invoking expensive LLM evaluators.
  - [ ] **Custom Code Programmatic Checks**: Support custom Python / JavaScript code snippets for programmatic assertion checks.

- [x] **Layer 2: LLM-as-a-Judge & Calibration against Golden Datasets**
  - Implement Virtual Judges with strict, unambiguous rubrics.
  - Add a **Judge Calibration System**: benchmark Virtual Judges against a curated "Golden Dataset" (including bad examples) to target an 80–90% human agreement score.

- [ ] **Layer 3: Human Evaluation & Annotation Interface**
  - High-resource human review workflow to grade outputs, establish ground truth, resolve edge cases, and continuously calibrate Virtual Judges.

- [ ] **Manual Review Workflow ("The Golden Rule")**
  - Streamlined UI for developers to manually inspect and annotate prototype outputs (~100 cases) to build failure mode intuition prior to creating automated evaluators.

---

## Notes

This document is a living roadmap. Features may be added, removed, or re-prioritized as the project evolves.