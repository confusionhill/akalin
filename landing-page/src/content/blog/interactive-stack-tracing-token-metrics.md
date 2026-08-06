---
title: 'Demystifying LLM Agent Executions with Interactive Stack Tracing & Token Metrics'
description: 'Inspect the complete step-by-step lifecycle of LLM agent executions, tool calls, and token metrics with Akalins interactive vertical timeline view.'
pubDate: '2026-08-06'
heroImage: '/tools-mock.png'
---

# Demystifying LLM Agent Executions with Interactive Stack Tracing & Token Metrics

Building reliable LLM applications and agentic pipelines requires transparency. When an agent fails a benchmark test case, engineers are often left asking: *Did the model fail because of bad reasoning, incorrect tool selection, invalid tool arguments, or context exhaustion?*

To answer these questions, we are excited to release **Interactive Stack Tracing & Token Metrics** in Akalin!

---

## The Challenge: The Black Box of Multi-Turn LLM Tools

When testing an LLM equipped with function calling capabilities, execution isn't a simple single-turn prompt-and-response. Instead, it follows an iterative loop:

1. **User Prompt**: The initial prompt sent to the LLM.
2. **AI Tool Call Decision**: The LLM analyzes the user prompt and decides to invoke one or more tools (e.g., `get_weather(location="San Francisco")`).
3. **Tool Execution & Feedback**: The backend executes the tool and feeds the result back into the LLM context.
4. **Iterative Turns**: The LLM may call additional tools or perform intermediate reasoning.
5. **AI Final Answer**: The LLM compiles the final response presented to the end user.

Without stack tracing, evaluation dashboards only reveal the final output and score. Debugging root causes becomes a tedious exercise in manual logging inspection.

---

## Solution: Step-by-Step Vertical Execution Timelines

Our Stack Tracing feature records every hop along the target LLM's execution pathway and renders it as an interactive, vertical timeline in the evaluation results dashboard.

```
[ User Input ]
       │
       ▼
[ AI Tool Call: get_weather ] ── (150 in | 35 out tokens)
       │
       ▼
[ Tool Result: get_weather ] ── (Returns {"temperature": 72, ...})
       │
       ▼
[ AI Final Answer ] ──────────── (210 in | 45 out tokens)
```

### Key Highlights:

### 1. Granular Per-Step Token Consumption
Every API turn captures prompt (`in`) and completion (`out`) token metrics. This allows developers to immediately identify which turn consumed excess context window or caused token inflation.

### 2. Collapsible Interactive Nodes
To keep the evaluation UI sleek and uncluttered:
- The timeline is hidden by default under a **Show Timeline** toggle button.
- Developers can click on any individual step header (`User Input`, `AI Tool Call`, `Tool Result`, `AI Final Answer`) to expand or collapse function arguments, mock tool responses, and raw outputs.

### 3. Clear Separation of Target Flow & Evaluation Grading
Evaluation rubrics and grading reasoning are kept cleanly separated from the target execution trace. The timeline strictly reflects what the user and the agent experienced, providing an unadulterated trace of agent behavior.

---

## Get Started Today

Interactive Stack Tracing & Token Metrics is available immediately in **Akalin**. Run a new evaluation test case to start diagnosing tool calls, intermediate arguments, and token costs with complete confidence!

[Explore Akalin Documentation](https://github.com/confusionhill/akalin)
