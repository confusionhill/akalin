---
title: "Mock Tool Calling & Blacklisting"
description: "Define global mock tools and toggle per-run tool blacklisting to test model tool selection."
---

# Mock Tool Calling & Blacklisting

Test whether your LLM system prompt accurately invokes required function tools—and avoids blacklisted tools—without hitting production databases or external APIs.

---

## 1. Global & Project Mock Tools

Create mock tools with custom parameters and sample JSON outputs:
- Define parameter schemas (`string`, `number`, `boolean`, `object`).
- Set mock response payloads for isolated evaluation runs.

---

## 2. Per-Run Tool Blacklisting

During evaluation setup:
- Toggle specific tools **OFF** (Blacklisted).
- Verify if the model gracefully handles missing tools or fallback paths without hallucinating invalid tool calls.
