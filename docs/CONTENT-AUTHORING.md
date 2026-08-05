# Course content authoring style

Read this before proposing or creating slides, notebooks, labs, datasets, or
assessments for a course day. This records the instructor's preferred working
style so a new chat can continue consistently.

## Preferred behaviour

The instructor liked the Day 2 content and assessment workflow and wants the
same quality for Days 3–5. Responses should be clear, thoughtful, practical,
and explanatory: recommend a concrete learning experience, then explain why it
fits the day's content. Do not give a generic list disconnected from the
course.

Always distinguish these three things:

1. **Verified course facts:** what the supplied slides, outline, files, quiz,
   and live portal actually contain.
2. **Recommended additions:** what should be added and why it fills a learning
   gap.
3. **External evidence:** any current examples or technical facts added through
   web research, with direct citations to authoritative primary sources.

Do not imply that web search was used when it was not. The Day 2 notebook
recommendation came from the course outline, Quiz 2 coverage, and the live
resource list. Use web research for later days when the user requests it or
when current documentation, APIs, libraries, safety guidance, or real examples
would materially improve accuracy. Prefer official documentation and original
technical sources over blogs and summaries.

## Resource naming (slides & labs)

Use one uniform title style for every day on both courses. Match the topic to
the day's content (usually the day title, shortened if needed).

| Kind | Pattern | Example |
| --- | --- | --- |
| Slides | `Day {n} slides — {Topic}` | `Day 3 slides — Tool use and controlled agent patterns` |
| Lab / notebook | `Day {n} lab — {Topic}` | `Day 3 lab — Tool use and controlled agent patterns` |

Rules:

- Spelling: `slides` and `lab` lowercase after the day number; em dash `—`
  (not hyphen or `#` or `_`).
- Same topic string for that day's slides and lab so the pair is obvious.
- Short description may stay generic (`Lecture slides for Day N.` /
  `Hands-on Colab notebook for Day N.`).
- HTML slide decks that use fragment indices should open at the first slide:
  `#1`, never a mid-deck index unless the instructor asks otherwise.
- Capstone / certification items stay outside this pattern
  (`Capstone Project Guide`, `Capstone group signup`, …).

Current Day 1–3 topics in use:

1. From language model to software solution  
2. RAG versus agents  
3. Tool use and controlled agent patterns  

## Required discovery sequence

Before proposing content for a day:

1. Read `docs/CONTEXT.md`, this file, and the relevant course/assessment docs.
2. Inspect the actual supplied source material for that day end to end.
3. Read the day title and summary from the code or live database.
4. Inspect existing live resources so the proposal does not duplicate a slide,
   notebook, lab, dataset, or link that already exists.
5. Inspect the day's assessment questions to understand what concepts are
   already checked and which practical skills remain untested.
6. Identify the progression from explanation to guided practice to independent
   evidence of learning.
7. Use current web research where useful under the sourcing rules above.

If the source material is missing or unreadable, say exactly what is missing
and request it rather than inventing course coverage.

## How to present a recommendation

A strong recommendation normally includes:

- A precise English title and, when useful, a natural Arabic title.
- The learning outcome in one sentence.
- Why the activity fits this specific day and does not belong to another day.
- A numbered notebook/lab flow students can follow.
- The expected student deliverables and simple completion criteria.
- Suggested duration, starter assets, dataset needs, and API/key requirements.
- At least one experiment, comparison, debugging exercise, or failure case.
- A short reflection that connects the implementation to an architecture or
  safety decision.
- Alignment with the quiz without merely teaching students the quiz answers.

Prefer one coherent, achievable lab over several shallow activities. Keep the
scope appropriate for a classroom session. Separate the **notebook** (executable
starter code and tasks) from the **lab brief** (instructions, deliverables, and
acceptance criteria), even when they are published together.

## Canonical Day 2 example

Day 2 is **Architecture design: RAG versus agents**. Its verified scope is RAG
versus agent selection and the retrieval pipeline: ingestion, cleaning,
chunking, embeddings, vector storage, retrieval, metadata, top-k, hybrid search,
reranking, grounding, and failure diagnosis. Quiz 2 checks these concepts. At
the last inspection, the live Day 2 resource list was empty.

The preferred practical addition is:

- **Lab 2: From Documents to Grounded Answers**
- **مختبر 2: من المستندات إلى إجابات موثوقة**
- A Colab notebook in which students load a small approved corpus, retain source
  metadata, chunk it, create embeddings, build a FAISS or Chroma index, retrieve
  top-k evidence, construct a grounded prompt, generate an answer with source
  citations, and evaluate the result.
- Students compare small/large chunks, different top-k values, and vector versus
  keyword retrieval; diagnose at least one retrieval failure; and decide whether
  the use case needs fixed RAG or an agent.
- Deliverables: the completed notebook, an evaluation table, answers to five
  reflection questions, and a short RAG-versus-agent justification.

Do not turn Day 2 into a primarily agent-building lab. Agent implementation fits
later content about controlled tools and actions; Day 2 should first establish a
working and evaluable retrieval pipeline.

## Assessment-authoring continuity

For new quizzes and question expansions, follow `docs/ASSESSMENTS.md` and
`public/assessment-authoring-prompt.md`. Preserve the qualities used for Quiz 2:

- Questions trace directly to supplied content and stated outcomes.
- Easy questions remain genuinely easy; harder questions diagnose or choose an
  architecture rather than rely on trivia.
- Distractors are plausible, parallel in style, and not obviously longer or
  shorter than the key.
- Rationales teach the distinction and explain why the correct answer works.
- Topics, difficulty mix, answer-letter distribution, duration, and exact count
  pass the portal validator.
- New questions add coverage instead of paraphrasing existing questions.
- Keep a reviewed JSON source under `docs/assessment-content/` before import.
- Publish as locked first unless the instructor explicitly asks to unlock it.
- For **Day 4 quiz / later post or final items** on production & security, use
  the corrected deck scope in
  [`docs/assessment-content/day-4-assessment-context.md`](assessment-content/day-4-assessment-context.md)
  (full slide extract under `slides/_extracted/day-4-slides-full.md`).
- **GENAI-01 shipped (5 Aug 2026):** Day 4 quiz
  (`day-4-quiz.json`, 10 MCQ / 10 min) and Days 1–4 post
  (`post-assessment-days-1-4.json`, 20 Q / 20 min, 15 MCQ + 5 T/F). Day 5 Final
  exam remains empty until authored. Re-import only after Reset attempts if any
  student has sat the paper.

## Creating and releasing future content

Do not mutate production merely because a recommendation was requested. When
the instructor asks to create and publish content:

1. Draft and review the source artifact locally.
2. Validate assessment JSON or execute the notebook from a clean runtime.
3. Check student-facing titles, descriptions, files, and section placement.
4. Upload/import only after the artifact is ready.
5. Default assessments to published-and-locked for instructor inspection.
6. Verify through Student view without creating an attempt or score.
7. Run the appropriate code/build checks if the portal itself changed.
8. Report exactly what became live and what remains locked or unpublished.
