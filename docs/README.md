# Portal documentation

Start here when refreshing context for a new chat or onboarding.

| Doc | What it covers |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | **Start here.** Product, verified handoff state, service connections, invariants, day tiles, motion, `safeNext`, file map |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Routes, auth, caching, loading, data layers |
| [ASSESSMENTS.md](ASSESSMENTS.md) | Quiz engine, authoring rules, security checklist |
| [CONTENT-AUTHORING.md](CONTENT-AUTHORING.md) | Preferred source-first style for slides, notebooks, labs, datasets, and future-day assessments |
| [DATA-MODEL.md](DATA-MODEL.md) | Tables, RLS, RPCs, enums |

| Also | |
| --- | --- |
| [`../DEPLOY.md`](../DEPLOY.md) | Vercel, env vars, `bom1`, GitHub |
| [`../public/assessment-authoring-prompt.md`](../public/assessment-authoring-prompt.md) | LLM authoring brief |
| [`.cursor/rules/`](../.cursor/rules/) | Always-on + assessment rules |
| [`.cursor/skills/`](../.cursor/skills/) | Agent skills for portal + assessments |

If docs disagree with code, **trust the code** and update the docs in the same change.

The current verification results, MCP safety scope, GitHub remote warning, and
new-chat checklist live in `CONTEXT.md`; do not duplicate them from memory.
