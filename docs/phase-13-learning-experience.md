# Phase 13 — Student Learning Experience & Assessment Integration

## 1. What was implemented

A cohesive learning workflow built on the existing Phases 5–12 entities (no new tables, no new roles, no RLS changes):

- **My Courses (dashboard)**: enrolled courses with progress percentage, completed/published lessons, completion state, and a **Continue Learning** action per course.
- **Continue Learning**: deterministic next-action derivation per active enrollment — first unfinished published lesson → first available (not-yet-passed) published quiz → completed course state.
- **Course learning view**: student Course-progress card now includes a "Next up" action button; the Quizzes section shows per-quiz attempt status (Not attempted / In progress / X% — passed/not passed) for students; content-tree ✓/●/○ indicators unchanged; staff enrollment progress now uses **published** lesson totals so it matches the student view.
- **Lesson experience**: breadcrumb now includes the lesson title; a "Next up" card (Continue lesson / Take quiz / Course completed) appears once the current lesson is completed.
- **Quiz integration**: course page surfaces attempt status inline; the existing quiz page already showed attempts/score/pass-fail/review and remains authoritative.
- **Quiz result**: `submitAttempt` now redirects straight to the attempt **review/result page** (score, max, %, pass/fail, attempt info, per-question review) instead of back to the quiz page.
- **Staff experience** (`/dashboard/students/[id]`): new "Learning" data — per-enrollment progress bar (completed/published lessons), completion state, and a Quiz attempts list (quiz, course, score, pass/fail, review link).
- **Consistency fix**: progress totals across student and staff views use published-lesson counts only.

## 2. Files created

- `docs/phase-13-learning-experience.md`

## 3. Files modified

- `src/lib/courses.ts` — added `getCourseContents` (batch content for many courses) and `getPublishedLessonCountsByCourse`.
- `src/lib/progress.ts` — added `getLessonProgressMaps` (batch), `NextActionQuiz`, `NextLearningAction`, `hasPassedQuiz`, `deriveNextAction`.
- `src/app/(protected)/dashboard/page.tsx` — My Courses with Continue Learning action (batched queries).
- `src/app/(protected)/dashboard/courses/[id]/page.tsx` — student "Next up" button, per-quiz attempt status, published totals for staff progress.
- `src/app/(protected)/dashboard/courses/[id]/lessons/[lessonId]/page.tsx` — breadcrumb lesson title + "Next up" card.
- `src/app/(protected)/dashboard/courses/[id]/quizzes/actions.ts` — `submitAttempt` redirect → review/result page.
- `src/app/(protected)/dashboard/students/[id]/page.tsx` — Learning section (progress + quiz attempts).

## 4. Continue Learning rule

Per active enrollment, in order:

1. **Unfinished published lesson** — the first lesson (content order) whose progress is not `completed`; labelled Start (`not_started`) or Continue (`in_progress`).
2. **Available quiz** — the first published quiz (RLS-scoped) with no passed attempt (`score/max_score * 100 >= pass_threshold`).
3. **Completed** — no unfinished lesson and no pending quiz → "Course completed".

No new progress state; reuses `not_started` / `in_progress` / `completed`.

## 5. Course completion

Unchanged from Phase 12 (derived): active enrollment + published course + ≥1 published lesson + all published lessons completed. Quiz results do **not** gate completion (no schema support for gating; not invented). If a course has all lessons complete but an un-passed quiz, the next action is the quiz while the lesson-completion state already reads complete — this is documented, not silently changed.

## 6. Performance

- Dashboard: 4 batched queries for all enrolled courses (contents, progress maps, quizzes, attempts) — no per-course N+1.
- Course page: `getPublishedLessonCountsByCourse` + `getLessonProgressMap` + one attempts `IN` query; content reuses `getCourseContent`.
- Lesson page: parallel `Promise.all` (progress map, current-row, quizzes) + one attempts query.
- Student detail (staff): `getPublishedLessonCountsByCourse` + `getCompletedCountsByEnrollment` + one attempts query with nested quiz/course join.
- All joins/IN-queries use existing indexed relationships.

## 7. Security / RLS

- All reads go through existing RLS (students: own enrollments/progress/attempts, published courses/lessons/quizzes; staff: org-scoped select). The app adds server-side filters (e.g., `student_id = ctx.studentId`, enrollment course match) as defense-in-depth.
- No client-supplied identifiers trusted for authorization; URLs are lookup identifiers only; `requireStudentContext` / `requireStudentViewContext` gate each route.
- No new policies, no `USING(true)`, no service-role key.

## 8. Database changes

- Migration created: **NO**
- Migration applied: **N/A**
- **DATABASE CHANGES: NONE**

## 9. Validation results

- `npx tsc --noEmit` — **PASS**
- `npx eslint "src/**/*.{ts,tsx}"` — **PASS** (0 errors, 0 warnings)

## 10. Manual testing results

- **Automated / unauthenticated (PASS, executed):** `/login` 200; `/dashboard`, `/dashboard/courses`, `/dashboard/students`, `/dashboard/courses/[id]`, `/dashboard/courses/[id]/lessons/[lessonId]`, `/dashboard/courses/[id]/quizzes/[quizId]`, `/attempt`, `/attempts/[attemptId]`, `/dashboard/students/[id]` all 307 → `/login`. No new ERROR entries in the dev log.
- **Authenticated (NOT RUN — requires real ADMIN/INSTRUCTOR/SALES/COUNSELOR/STUDENT logins):** Continue Learning buttons, next-action ordering, quiz status chips, result-page redirect, staff Learning section, cross-org isolation, unpublished-lesson/quiz denial, forged-identifier rejection, completion state rendering.

## 11. Known limitations

1. Quiz gating is **not** implemented — completion is lesson-based; a passed-quiz-required course state would need a new architectural decision/migration (explicitly out of scope).
2. `enrollments.status` does not auto-transition to `completed` (Phase 12 known limitation; completion is derived).
3. `students.profile_id` may be unlinked (Phase 6 provisioning migration unapplied) — student flow not exercisable end-to-end without it.
4. Staff learning view is read-only (display-only, consistent with prior phases).

## 12. Recommended Phase 14

- Student "content readiness" tracking (lesson viewed/duration) or quiz-gating on content completion — requires a schema/architecture decision first.
- Learner analytics (per-course completion heat maps, per-student timelines) reusing existing `lesson_progress` + `quiz_attempts` data.