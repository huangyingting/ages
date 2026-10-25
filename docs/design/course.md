# 历史课堂 · Course design and lesson authoring

The course turns the atlas into a classroom: **one lesson per textbook unit** of the 统编版 middle-school books
(七上 → 八下) and the high-school 《中外历史纲要（上）》, each told in steps on the map and checked with 随堂检测.
It is modelled on pocket-planet's geography classroom (lesson → steps that drive the globe → quiz → score and take-aways
→ next lesson).

## Where things live

| What | Where |
|---|---|
| Types (`Lesson`, `LessonStep`, `Check`) | `src/shared/data/types.ts` |
| Lessons, one file per book | `src/shared/data/lessons/{g7a,g7b,g8a,g8b,hs1}.ts`, gathered in `lessons/index.ts` |
| Questions, unit test, course order | `src/shared/lib/course.ts` |
| Course picker (历史课堂 dialog) | `src/client/ui/learn.ts` |
| Lesson player and unit test | `src/client/ui/lesson.ts` |
| Content invariants | `tests/unit/course.test.ts` |

## Flow

1. **Course picker**: 学习中心 → 学习 → 历史课堂 opens a dialog: book tabs, then every unit of the book with its lesson
   (minutes, blurb, best score) and its 单元测验; a ✓ marks a passed unit. Picking one closes the dialog.
2. **Lesson scene**: the lesson runs in the left column, between the headline and the line key; the period details and
   the period's figures step aside (the pin is kept) until it ends. The step card says one thing at a time; the map shows it (year, camera, the event's model,
   a polity's area). Steps about an event offer **看动画** (its story) and **详情** (its card, stacked over the lesson in the left column).
   The map stays free to explore.
3. **随堂检测**: the lesson's checks, one at a time. Each answer locks and shows right/wrong and *why*; the next
   question unlocks only after answering.
4. **Score**: right answers, the take-aways (本课要点), what to review (the missed questions' events) and the next lesson.
5. **单元测验**: the unit's lesson checks, plus "when" questions on its core events and questions on its map phases
   (`periodQuestion`), shuffled.

Progress (best score per lesson and unit test) is kept in localStorage. `#lesson=<id>` opens a lesson directly.

## Writing a lesson

```ts
{
  id: 'g7a-3', book: 'g7a', unit: 3, minutes: 12,
  title: { zh: '…', en: '…' }, blurb: { zh: '…', en: '…' },
  steps: [
    { year: -230, at: [110, 34, 60], title: {…}, body: {…} },   // a written step: a year and a camera target
    { ev: 'qin_unify', polity: 'qin', body: {…} },              // an event step, its text rewritten for the lesson
    { ev: 'dazexiang' },                                       // an event step using the event's own title and summary
  ],
  checks: [
    { q: {…}, options: [{…}, {…}, {…}, {…}], answer: 1, why: {…}, ev: 'qin_unify' },
    { order: ['qin_unify', 'dazexiang', 'han_found'] },        // put in time order (by the events' years)
    { where: 'zhangqian', tol: 500 },                          // find it on the map (event or place id)
  ],
  keys: [{…}, {…}],
}
```

Rules (enforced by `tests/unit/course.test.ts` where they can be):

- **Bilingual**: every learner-facing string is `{ zh, en }`; English has no Chinese characters.
- **Textbook first**: follow the unit's 统编版 content and wording (课标要点); do not invent facts. Keep each step body
  to 1–3 sentences (about 40–90 Chinese characters).
- **Steps**: 3–8 per lesson, in story order. Open with a written step that sets the scene (year + `at`), then event
  steps. At least one step has its own `body`. Only reference events that exist (`src/shared/data/events-*.ts`) and
  polities that exist (`src/shared/data/polities.ts`); a `polity` must be on that year's map to be highlighted.
- **Camera**: `at: [lon, lat, dist]`; dist ≈ 25 for a region, 40–60 for China, 80+ for Eurasia.
- **Checks**: 3–5 per lesson, at least one written multiple-choice question (`q`), usually one `order` and one `where`.
  Options: 3–5 distinct, plausible and drawn from the same period's vocabulary; spread the right answer's position;
  `why` explains the answer in one or two sentences. `order` uses 3–5 events with different years.
- **Take-aways**: 2–4 `keys`, the sentences a student should be able to write in an exam.
