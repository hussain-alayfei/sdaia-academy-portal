# Portal documentation

Start here when refreshing context for a new chat or onboarding.

| Doc | What it covers |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | **Start here.** Live handoff (auth reset, Day 4/post papers, domains), invariants, file map |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Routes, chrome, auth callback / recovery, caching, storage MIME, loading |
| [ASSESSMENTS.md](ASSESSMENTS.md) | Quiz engine, authoring rules, 20-Q post override, security checklist |
| [CONTENT-AUTHORING.md](CONTENT-AUTHORING.md) | Preferred source-first style for slides, notebooks, labs, datasets, and assessments |
| [DATA-MODEL.md](DATA-MODEL.md) | Tables, RLS, RPCs, enums |
| [assessment-content/](assessment-content/) | Reviewed JSON banks (Day 3–4 quizzes, post, Day 4 scope brief) |

| Also | |
| --- | --- |
| [`../DEPLOY.md`](../DEPLOY.md) | Vercel, env vars, `bom1`, aliasing production |
| [`../public/assessment-authoring-prompt.md`](../public/assessment-authoring-prompt.md) | LLM authoring brief |
| [`../src/lib/course-files.ts`](../src/lib/course-files.ts) | Day material upload allowlist + MIME helpers |
| [`.cursor/rules/`](../.cursor/rules/) | Always-on + assessment rules |
| [`.cursor/skills/`](../.cursor/skills/) | Agent skills for portal + assessments |

If docs disagree with code, **trust the code** and update the docs in the same change.

The current verification results, MCP safety scope, and new-chat checklist live
in `CONTEXT.md`; do not invent stale handoff details from memory.
