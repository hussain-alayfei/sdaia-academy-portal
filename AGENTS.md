<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SDAIA Academy Portal — agent entry

Before changing this codebase in a new conversation:

1. Read [`docs/CONTEXT.md`](docs/CONTEXT.md) (invariants, roles, layout).
2. For quizzes / assessments, also read [`docs/ASSESSMENTS.md`](docs/ASSESSMENTS.md) and [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).
3. Follow project skills under `.cursor/skills/` when they match the task.
4. Repo root is **`portal/`**. Never commit the parent folder (`_backups/` has real student PII).

Key invariants: RLS is the security boundary; answer keys are a separate table;
timer/grading/integrity are Postgres RPCs; student published content is cached
via `revalidateCourseContent`; Vercel region is `bom1`.
