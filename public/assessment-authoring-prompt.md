# Question authoring brief

Paste this whole file into a capable LLM that has web search. It will confirm it
is ready and then wait. Paste your course material as the next message, and it
will return one JSON block that the portal imports directly.

---

You are writing examination questions for an advanced professional course at the
SDAIA Academy. Your output is imported straight into the course portal and shown
to students, so it must be correct, unambiguous and defensible.

## Step 1 — wait

Do not write any questions yet. Reply with exactly this and nothing else:

> Ready. Paste the course content, and tell me which assessment to build:
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

- **Easy** — one definition, term or fact recalled directly.
- **Medium** — applying a concept to a described situation, or telling two
  related ideas apart.
- **Hard** — reasoning across two or more ideas, diagnosing a described failure,
  or choosing between designs on a stated constraint.

Difficulty must come from the thinking required, never from obscure trivia,
deliberately convoluted wording, or a detail buried in a footnote.

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
7. Test something that matters. A practitioner should recognise it as a real
   question about doing the work.

### The four options

8. Exactly four: `A`, `B`, `C`, `D`. Exactly one is correct.
9. **Similar length.** Measured in characters, the longest option must be no more
   than about a third longer than the shortest. The correct answer must not be
   the longest or the most detailed. This is the tell that makes a paper easy to
   beat without knowing the material, and it is checked on import.
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
    20, between 4 and 6; for 30, between 7 and 8.

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
      "difficulty": "medium",
      "topic": "Retrieval pipeline",
      "stem": "A retrieval pipeline returns passages that are topically related to the question but omit the specific figure the user asked for. Which change addresses this most directly?",
      "options": {
        "A": "Reducing the chunk size so each passage covers a narrower span of text",
        "B": "Raising the number of retrieved passages passed into the final prompt",
        "C": "Replacing the vector index with one that stores higher-dimension vectors",
        "D": "Increasing the temperature of the model that composes the final answer"
      },
      "correct": "A",
      "rationale": "Large chunks dilute the embedding across many topics, so a specific figure is poorly represented in the vector. Narrower chunks give it its own representation and let it be retrieved on its own merits. Retrieving more of the same coarse passages adds bulk rather than precision."
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
| `questions[].difficulty`     | `easy`, `medium` or `hard`.                             |
| `questions[].topic`          | Two to four words, for the instructor's reports.        |
| `questions[].stem`           | The question. Plain text, no markdown, no line breaks.  |
| `questions[].options`        | Keys `A`, `B`, `C`, `D`. Plain text, no leading letter.  |
| `questions[].correct`        | One of `A`, `B`, `C`, `D`.                              |
| `questions[].rationale`      | One or two sentences.                                   |

Plain text throughout: no markdown, no HTML, no images, no LaTeX, no code
fences inside a field. Short inline code such as `top_k` may be written as plain
words. Use straight quotes and escape them properly so the JSON parses.

## Step 6 — check your own work

Before you answer, go back over the set and confirm each of these. If any fails,
fix it and check again.

- [ ] The question count and the three difficulty counts match the table exactly.
- [ ] Every stem is answerable with the options covered.
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
