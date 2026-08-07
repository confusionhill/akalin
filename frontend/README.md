# LLM System Prompt Evaluation — Frontend

The frontend provides a state-of-the-art, interactive web interface built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Shadcn UI**.

It features real-time evaluation dashboarding, prompt version management, rubric calibration modals, preset configuration tools, and an interactive **Vertical Execution Timeline** with step-by-step stack tracing and token metrics.

---

## Key Features

- **Interactive Vertical Stack Tracing** — Visual step-by-step timeline of multi-turn LLM agent execution steps (`User Input`, `AI Tool Call`, `Tool Output`, `AI Final Answer`) with per-step token counts (`in`/`out`).
- **Core Behavioral Parameters UI** — Toggleable **Advanced Settings** form fields (`Temperature`, `Top-P`, `Top-K`, `Max Tokens`) for evaluation presets, evaluation runs, and rubric calibration.
- **Run Metadata Display** — Completed run detail pages display active advanced settings badges alongside score summaries and format checks.
- **Auto-Refine & Rubric Calibration Modals** — Calibration wizard to generate rubrics from CSV dataset uploads or historical low-scoring evaluation runs.
- **Mock Tools & Blacklisting Controls** — Interface to manage project tools and toggle per-run tool blacklisting to test model tool-selection logic.
- **Preset Configurations Manager** — Modal interface to save, edit, reload, and delete reusable pipeline presets.
- **Prompt Versioning Interface** — Immutability-enforced prompt version history for system prompts and evaluation rubrics.
- **BYOK Provider & Model Management** — Management interfaces for BYOK provider configurations (custom headers, API keys, endpoints) and LLM model catalogs with test connection tools.
- **User Profile & Settings** — User settings dialogs for profile name updates and password changes.

---

## Requirements

- **Node.js**: 20 or higher (LTS recommended)
- **Package Manager**: npm, pnpm, or Yarn
- **Vite**: Installed via project dependencies
- **React**: 18+ with TypeScript support

---

## Setup & Local Development

1. **Install dependencies**:
   ```bash
   npm install   # or pnpm install / yarn install
   ```

2. **Configure Environment Variables** (Optional):
   Create a `.env` file in the `frontend/` directory:
   ```env
   VITE_API_BASE_URL="http://localhost:8080/api"
   ```
   *(If not set, Vite proxies `/api` to `http://localhost:8080`)*

3. **Start Development Server**:
   ```bash
   npm run dev   # Runs Vite dev server (typically http://localhost:5173)
   ```

---

## Building for Production

To compile and build an optimized production bundle:
```bash
npm run build   # Generates output in the dist/ directory
```

---

## Linting & Formatting

Run the linter using **Oxlint**:
```bash
npm run lint
```

---

## Deployment

The built `dist/` directory can be served via static file servers, Cloudflare Pages, Vercel, or embedded in the Go API server static file handler.
