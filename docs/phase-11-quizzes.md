# Phase 11 — Quiz System

## 1. What was implemented

A course-scoped quiz system on top of the existing `quizzes`, `quiz_questions`, `quiz_attempts`, and `quiz_attempt_answers` tables:

- Quiz management: create, edit (title/description/pass threshold/published), all under a course
- Question management: create, edit, reorder (up/down); supports `multiple_choice` and `true_false`; options stored as JSONB arrays with a single correct option index in V1
- Student attempts: start/resume an attempt, answer all questions, submit; grading is computed **server-side**; multiple attempts allowed
- Attempt review: per-question correct/incorrect display with the student's selection, the correct answer, and points earned
- Quiz list surfaced on the course detail page (staff manage; students see published quizzes they can attempt)

Scope is strictly quizzes. Lesson progress is explicitly out of scope (Phase 12).

## 2. Routes

- `/dashboard/courses/[id]` — existing course detail; now includes a "Quizzes" section listing quizzes with question/attempt counts
- `/dashboard/courses/[id]/quizzes/[quizId]` — **new** quiz detail page (staff: management + all attempts; student: own attempts + start/resume)
- `/dashboard/courses/[id]/quizzes/[quizId]/attempt` — **new** student answering page
- `/dashboard/courses/[id]/quizzes/[quizId]/attempts/[attemptId]` — **new** attempt review page (own attempt for students, any attempt for staff)

## 3. Server actions

All in `src/app/(protected)/dashboard/courses/[id]/quizzes/actions.ts`:

| Action | Context | Purpose |
| --- | --- | --- |
| `createQuiz` | `requireCourseWriteContext` (ADMIN/INSTRUCTOR) | Create a quiz under a course; returns a redirect to the new quiz |
| `updateQuiz` | same | Edit title/description/pass threshold/published |
| `createQuestion` | same | Append a question at `max(position) + 1`; validates type, options, correct answer, points |
| `updateQuestion` | same | Edit a question's fields |
| `moveQuestion` | same | Adjacent swap using the sentinel technique (like modules/lessons) |
| `startAttempt` | `requireStudentContext` | Reuse an existing draft attempt or create a new one for the student |
| `submitAttempt` | `requireStudentContext` | Grade every answer **server-side**, insert `quiz_attempt_answers`, snapshot `score`/`max_score` and `submitted_at` |

`requireStudentContext()` (new in `src/lib/crm.ts`) authenticates a STUDENT role profile, verifies `is_active`, and resolves the linked `students` row via `students.profile_id = auth.uid()` — the same identity mechanism the quiz RLS policies use.

## 4. Roles and permissions

| Role | Create/edit quizzes & questions | View quiz | Create attempts | View attempts |
| --- | --- | --- | --- | --- |
| ADMIN | Yes | All (incl. drafts) | — | All (staff policy) |
| INSTRUCTOR | Yes | All (incl. drafts) | — | All (staff policy) |
| SALES | No | All (staff policy) | — | All (staff policy) |
| COUNSELOR | No | All (staff policy) | — | All (staff policy) |
| STUDENT | No | Published + active enrollment only (RLS) | Own attempts only (RLS insert/update own) | Own attempts only (RLS select own) |

## 5. Grading model

- Each question stores `options` (JSONB array of strings) and `correct_answer` (JSONB array of option indices).
- V1 authoring enforces exactly one correct option per question (server-side validation) so the student UI can use radio buttons; the schema and the grading function still handle multi-index `correct_answer` arrays generically.
- `is_correct = sort(selected) === sort(correct)` (order-insensitive array equality via the `isCorrectAnswer` helper in `src/lib/quizzes.ts`).
- `points_earned = is_correct ? points : 0`.
- `score = Σ points_earned`, `max_score = Σ points`, snapshotted on the attempt at submission (`smallint`; guarded to ≤ 30000 to stay within the column type).
- Pass/fail is derived at read time: `percentage = score / max_score * 100 >= pass_threshold`. No stored `passed` column.

## 6. Student flow & security

