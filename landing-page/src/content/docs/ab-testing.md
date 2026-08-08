---
title: "A/B Testing & Prompt Versioning"
description: "Decouple prompt management from backend code and run weighted traffic splits across prompt variants."
---

# A/B Testing & Prompt Versioning

Akalin allows engineering teams to decouple system prompts from application codebases. Instead of hardcoding prompt strings, your backend services dynamically request active prompt variants at runtime via REST API.

---

## Key Capabilities

- **Decoupled Prompt Management**: Update system prompt versions in the dashboard without code redeployments.
- **Weighted Traffic Splitting**: Route traffic percentages (e.g., 80% to Stable `v1.1.0`, 20% to Experimental `v1.2.0`).
- **Instant Rollback**: Dial back failing prompt variants to 0% traffic instantly.

---

## 1. Fetching Active System Prompts

Your backend service calls the Akalin REST API endpoint to retrieve the active system prompt content:

```javascript
const response = await fetch("https://api.akalin.space/v1/projects/PRJ_ID/active-prompt", {
  headers: {
    "Authorization": "Bearer ak_live_YOUR_API_KEY"
  }
});

const data = await response.json();
const activeSystemPrompt = data.content;
```

---

## 2. Configuring Traffic Distribution

In the Akalin Dashboard:
1. Navigate to **Projects** -> Select your Project.
2. Click **System Prompts** -> **Configure A/B Traffic Split**.
3. Set your target traffic weights across active prompt versions.
4. Click **Save Traffic Rules**.
