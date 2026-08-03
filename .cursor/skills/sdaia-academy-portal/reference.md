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
| `/` | Landing (signed-out) |
| `/login`, `/signup` | Auth |
| `/home` | Student hub + join; managers → `/admin` |
| `/c/[slug]` | Day tile schedule |
| `/c/[slug]/day/[n]` | Materials + assessment cards |
| `/quiz/[id]` | Rules / runner / review |
| `/admin/...` | Instructor console |

## Day tiles (current)

- Columns: `repeat(auto-fill, minmax(190px, 220px))`
- `min-h-[184px]`, height from content (not square)
- Chip via `assessmentChipLabel` — kind name or `"N assessments"`
- Hover: mosaic colour vars per day index

## Motion

| Class | Role |
| --- | --- |
| `animate-page` | Templates + landing + quiz shell |
| `animate-rise` | Small panels (question editor) |
| `animate-brand` | Hero “purpose” colour loop |
| `animate-dot` | LoadingDots |

## Caching tags

`course-content:<courseId>` via `revalidateCourseContent()`. SQL editor edits
do not invalidate.

## Common pitfalls

1. Exporting a non-async value from `'use server'` → build fails.
2. Putting attempt/score data in `published.ts`.
3. Correctness on options → mid-attempt key leak.
4. Forgetting `revalidateCourseContent`.
5. Deploy without `bom1`.
6. Login redirect with only `startsWith('/')` → open redirect.
7. Assuming `vercel --prod` updated GitHub.
