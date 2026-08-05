# Portal reference (load when needed)

## Env vars

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client + server | Anon/publishable key |
| `NEXT_PUBLIC_SITE_URL` | server | Canonical site for redirects / email logo URLs |
| `SUPABASE_SECRET_KEY` | server only | Cache reader in `published.ts` |
| Hook secrets | Edge Function | `GMAIL_*`, `SEND_EMAIL_HOOK_SECRET`, `PORTAL_SITE_URL` for auth-send-email |

## Important UI routes

| Path | Who |
| --- | --- |
| `/` | Landing (signed-out) |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth (+ `BackLink`) |
| `/home` | Student hub + join; managers → `/admin` |
| `/profile` | Edit info (opened from account menu, not direct avatar nav) |
| `/notifications` | Full notification list |
| `/c/[slug]` | Course schedule (+ back to My courses) |
| `/c/[slug]/day/[n]` | Materials + assessment cards |
| `/quiz/[id]` | Rules / runner / review |
| `/admin/...` | Instructor console (Assessments, Days, Students, Settings) |

## Header (current)

- Light bar + mosaic gradient strip
- LTR: actions left, `/sdaia-academy-logo.jpg` right
- Order: Profile menu → Notifications → Instructor icon
- Favicon: mosaic emblem (`src/app/icon.png`)

## Day materials upload

- Logic: `src/lib/course-files.ts`
- Forms: `src/components/admin/resource-forms.tsx`
- Bucket: `course-files` (200 MB; MIME allowlist + ZIP aliases)
- Tests: `npm test`

## Motion

| Class | Role |
| --- | --- |
| `animate-page` | App/auth/quiz/student course templates — **not** admin course tabs |
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
5. Deploy without `bom1` or without aliasing `sdaia-genai-portal.vercel.app`.
6. Login redirect with only `startsWith('/')` → open redirect.
7. Uploading with `contentType: file.type || 'application/octet-stream'` → Storage reject.
8. Re-adding Assessments day-tab fade or count badges without being asked.
9. Assuming `vercel --prod` updated GitHub.
