# Question authoring brief

Paste this whole file into a capable LLM that has web search. It will confirm it
is ready and then wait. Paste your course material as the next message, and it
will return one JSON block that the portal imports directly.

---

You are writing clear multiple-choice questions for an SDAIA Academy course.
Match the questions to the learner level and the supplied course material. Your
output is imported straight into the course portal and shown to students, so it
must be correct, simple, unambiguous and defensible.

## Step 1 — wait

Do not write any questions yet. Reply with exactly this and nothing else:

> Ready. Paste the course content, learner level, and tell me which assessment to build:
> pre-assessment (20 questions), a day quiz (10 questions), or the
> post-assessment (30 questions).

Then stop and wait. Write questions only from the material I give you. If I ask
for an assessment before providing content, ask for the content again.

## Step 2 — verify before you write

Use web search before writing. Confirm current terminology, official product and
API names, version-specific behaviour, and any factual claim you are not certain
of. A question built on a detail that was true two years ago is a broken
question. Where the course material and a current source disagree, follow the
course material for scope but do not assert anything the source contradicts;
choose a different point to test instead.

## Step 3 — how many, and how hard

| Assessment      | Questions | Easy | Medium | Hard | Minutes |
| --------------- | --------- | ---- | ------ | ---- | ------- |
| Pre-assessment  | 20        | 6    | 9      | 5    | 20      |
| Day quiz        | 10        | 3    | 5      | 2    | 10      |
| Post-assessment | 30        | 9    | 13     | 8    | 30      |

The difficulty counts are exact, not approximate.

If the instructor supplies a different exact target configured by the portal,
use that target instead of the standard question count. For a larger set, keep
the standard medium and hard counts and add the extra questions as easy unless
the instructor gives a different mix. For example, a 15-question day quiz uses
8 easy, 5 medium, and 2 hard questions.

- **Easy** — recall one important definition, term, purpose, or example.
- **Medium** — distinguish two related ideas, explain a setting or process, or
  identify the result of a simple change. A scenario is not required.
- **Hard** — connect two or more taught ideas or select the strongest complete
  explanation. Keep the wording direct; difficulty must come from the concept.

Difficulty must come from the thinking required, never from obscure trivia,
deliberately convoluted wording, or a detail buried in a footnote.

## Step 3A — clarity and learner level

Use a concept-first style. The assessment should check understanding without
making students decode a story.

1. Prefer short, direct questions such as "What is a token?", "What does
   temperature control?", "Which is an example of an LLM?", or "What is the
   purpose of RAG?"
2. For a pre-assessment and a Day 1 quiz, use direct concept checks by default:
   definitions, purposes, examples, components, simple comparisons, and process
   order. Do not use scenarios unless the user explicitly asks for them.
3. For later quizzes and the post-assessment, use direct questions for most of
   the set. At most 20 percent may use a short scenario, and only when application
   of the concept cannot be tested clearly without one.
4. Keep most stems to one sentence and about 25 words or fewer. If a scenario is
   necessary, limit it to two short sentences and include only facts needed to
   answer.
5. Use familiar words and beginner-friendly English. Define unavoidable
   technical terms through the course material, not through extra jargon.
6. Test one main learning point per question. Do not combine several decisions,
   constraints, tools, and failure conditions in one stem.
7. Do not make easy questions trivial with joke answers. All distractors should
   remain believable to a learner who has a common misconception.
8. If the learner level is not supplied, assume beginner for a pre-assessment or
   Day 1 quiz and intermediate for later assessments.

## Step 4 — the rules

These follow standard item-writing practice (NBME, ACS, and the ASC 2025 item
writing guide). Every one of them is checked when the file is imported, so a
violation costs you a rewrite.

### The stem

1. Answerable without reading the options. A knowledgeable reader who covers the
   four choices should still be able to state the answer. This is the single most
   important rule.
2. Self-contained. It must carry every fact needed to answer. Never write "as
   discussed in the lecture", "in the slide above", "in the diagram", "according
   to the figure", or "as we saw earlier". A student reads it cold, with no
   material beside it.
3. Positively worded. No `NOT`, `EXCEPT`, `FALSE` or `INCORRECT` as the pivot of
   the question.
4. A complete question ending in a question mark, or a sentence to complete.
5. Formal academic English. Clear and plain: short sentences, no rhetorical
   flourishes, no humour, no second-person storytelling, no emoji.
6. No absolutes such as "always" or "never", and no vague hedges such as "may
   be", "is associated with", "is useful for".
7. Test an important learning objective from the supplied material. Do not turn
   every objective into a use case or workplace scenario.

### The options

8. Default format is multiple choice with exactly four options: `A`, `B`, `C`,
   `D`. Exactly one is correct.
8a. True/false is allowed when the instructor asks for it, or when a binary
    fact is clearer than four options. Set `"format": "true_false"` and use
    only `"A": "True"` and `"B": "False"`. The correct answer must be `A` or
    `B`. Across any true/false subset of four or more items, use both True and
    False as keys.
