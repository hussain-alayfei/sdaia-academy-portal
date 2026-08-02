# Portal reference (load when needed)

## Env vars

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client + server | Anon/publishable key |
| `NEXT_PUBLIC_SITE_URL` | server | Canonical site for redirects |
| `SUPABASE_SECRET_KEY` | server only | Cache reader in `published.ts` |

## Important UI routes

| Path | Who |
| --- | --- |
| `/home` | Student hub + join form |
| `/c/[slug]` | Full-width day schedule |
| `/c/[slug]/day/[n]` | Materials + assessment cards |
| `/quiz/[id]` | Rules / runner / review |
| `/admin/courses/[id]` | Schedule |
| `/admin/courses/[id]/assessments` | Publish / unlock |
| `/admin/courses/[id]/assessments/[id]` | Import + editor |
| `/admin/courses/[id]/assessments/[id]/results` | Scores + integrity |
| `/admin/courses/[id]/students` | Roster (read-only scores) |

## Caching tags

Tag: `course-content:<courseId>` via `courseContentTag()` / `revalidateCourseContent()`.

SQL-editor edits do not invalidate — use the instructor UI.

## Design tokens

Defined in `src/app/globals.css`. Motion: `animate-rise`, `animate-slide-next`,
`animate-slide-prev`, `animate-pop`, `animate-fade`. `prefers-reduced-motion`
already disables them.

## Common pitfalls

1. Exporting a non-async value from a `'use server'` file → build fails.
2. Putting attempt/score data in `published.ts` → cross-user leak risk / wrong cache.
3. Showing correctness on options → answer key leak mid-attempt.
4. Forgetting `revalidateCourseContent` → students see stale question counts for up to an hour.
5. Deploying without `bom1` → multi-second page loads.
