<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SDAIA Academy Portal — agent entry

Before changing this codebase in a new conversation:

1. Read [`docs/CONTEXT.md`](docs/CONTEXT.md) end to end (verified handoff, service access, working-tree warning, invariants, day tiles, `safeNext`, motion).
2. For quizzes, also [`docs/ASSESSMENTS.md`](docs/ASSESSMENTS.md) and [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).
3. For course content, notebooks, labs, datasets, or future-day assessments,
   read [`docs/CONTENT-AUTHORING.md`](docs/CONTENT-AUTHORING.md).
4. Use project skills under `.cursor/skills/` when they match.
5. Repo root is **`portal/`**. Never commit the parent `_backups/` folder (PII).

## Non-negotiables (short list)

- RLS + `course_id`; answer keys only in `assessment_answer_keys`
- Quiz trust in RPCs; call `revalidateCourseContent` after content writes
- `safeNext` for every post-login redirect (open-redirect class bug)
- Page entrance = `animate-page` (fade only); day tiles are content-height, not `aspect-square`
- Vercel `bom1`; `SUPABASE_SECRET_KEY` server-only
- `vercel --prod` ≠ `git push`
