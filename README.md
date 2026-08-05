# LLM System Prompt Evaluation Dashboard

An interactive platform to design, test, track, and grade LLM system prompts. 

This project allows developers to benchmark how different system prompts perform across a collection of test cases. You can select target LLMs to generate answers, use evaluator LLMs to grade them against expected outputs (0.0 - 1.0 rubric), set pass thresholds, and review historical runs. It features Bring Your Own Key (BYOK) for OpenAPI-compatible LLM providers and full audit tracking (who ran what, and when).

---

## Key Features

- **Prompt Versioning**: Tracks historical changes to system prompts so you can revert or compare previous revisions.
- **Custom Evaluation Prompts (Rubrics)**: Inject custom grading criteria (e.g. grading specifically for tone, formatting, or accuracy) rather than just a single static rubric.
- **Bring Your Own Key (BYOK)**: Connect any OpenAI-compatible endpoint (like local Ollama, custom OpenAI endpoints, or OpenRouter) by configuring the base URL, plain text API keys, and custom HTTP headers.
- **Mock Tool Calling & Blacklisting**: Create global mock tools with schemas and canned responses, assign them to projects, and selectively blacklist specific tools per evaluation run to test LLM tool-calling decisions and instruction adherence.
- **Tool Invocation Audit**: Track which tools were invoked by the target LLM for every single test case run.
- **Granular Auditing**: Tracks who created, modified, or executed each project, prompt, configuration, and evaluation run.
- **Pass Thresholds**: Define quality thresholds (e.g. average score must be >= 0.8) and flag whether runs or individual test cases passed or failed.
- **Asynchronous Polling**: Executes evaluations in the background, updating the UI via a status polling mechanism.


---

## Project Structure

```text
llm-evaluation-pipeline-dashboard/
├── backend/          # Go API server (Echo + sqlx + PostgreSQL)
├── frontend/         # React + Vite + TypeScript (Shadcn UI)
└── README.md         # This file
```

For setup, installation, and deployment instructions, refer to the README files in the respective directories:
- [Backend README](file:///Users/dika/Documents/github/llm-evaluation-pipeline-dashboard/backend/README.md)
- [Frontend README](file:///Users/dika/Documents/github/llm-evaluation-pipeline-dashboard/frontend/README.md)
