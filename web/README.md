# Classroom Mirror web application

The deployable Classroom Mirror application lives in this directory. The repository-level [README](../README.md) contains the product overview, architecture, evaluation result, and complete setup instructions.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The local Node runner opens on `http://localhost:3001` and supports both the deterministic instant demo and live GPT-5.6 mode. Copy `.env.example` to `.env.local` to enable live mode; never commit that file.

## Verification

```bash
npm test
npm run lint
```

## Key surfaces

- `app/api/analyze/route.ts`: two-stage GPT-5.6 Multi-agent discovery and skeptical synthesis
- `public/`: accessible product interface
- `benchmarks/`: adversarial lesson fixtures
- `scripts/run-evals.mjs`: live-only evaluation harness
- `results/eval-latest.json`: saved reproducible benchmark result
- `.openai/hosting.json`: OpenAI Sites deployment configuration

Use `npm run build` for the production Sites build and `npm run dev:sites` only when previewing the Cloudflare-compatible runtime locally.
