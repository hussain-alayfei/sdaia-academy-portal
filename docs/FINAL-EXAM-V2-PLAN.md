# Final exam v2 — bilingual, 50 minutes, 3 warnings

Changes requested on 6 August 2026, after v1 was seeded and the freeze model was
built. Target is the same assessment,
`4c23ed42-7287-49ef-9e85-02cff925bd92` (GENAI-01, Day 5), still
**published + locked**, 0 attempts.

Ordered so the exam is sittable after Stage 3 even if Arabic slips.

## Confirmed decisions

| Decision | Choice |
| --- | --- |
| Warning limit | **3**, attempt-level, then freeze (was 5) |
| Duration | **50 minutes** (was 30) |
| Instructions | **One** unified block. Today there are two, and they overlap |
| Arabic | I draft, **you review before it goes live** |
| Technical terms | Stay in **English** inside Arabic text: RAG, agent, embedding, token, prompt, API, LLM, chunk, index, rate limiting, circuit breaker, streaming, fine-tuning |
| Language switch | Chosen before starting, changeable **any time during** the exam |
| Phones | Strong "use a laptop" notice, **still allowed** |

---

## Stage 1 — The fullscreen defect (highest priority)

**What you saw:** the exam opens windowed, and after coming back to it fullscreen
cannot be re-triggered, so the paper is navigable outside fullscreen.

**Why it happens.** Two separate faults in what I shipped:

1. `requestFullscreen()` only works inside a **user gesture**. The runner calls
   it in a mount effect, and the page arrives via a form redirect with no
   gesture attached, so the browser silently rejects it. The exam therefore
   never enters fullscreen at all.
2. The guard only reacts to `fullscreenchange` **events**. Once the student is
   already outside fullscreen and the warning has been recorded, no further
   event fires, so nothing ever re-arms. The overlay disappears and the paper is
   readable windowed for the rest of the exam.

**Fix — a fullscreen gate rather than a fullscreen request.**

- While the exam is in exam mode, the browser supports fullscreen, and the
  document is **not** currently fullscreen, a blocking opaque overlay covers the
  entire paper. Questions are not merely dimmed; nothing behind it can be read
  or clicked.
- The overlay carries the button that calls `requestFullscreen()`. A button
  press is a real user gesture, so it succeeds — this is what makes entry work
  at all.
- The gate is driven by **state, not by events**, so it reappears every time the
  student leaves fullscreen, however they leave.
- The 10 second grace stays: return inside it and nothing is recorded. Past it,
  exactly **one** `fullscreen_exit` warning is recorded per exit, never a
  repeating drip.
- Unchanged: if the browser cannot do fullscreen (iPhone Safari), the gate never
  appears and the warning is never armed.

## Stage 2 — Numbers and copy

1. `duration_minutes` 30 → **50**.
2. `integrity_warning_limit` 5 → **3**. Copy that reads "of 5" is generated from
   the column, so it follows automatically.
3. **Merge the two instruction blocks into one.** The rules screen currently
   renders the numbered briefing *and* a separate "Before you begin" panel
   repeating the clock, the one-attempt rule and the integrity policy. Keep one
   block, ordered: what the paper is → time and attempts → language → what
   freezes the exam → what is never punished → results held back.
4. Add the laptop notice.

## Stage 3 — Navigation sidebar

The 30 numbered buttons sit above the question in one flat block. On a 30
question paper that is a wall of numbers.

- Move to a **left sidebar on `lg+`**, sticky, grouped under Section A / B / C
  headings with a per-section answered count.
- Collapses back to the top on smaller screens, so a laptop gets the sidebar and
  a tablet keeps today's layout.
- Sidebar respects RTL: it moves to the right side in Arabic.

## Stage 4 — Arabic

### Schema

| Column | Purpose |
| --- | --- |
| `assessment_questions.stem_ar` | Arabic stem |
| `assessment_options.body_ar` | Arabic option |
| `assessment_answer_keys.rationale_ar` | Arabic explanation, for release later |
| `assessments.instructions_ar` | Arabic briefing |
| `assessments.sections` | gains `title_ar`, `brief_ar`, and `use_case.*_ar` |

All nullable. English stays the source of truth: if an Arabic string is missing,
that item **falls back to English** rather than rendering blank.

### Language switch

- Chosen on the rules screen before starting: **العربية / English**.
- Persists in `localStorage`, so it carries into the runner and survives a
  reload.
- A visible toggle stays in the exam header for the whole attempt.
- Client-side only. No database write, so switching is instant and cannot fail
  mid-exam.

### RTL

- `dir="rtl"` on the exam shell when Arabic is active; IBM Plex Sans Arabic is
  already loaded.
- Option letters stay **A B C D** in both languages so the answer key, the
  results page and any spoken instruction in the room all agree.
- Numerals stay Western (1, 2, 3) to match the navigator and the clock.
- The timer, warning banner and freeze screen all mirror correctly.

### Translation rules

- Modern Standard Arabic, exam register.
- **Technical terms stay in English**, inline, unchanged: RAG, agent, embedding,
  token, prompt, API, LLM, chunk, index, rate limiting, circuit breaker,
  streaming, fine-tuning, metadata, top-k.
- Identifiers untouched: `HR-204`, `E-99999`, `E-10482`, and the JSON error
  string in Q15 stay exactly as written.
- True/False render as **صح / خطأ**, still stored as options A and B.
- Meaning must not shift. The Arabic distractors have to stay as wrong as the
  English ones — a translation that accidentally makes a wrong option defensible
  changes the exam.

### Review before it ships

I produce `docs/assessment-content/final-exam-ar-review.md`: English and Arabic
side by side, all 30 questions, every option, both instruction sets. **Nothing
is written to the database until you approve it.** The Arabic seeds separately
from the English paper, so approving it does not disturb what is already live.

## Stage 5 — Verify and ship

1. `npx tsc --noEmit`, `npm test`, `npm run build`
2. Extend `final-exam-content.test.ts`: 50 minutes, limit of 3, one instruction
   block, and — once Arabic lands — that every question has an Arabic stem and
   four Arabic options, and that protected English terms survive translation
3. Re-verify the freeze path against the live schema in a rolled-back
   transaction, as before
4. Deploy, re-alias, revalidate
5. Update `CONTEXT.md` and `ASSESSMENTS.md`

## Not changing

The 30 questions themselves, their order within sections, the answer key, the
shuffle, the hidden-results model, and the lockdown. `final-exam-content.test.ts`
keeps guarding the English paper against drift.