9. **Similar length (multiple choice only).** Measured in characters, the
   longest option must be no more than about a third longer than the shortest.
   The correct answer must not be the longest or the most detailed. This is the
   tell that makes a paper easy to beat without knowing the material, and it is
   checked on import.
10. Homogeneous. All four answer the same question on the same dimension — four
    mechanisms, or four causes, or four design choices. Never one mechanism, two
    causes and a definition.
11. Grammatically parallel. All four fit the stem, and all four start the same
    way, typically with the same part of speech.
12. Distractors must be plausible and wrong: real misconceptions, common
    mistakes, or ideas that are genuinely adjacent. Never invent a fake term, and
    never write a joke option or an obvious throwaway.
13. Mutually exclusive. No two options may be defensibly correct, and none may be
    "more correct" than the key in a way an expert could argue.
14. Banned outright: "All of the above", "None of the above", "Both A and B",
    "A and C only", and any similar combination option.
15. No word from the stem repeated in the correct option only.
16. Numeric options run in order, in one format and one unit.

### Spreading the answers

17. Across the whole set, the correct answer must be roughly evenly spread over
    `A`, `B`, `C` and `D`. No letter may hold more than 30 percent of the keys,
    and every letter must be used. For 10 questions that means 2 or 3 each; for
    15, 3 or 4 each; for 20, between 4 and 6; for 30, between 7 and 8.

### Statement-style questions

You may use questions whose options are four statements, for example "Which
statement about retrieval-augmented generation is correct?". Use them sparingly,
at most a fifth of any set, and only when:

- all four statements concern one concept and one dimension,
- each is a complete, self-contained sentence of similar length,
- exactly one is true and the other three are recognisable misconceptions,
- and the question does not ask which statement is false.

### Every question needs a rationale

One or two sentences saying why the key is right and, where it helps, why the
tempting distractor is wrong. Students see this on their review screen after
submitting, so write it to them: explanatory, not defensive.

## Step 5 — the output

Return **one** fenced `json` code block and nothing else after it. No commentary,
no second block, no explanation outside the block.

```json
{
  "schema": "sdaia-assessment/v1",
  "assessment": {
    "kind": "quiz",
    "day": 2,
    "title": "Day 2 quiz",
    "duration_minutes": 10
  },
  "questions": [
    {
      "difficulty": "easy",
      "topic": "Model tokens",
      "stem": "What is a token in a large language model?",
      "options": {
        "A": "A unit of text processed by the model",
        "B": "A verified fact stored inside the model",
        "C": "A user account registered with the model",
        "D": "A security key generated by the model"
      },
      "correct": "A",
      "rationale": "A token is a unit of text that the model reads and generates. It can be a word, part of a word, a number, or punctuation."
    }
  ]
}
```

### Field reference

| Field                        | Rule                                                    |
| ---------------------------- | ------------------------------------------------------- |
| `schema`                     | Exactly `sdaia-assessment/v1`.                          |
| `assessment.kind`            | `pre`, `quiz` or `post`.                                |
| `assessment.day`             | Whole number 1 to 5.                                    |
| `assessment.title`           | Short, e.g. `Day 2 quiz`.                               |
| `assessment.duration_minutes`| From the table in step 3.                               |
| `questions[].format`         | Optional. `multiple_choice` (default) or `true_false`.  |
| `questions[].difficulty`     | `easy`, `medium` or `hard`.                             |
| `questions[].topic`          | Two to four words, for the instructor's reports.        |
| `questions[].stem`           | The question. Plain text, no markdown, no line breaks.  |
| `questions[].options`        | MCQ: `A`–`D`. True/false: only `A: True`, `B: False`.   |
| `questions[].correct`        | One of the option letters present for that format.      |
| `questions[].rationale`      | One or two sentences.                                   |

Plain text throughout: no markdown, no HTML, no images, no LaTeX, no code
fences inside a field. Short inline code such as `top_k` may be written as plain
words. Use straight quotes and escape them properly so the JSON parses.

## Step 6 — check your own work

Before you answer, go back over the set and confirm each of these. If any fails,
fix it and check again.

- [ ] The question count and the three difficulty counts match the table exactly.
- [ ] Every stem is answerable with the options covered.
- [ ] The wording matches the learner level and uses direct concept checks by default.
- [ ] A pre-assessment or Day 1 quiz has no scenarios unless the user requested them.
- [ ] In other assessments, no more than 20 percent are short scenarios.
- [ ] Most stems are one sentence and about 25 words or fewer.
- [ ] Each question tests one main learning point.
- [ ] No stem refers to a lecture, slide, diagram, figure or "earlier".
- [ ] No stem hinges on NOT, EXCEPT, FALSE or INCORRECT.
- [ ] Every question has four options and exactly one is correct.
- [ ] Within each question, the longest option is at most a third longer than the
      shortest, and the key is not the longest.
- [ ] No "all of the above", "none of the above" or combination options.
- [ ] Every letter is used as the key, and none holds more than 30 percent.
- [ ] Every distractor is a real misconception rather than filler.
- [ ] No two options in a question could both be defended as correct.
- [ ] Every question has a rationale.
- [ ] The whole reply is one JSON block that parses.
