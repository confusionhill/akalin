# Future Plan

This document outlines planned features and improvements for the LLM Evaluation Pipeline Dashboard. It serves as a roadmap for future development and a reference for prioritizing work.

## Status Legend

- [ ] Not started
- [ ] In progress
- [x] Partially implemented
- [ ] Complete

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
  - Composed of the following sub-systems:

  - [ ] **3a. Human Review Queue**
    - After an evaluation run completes (Layer 1 + Layer 2 done), a reviewer opens each result and sees the test case input, expected output, generated output, and the LLM judge's score/reasoning side-by-side. The reviewer submits their own score (0.0–1.0), verdict (pass/fail/borderline), and free-text reasoning.
    - This is the core annotation interface — everything else builds on top of it.

  - [ ] **3b. Failure Tagging**
    - When reviewing, the human tags *why* a result failed using categorical chips (e.g. `tone`, `factual_error`, `incomplete`, `over_refusal`, `formatting`). Tags accumulate across reviews to surface patterns ("40% of failures are tone issues"), helping prioritize which prompt dimensions to fix first.

  - [ ] **3c. Agreement Dashboard (Judge Calibration)**
    - Compares human scores vs LLM judge scores across a reviewed run. Calculates an agreement rate (% where human and LLM judge agree on pass/fail). This is the article's core calibration loop — if agreement drops below ~85%, your rubric needs refinement. Directly answers: "Can I trust my Virtual Judge?"

  - [ ] **3d. Golden Dataset Management**
    - A dedicated UI to curate and manage a "golden set" of 50–100 labeled examples (including intentionally bad ones). These serve as the benchmark to calibrate Virtual Judges against. Users mark specific test case results as "golden" with their human-verified ground truth scores. The golden set is reusable across runs — re-run the judge against the golden set after rubric changes to measure improvement.

  - [ ] **3e. Multi-Reviewer & Inter-Rater Reliability**
    - Multiple reviewers can grade the same result independently. The system calculates inter-rater agreement (Cohen's kappa) to measure how consistently humans apply the rubric. If humans disagree, the rubric itself is ambiguous and needs fixing before automating anything. Per the article: *"if your experts disagree on a label, stop."*

  - [ ] **3f. Review Assignment & Workflow**
    - Formal assignment of results to specific reviewers with status tracking (unassigned → assigned → reviewed). Prevents cherry-picking and ensures full coverage. Adds management complexity but important at scale when multiple team members review.

  #### Layer 3 Flow

  ```
  Evaluation Run completes (Layer 1 + 2 done)
      │
      ▼
  User clicks "Request Human Review" on a completed run
      │
      ▼
  Run enters review queue (status: pending_review)
      │
      ▼
  Reviewer opens Review Queue ──────────────────────────────┐
      │                                                      │
      ▼                                                      │
  For each result:                                           │
  ┌─────────────────────────────────────────────┐            │
  │ See: input, expected, generated output,     │            │
  │      LLM judge score + reasoning, trace     │            │
  │                                             │            │
  │ Submit: human_score, verdict, reasoning     │            │
  │         + failure_tags (3b)                  │            │
  └──────────────────┬──────────────────────────┘            │
                     │                                       │
                     ▼                                       │
              Save human_review row                          │
                     │                                       │
                     ▼                                       │
              Next result ──────────────────────────────────►┘
                     │
                     ▼ (all results reviewed)
              Review complete
                     │
                     ▼
  ┌─────────────────────────────────────────────┐
  │ Agreement Dashboard (3c):                   │
  │   Human avg score vs LLM avg score          │
  │   Agreement rate (target: 85-90%)           │
  │   Disagreement highlights                   │
  │   Failure tag breakdown                     │
  └──────────────────┬──────────────────────────┘
                     │
                     ▼
  If agreement < 85% → Refine rubric → Re-run Layer 2
  If agreement ≥ 85% → Virtual Judge is calibrated ✅
  ```

- [ ] **Manual Review Workflow ("The Golden Rule")**
  - Streamlined UI for developers to manually inspect and annotate prototype outputs (~100 cases) to build failure mode intuition prior to creating automated evaluators.

---

## Notes

This document is a living roadmap. Features may be added, removed, or re-prioritized as the project evolves.