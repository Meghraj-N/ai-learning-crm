# Phase 14 — Learner Analytics & Learning Intelligence

## 1. What was implemented

Deterministic learning analytics derived entirely from existing tables (`enrollments`, `courses`, `course_content` → modules/lessons, `lesson_progress`, `quizzes`, `quiz_attempts`, `quiz_attempt_answers`). No new tables, no new roles, no RLS changes, no service-role key.

- **Student dashboard (`/dashboard`)** — "My learning analytics" metric grid (enrolled/active/completed courses, overall completion %, published lessons completed/remaining, quizzes attempted/submitted, quizzes passed, pass rate, average quiz score), computed from a single batched loader.
- **Course detail (staff, `/dashboard/courses/[id]`)** — Course analytics (enrollment counts by status, average completion, published lessons/quizzes, quiz attempts/submitted/passed, pass rate, average score, completion-distribution bars) and deterministic **Learning insights** (students at 0%, 1–49%, incomplete active enrollments, lessons started-but-not-completed, repeated quiz failures, average-score-below-50% students). A **Student performance** table shows per-enrollment completion %, lesson counts, quiz attempts, pass rate and average score, with client-side-style query-string filters (`student`, `estatus`, `completion`).
- **Student detail (staff, `/dashboard/students/[id]`)** — "Learning analytics" metric grid + **Per-course learning** table (completion %, lessons completed/total/remaining, quiz attempts, pass rate, average score, last activity) + a **Learning timeline** (enrollment → lesson started/completed → quiz started/submitted → course completed; newest first) derived from real timestamps.
- **Quiz detail (staff, `/dashboard/courses/[id]/quizzes/[quizId]`)** — Quiz analytics (total/submitted/passed/failed attempts, pass rate, average/highest/lowest score) and **Question performance** (per-question attempts/correct/incorrect/accuracy %) aggregated across all submitted attempts.
- Shared analytics UI primitives (`AnalyticsSection`, `MetricGrid`, `MetricCard`, `ProgressBar`, `EmptyState`) and a pure/typed analytics library (`src/lib/analytics.ts`).

## 2. Metric definitions

- **Lesson completion %** = `round(completed published lessons / total published lessons × 100)`; denominator `0` → `0%`. Counts only currently **published** lessons.
- **Course completion (derived)** = active enrollment + published course + ≥1 published lesson + all published lessons completed. Unchanged from Phase 12/13. `enrollments.status = completed` is displayed as status and does not itself derive completion.
- **Quiz percentage** = `round(score / max_score × 100)`; `null` when score/max missing.
- **Pass rule** = Phase 11 rule: `quizPercentage ≥ pass_threshold`. Pass rate = `passed / submitted`; submitted = attempts with `submitted_at` and non-null score/max_score; zero submitted → `null` → UI shows "—".
- **Average/highest/lowest score** are computed over submitted attempts only.
- **Quiz metrics count attempts on currently-published quizzes only.** Draft quizzes have no `pass_threshold` guarantee from a student-facing flow and are excluded; attempts left over from a quiz that was unpublished are excluded. Documented limitation.
- **Overall completion % (student)** is lesson-weighted across all enrollments (completed published lessons / total published lessons).
- **Last activity (per enrollment)** = max of enrollment `created_at`, that enrollment's `lesson_progress` timestamps, and that course's `quiz_attempts` timestamps.
- **Timeline events** use real stored timestamps only (never fabricated): `enrollments.created_at`, `lesson_progress.started_at`/`completed_at` (published lessons only), `quiz_attempts.started_at`/`submitted_at`, and derived course completion at `max(lesson.completed_at)` among the enrollment's completed published lessons. Sorted newest → oldest; displayed capped at 100 events.
- **Insights are counts of facts** (e.g., "3 students are at 0% progress"), never predictive/qualitative claims.

## 3. Data sources

All reads go through existing RLS. Queries used:

| Data | Source table(s) | Filtering |
|---|---|---|
| Enrollments (student) | `enrollments` + nested `courses` | `student_id = ctx.studentId` (RLS-scoped) |
| Enrollments (staff course) | `enrollments` + nested `students` | org-scoped (RLS), no row limit |
| Course content | `course_content` → `modules` → `lessons` | `getCourseContents` / `getCourseContent` |
| Lesson progress | `lesson_progress` | `getLessonProgressRows` (batch `enrollment_id IN`) |
| Quizzes (published) | `quizzes` | `course_id IN` + `is_published = true` |
| Quiz attempts | `quiz_attempts` | `student_id =` (student) or `quiz_id IN` (staff) |
| Question answers | `quiz_attempt_answers` | `attempt_id IN` (submitted attempts only) |

