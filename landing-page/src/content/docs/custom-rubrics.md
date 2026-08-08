---
title: "Custom Rubrics & Auto-Calibration"
description: "Inject custom LLM-as-a-Judge grading rubrics and auto-calibrate prompts using Meta-LLM pipelines."
---

# Custom Rubrics & Auto-Calibration

Akalin replaces subjective "vibes-based" prompt testing with normalized 0.0 to 1.0 scoring metrics evaluated by LLM-as-a-Judge models.

---

## 1. Creating Custom Evaluation Rubrics

Define scoring criteria with explicit pass/fail conditions:
- **Tone & Style Compliance**: Evaluate formality, brand alignment, and conciseness.
- **Format Verification**: Ensure responses strictly adhere to requested JSON schemas or markdown structures.
- **Safety & Constraint Enforcement**: Verify that blacklisted topics or unauthorized tool invocation attempts are prevented.

---

## 2. Meta-LLM Auto-Calibration

Akalin features automated rubric generation:
- **CSV Dataset Calibration**: Upload baseline training datasets to generate new evaluation rubrics automatically.
- **Low-Score Auto-Refinement**: Analyze historical low-scoring evaluation runs to produce edge-case resilient rubric prompts.
