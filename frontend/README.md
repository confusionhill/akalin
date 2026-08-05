# LLM System Prompt Evaluation – Frontend

## Requirements

- **Node.js**: 20 or higher (LTS recommended)
- **Package manager**: npm, pnpm, or Yarn
- **Vite**: installed via the project dependencies
- **React**: 18+ with TypeScript support

## Setup & Development

1. Install dependencies:
   ```bash
   npm install   # or pnpm install / yarn install
   ```
2. Start the development server with hot‑module replacement:
   ```bash
   npm run dev   # Vite dev server, typically at http://localhost:5173
   ```
3. Open the URL shown in the terminal to view the app. Changes to source files will trigger automatic reloads.

## Building for Production

To create an optimized production bundle:
```bash
npm run build   # Generates files in the `dist/` directory
```
The output can be served by any static file server or integrated with the backend.

## Linting & Formatting

The project uses **Oxlint** with type‑aware rules. To run the linter:
```bash
npm run lint
```
If you need to enable additional type‑aware rules, install `oxlint-tsgolint` and adjust `.oxlintrc.json` as described in the original template.

## Testing

(Placeholder – add your preferred testing framework, e.g., Vitest or Jest, and scripts.)

## Deployment

The built `dist/` directory can be served via the Go backend's static file handler or deployed to any CDN.

---

> [!NOTE]
> This README mirrors the structure of the backend documentation for consistency across the project.

---

> [!TIP]
> Remember to keep the frontend dependencies up‑to‑date with `npm update` and regularly run the linter to catch issues early.
