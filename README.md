# Akalin — LLM Prompt Evaluation Pipeline

> **Live at [akalin.space](https://akalin.space)**

An interactive platform to design, test, track, and grade LLM system prompts.

Akalin lets developers benchmark how different system prompts perform across a collection of test cases. Select target LLMs to generate answers, use evaluator LLMs to grade them against expected outputs (0.0–1.0 rubric scoring), set pass thresholds, and review full historical runs. It features Bring Your Own Key (BYOK) for any OpenAI-compatible LLM provider, a PostgreSQL-backed evaluation queue with cancellation support, and full audit tracking.

---

## Key Features

- **Prompt Versioning** — Track historical changes to system prompts and compare or revert previous revisions.
- **Custom Evaluation Rubrics** — Inject custom grading criteria (tone, formatting, accuracy, tool adherence) per project.
- **Bring Your Own Key (BYOK)** — Connect any OpenAI-compatible endpoint (Ollama, OpenRouter, Anthropic proxy, etc.) by configuring the base URL, API key, and custom HTTP headers.
- **Interactive Stack Tracing & Token Metrics** — Inspect the complete step-by-step lifecycle of target LLM executions (`User Input` → `AI Tool Call` → `Tool Result` → `AI Final Answer`) in a vertical timeline view with granular token consumption metrics (`in` / `out`) per step.
- **Mock Tool Calling & Blacklisting** — Create global mock tools with canned responses, assign them to projects, and selectively blacklist tools per evaluation run to test tool-calling decisions.
- **Tool Invocation Audit** — Track exactly which tools were called by the target LLM for every test case.
- **Background Evaluation Queue** — Evaluations run asynchronously via a PostgreSQL `FOR UPDATE SKIP LOCKED` queue with a configurable worker pool. Supports mid-run cancellation.
- **Pass Thresholds** — Define quality gates (e.g. average score ≥ 0.8) and automatically flag whether a run passed or failed.
- **User Profiles** — Unique handles, full names, and per-user settings (profile & password update).
- **Granular Auditing** — Tracks who created, modified, or executed every project, prompt, config, and evaluation run.

---

## Project Structure

```text
llm-evaluation-pipeline-dashboard/
├── backend/          # Go API server (Echo + sqlx + PostgreSQL)
├── frontend/         # React + Vite + TypeScript (Shadcn UI)
├── landing-page/     # Astro marketing site (akalin.space)
└── README.md         # This file
```

For setup, installation, and deployment instructions, refer to the READMEs in each directory:

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
