---
title: 'Introducing Tool Mocking & Function Calling Evaluation in Akalin'
description: 'Systematically test how your LLMs utilize tools, handle function calling responses, and adhere to tool usage instructions.'
pubDate: '2026-08-05'
heroImage: '/tools-mock.png'
---


# Tool Mocking for LLM Evaluation

As AI applications evolve from simple text completion to complex autonomous agents, **tool calling (function calling)** has become an essential building block. However, evaluating whether an LLM invokes tools correctly—and refrains from calling them when unnecessary—is notoriously difficult.

Today, we are excited to release **Tool Mocking & Blacklisting** in Akalin!

---

## The Challenge with Evaluating Tool-Calling LLMs

When benchmarking prompt revisions for tool-aware LLMs, developers encounter two major pain points:

1. **Unpredictable External Effects**: Executing live tool APIs (e.g. sending emails, making database updates, or executing live code) during automated benchmark runs creates undesirable side effects and rate limits.
2. **Instruction Adherence Verification**: Prompts often specify rules such as *"Only call `get_weather` if the location is explicitly provided, otherwise ask for clarification."* Verifying if the model adheres to these boundaries requires isolating tool access.

---

## How Tool Mocking Works in Akalin

Akalin now supports native, end-to-end tool mocking:

### 1. Global Tool Catalog
Define reusable tool schemas with function names, descriptions, and mock outputs (supporting both plain text and JSON responses).

### 2. Project-Level Assignment
Select a subset of global tools to make available for your specific evaluation projects.

### 3. Run-Level Tool Blacklisting
When launching an evaluation run, selectively blacklist specific tools. This allows you to test fallback behaviors (e.g. how the LLM responds when a tool is unavailable or disabled).

### 4. Native OpenAI Function Calling Interception
During evaluation, Akalin passes tools via the native `tools` array parameter to OpenAI-compatible endpoints. When the model emits a `tool_calls` request, Akalin automatically intercepts the call, returns your mock result, and records the exact tools invoked per test case.

---

## Get Started Today

Mock tool support is available immediately in the latest release of **Akalin**. Update your installation to start building reliable, tool-augmented LLM pipelines with confidence!

[Explore Akalin Documentation](https://github.com/confusionhill/akalin)