## 4. Authorization model

- Route guards unchanged: student dashboard uses `requireStudentContext`; staff pages use `requireStudentViewContext` (students view), `canManageCourses` (course quiz question editing), and existing role gating.
- All analytics sections render **staff-only** on course/student/quiz pages; students see only their own existing course-progress and attempts views.
- No client-supplied identifiers are trusted for authorization; URLs are lookup identifiers only. Search/filter query params (`student`, `estatus`, `completion`) are validated against allow-lists/whitelists before use.

## 5. Query strategy

- `src/lib/analytics.ts` centralizes batched loaders and pure computations.
- `loadStudentLearningData` issues a bounded set of queries: enrollments, contents (batched), progress rows (batched by enrollment), published quizzes (batched), attempts — no per-course N+1.
- Staff course page: `getLessonProgressRows` (one `IN` query) + one attempts `IN` query + contents reuse; the enrollments list is capped at 100 rows for display while analytics are computed over the full enrollment set.
- Staff quiz page: one attempts query (no `limit`) + one answers `IN` query over submitted attempt ids.
- All joins/IN-queries use existing indexed relationships.

## 6. Files created

- `src/lib/analytics.ts` — shared analytics types + pure helpers and batched loader.
- `src/app/(protected)/dashboard/analytics/ui.tsx` — shared analytics UI components.
- `docs/phase-14-learner-analytics.md` — this document.

## 7. Files modified

- `src/lib/progress.ts` — added `getLessonProgressRows` batch loader (`LessonProgressDetailRow`).
- `src/app/(protected)/dashboard/page.tsx` — student branch refactored to `loadStudentLearningData`; "My learning analytics" grid; container widened to `max-w-3xl` for students.
- `src/app/(protected)/dashboard/courses/[id]/page.tsx` — staff analytics computation + Course analytics / Learning insights / Student performance sections; enrollments list now shows derived completion from analytics; display list capped at 100.
- `src/app/(protected)/dashboard/students/[id]/page.tsx` — Learning analytics grid, Per-course learning table, Learning timeline (staff); quiz attempts list sourced from the batched loader.
- `src/app/(protected)/dashboard/courses/[id]/quizzes/[quizId]/page.tsx` — staff Quiz analytics + Question performance; staff attempts query no longer limited to 100.

## 8. Security / RLS

- No new policies, no `USING(true)`, no service-role key; all analytics reads are RLS-scoped to the signed-in profile's organization (staff) or own records (student).
- Defense-in-depth: `student_id = ctx.studentId` filters on the student path; published-only filtering is applied at the query and computation layers.
- Query-string filters are validated against allow-lists; arbitrary values are ignored.

## 9. Database changes

- Migration created: **NO**
- Migration applied: **N/A**
- **DATABASE CHANGES: NONE**

## 10. Validation results

- `npx tsc --noEmit` — **PASS**
- `npm run lint` — **PASS** (0 errors, 0 warnings)

## 11. Manual testing results

- **Automated / unauthenticated (PASS, executed):** `/login` 200; `/dashboard`, `/dashboard/courses/[id]`, `/dashboard/students/[id]`, `/dashboard/courses/[id]/quizzes/[quizId]` all 307 → `/login`. No new ERROR entries in the dev log.
- **Authenticated (NOT RUN — requires real ADMIN/INSTRUCTOR/SALES/COUNSELOR/STUDENT logins):** metric accuracy vs. manual queries, staff course/student/quiz analytics rendering, timeline ordering, performance-table filters, cross-org isolation, unpublished-quiz exclusion, and the enrolled-courses "Continue Learning" list regression check.

## 12. Known limitations

1. Quiz analytics only include attempts on currently-published quizzes; attempts on quizzes later unpublished are excluded (documented metric choice).
2. Timeline cannot represent a "lesson re-opened" event because `lesson_progress` is a single row per enrollment/lesson (no event history); only start/completed are emitted.
3. `enrollments.status` does not auto-transition to `completed` (Phase 12 known limitation); completion is derived.
4. `students.profile_id` may be unlinked (Phase 6 provisioning migration unapplied) — end-to-end student analytics not exercisable without it.
5. The staff course enrollment list renders the most recent 100 enrollments; analytics numbers cover all enrollments.
6. Student-detail quiz attempt list is capped at the 20 most recent attempts; quiz analytics on the quiz page covers all attempts.

## 13. Recommended Phase 15

- Optional: persist derived aggregates (enrollment analytics snapshots) for large-org performance — requires a migration (out of scope for this phase).
- Optional: export views (CSV) of the performance tables; drill-through from insight counts to filtered student lists.