- Students only see quizzes that are published **and** for courses they hold an active enrollment on (RLS `quizzes_select_student_enrolled` + `quiz_questions_select_student_enrolled`).
- The attempt page passes **sanitized** questions to the client (`toAnswerableQuestions` strips `correct_answer`; `selected_answer` is never sent to the client). Correct answers are fetched server-side at grading time only.
- `submitAttempt` ignores any client-supplied `is_correct`/`points` — there are none; the client only sends `{question_id, selected[]}` and every answer is re-graded against the DB.
- Invalid/missing selections are treated as unanswered (`selected = []`, `is_correct = false`). Selections are clamped to valid option indices.
- Draft attempts (no `submitted_at`) carry no score (DB CHECK enforces `submitted_at is null ⇔ score is null and max_score is null`).
- Re-submitting an already-submitted attempt is rejected server-side; a partial-answer insert failure is tolerated via `23505` handling so retry can complete the submission.

## 7. Ordering strategy

Identical to Phase 10: 1-based contiguous positions per quiz (`UNIQUE (quiz_id, position)`), adjacent up/down only, three-step sentinel swap (`POSITION_SENTINEL = 1000000`). Reuse of the shared `OrderControls` component (extended with `kind="question"`).

## 8. RLS behavior

No RLS changes. All policies already exist in the migration:
- Quizzes/questions: staff select (4 roles), student select (published + active enrollment), write (admin/instructor).
- Attempts: staff select (org via quiz), student select/insert/update own (via `students.profile_id`).
- Attempt answers: staff select, student select/insert own (insert-only — no update policy).

## 9. Database changes

- Migration created: **NO**
- Migration applied: **N/A**
- No database changes required. The existing schema fully supports this phase.

## 10. Validation results

- `npx tsc --noEmit` — **PASS**
- `npx eslint "src/**/*.{ts,tsx}"` — **PASS** (0 errors, 0 warnings)

## 11. Manual testing results

- **Automated / unauthenticated (PASS, executed):** all three new routes return 307 → `/login`; full regression sweep (dashboard, leads, students, courses incl. `new`/`edit`/lessons, users, login 200) all pass. No new ERROR entries in the dev log.
- **Authenticated (NOT RUN — requires a real ADMIN/INSTRUCTOR/SALES/COUNSELOR/STUDENT login):** quiz CRUD, question CRUD/reorder, start/submit attempt, server grading correctness, pass/fail rendering, review page, cross-org isolation, unpublished-quiz denial for students, direct-URL access controls.

## 12. Known limitations

1. **Direct-API grading bypass is possible by a malicious student.** RLS `quiz_attempt_answers_insert_own` only checks student ownership, not that `is_correct`/`points_earned` are truthful. The approved schema has no trigger enforcing grading. The app always grades server-side, but a student could POST forged answer rows via the API. Fixing this requires a DB trigger (migration) — deliberately out of scope (zero-DB-changes rule). Documented for a future hardening phase.
2. **Direct-API attempt creation is not RLS-scoped to enrollment.** `quiz_attempts_insert_own` checks ownership only, so a student could POST attempts for any quiz_id via the API. The app verifies published + active enrollment before starting an attempt; the API hole is the same trigger/column-level enforcement issue above.
3. **Multi-select multiple-choice is not authorable in V1** (single correct option enforced). The schema and grader support it; SQL-inserted multi-correct questions would be unanswerable through the radio UI until multi-select authoring lands.
4. **Student review requires a still-published quiz and active enrollment** (RLS on `quiz_questions`), so a student may lose per-question detail for an old quiz after it is unpublished.
5. Attempt submission is two statements (answers insert, then attempt update) and non-transactional; the `23505` retry path covers the failure window.
6. Student identity requires `students.profile_id` to be linked to an auth profile. The Phase 6 provisioning migration is still **not applied**, and Phase 8 conversion does not set `profile_id` — so the student attempt flow is not exercisable end-to-end until a profile is linked (or a future linking phase ships).

## 13. Recommended Phase 12

Lesson progress (`lesson_progress` table, RLS already present): mark lessons completed/started per enrollment, derive course completion, and gate quizzes on content completion if the product decides attempts should require completed lessons.