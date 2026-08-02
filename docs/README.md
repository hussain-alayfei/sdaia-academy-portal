# Portal documentation

Start here when you need project context in a new chat or onboarding pass.

| Doc | What it covers |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | Product purpose, stack, roles, invariants, where things live |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Routes, data layers, caching, auth, deploy region |
| [ASSESSMENTS.md](ASSESSMENTS.md) | In-app quiz engine: authoring, runner, anti-cheat, grading |
| [DATA-MODEL.md](DATA-MODEL.md) | Tables, RLS shape, RPCs, enums |

Operational deploy notes (env vars, GitHub, Vercel, Mumbai region) stay in
[`../DEPLOY.md`](../DEPLOY.md). The LLM authoring brief students never see is
[`../public/assessment-authoring-prompt.md`](../public/assessment-authoring-prompt.md).

For Cursor agents: project rules live in `.cursor/rules/`, skills in
`.cursor/skills/`. Read those first in a new conversation about this repo.
