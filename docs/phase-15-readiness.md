# Phase 15 — Learner Readiness & Assessment Intelligence

## 1. Existing schema inspection

### lesson ↔ quiz relationship

The schema **does not contain** an explicit lesson-to-quiz relationship:

| Table | Relevant columns | Relationship to quiz |
|-------|------------------|----------------------|
| `lessons` | `lesson_id`, `module_id`, `title`, `position`, `is_published` | No `quiz_id` column |
| `quizzes` | `quiz_id`, `course_id`, `title`, `pass_threshold`, `is_published` | No `lesson_id` column; only `course_id` |
| `quiz_questions` | `quiz_id`, `question_id`, `position`, etc. | Links only to `quizzes` |
| `quiz_attempts` | `quiz_id`, `student_id`, `submitted_at`, `score`, `max_score` | Links only to `quizzes` |

**Conclusion:** Quizzes are **course-scoped**, not lesson-scoped. There is no authoritative way to determine "which quiz belongs to which lesson" or "which lessons must be completed before attempting a quiz."

### Attempt limits

The schema has **no maximum attempt count** on `quizzes` or `quiz_attempts`. The only constraint is that `quiz_attempts.submitted_at` is NULL for drafts and NOT NULL for submitted attempts, with `score`/`max_score` populated only on submitted attempts.

## 2. Architecture decision

**PATH B — Schema does not support true quiz gating**

- True lesson→quiz gating (enforcing "complete lesson X before quiz Y") **cannot be represented** in the current schema.
- The application layer will **not invent** a gating mechanism or pretend it exists.
- Readiness features that rely on a lesson↔quiz relationship are **blocked pending architecture approval**.
- What **can** be safely implemented (PATH A portions):
  - Lesson readiness states (not_started / in_progress / completed) from `lesson_progress`.
  - Quiz readiness states (not_attempted / in_progress / passed / failed) from `quiz_attempts` + `quizzes.pass_threshold`.
  - Course completion — Phase 12/13 rule preserved (active enrollment + published course + ≥1 published lesson + all published lessons completed).
  - "Assessment available" as a **recommended ordering** state (Phase 13 priority: lessons → quiz → completed), **not** an enforced gate. Learners may still start a published course quiz at any time under the current architecture.
  - Recommended next action using Phase 13 priority (lessons first, then quiz, then review, then completed).
  - Staff readiness distribution (counts per state across enrollments).
  - Extended deterministic insights.

**IMPLEMENTATION BLOCKED — ARCHITECTURE DECISION REQUIRED** for:
- Enforcing lesson→quiz gating (requires `lessons.quiz_id` or `quizzes.lesson_id` column + migration + RLS update).
- Enforcing a maximum attempt limit (requires `quizzes.max_attempts` column + application enforcement).

## 3. Readiness model

### Per-quiz readiness states

| State | Definition |
|-------|------------|
| `not_attempted` | No `quiz_attempts` row for this student/quiz. |
| `in_progress` | A draft attempt exists (`submitted_at` is null). |
| `passed` | At least one submitted attempt with `round(score/max_score × 100) ≥ pass_threshold`. |
| `failed` | Submitted attempt(s) exist, but none satisfy the pass threshold. |

### Per-enrollment/course readiness states

| State | Condition |
|-------|-----------|
| `not_started` | No published lessons completed, no lesson progress, no quiz attempts. |
| `in_progress` | Some published lessons incomplete (or activity exists but lessons not complete). |
| `assessment_available` | All published lessons complete + ≥1 published quiz with no passed attempt AND no failed submission (i.e., not_attempted or in_progress only). |
| `needs_review` | All published lessons complete + ≥1 published quiz with a failed submission and no passed attempt. |
| `passed` | All published lessons complete + all published quizzes have a passed attempt. |
| `completed` | All published lessons complete (Phase 12/13 rule). When quizzes exist and all are passed, `passed` is shown instead for more detail. |

**Note:** These are **derived UI states**, not database enums/columns.

### Recommended next action priority (per enrollment)

1. Continue incomplete lesson (first in content order with status ≠ completed).
2. Complete remaining required lessons (implicit in #1).
3. Attempt available assessment (first quiz with state `not_attempted` or `in_progress`).
4. Review failed assessment (first quiz with state `failed`).
5. Completed (no action needed).

This ordering **only** applies when the underlying data supports it (i.e., lessons incomplete → lesson action; lessons complete + pending quiz → quiz action; etc.).

## 4. Readiness rules

- **Lesson status**: directly from `lesson_progress.status` (not_started / in_progress / completed).
- **Quiz pass rule**: `round(score/max_score × 100) ≥ pass_threshold` (Phase 11 rule).
- **Quiz availability**: A quiz is "available" for a student if the quiz is published, the course is published, and the student has an active enrollment in the course (RLS enforces this). There is **no hard gate** on lesson completion.
- **Retry availability**: Unlimited (schema has no `max_attempts`).
- **Course completion**: Phase 12/13 derived rule — active enrollment + published course + ≥1 published lesson + all published lessons completed. Quiz results do **not** gate course completion.

## 5. Security model

- Every page/helper/action enforces:
  - Authenticated user (`getCurrentProfile`).
  - Server-side role validation (`requireStudentContext`, `requireStudentViewContext`, `canManageCourses`).
  - Organization derived from profile (`current_org_id()`).
  - Student ownership where applicable (student context, RLS).
  - Existing RLS — no service-role key, no `USING(true)`, no client-trusted identifiers.
  - Cross-org/cross-student access prevented by RLS and server-side checks.
- URL IDs are lookup identifiers only; sensitive resources re-fetched under RLS.

## 6. Performance strategy

- **No N+1 queries**: All readiness computations use batched `IN` queries (`getLessonProgressRows`, `getCourseContents`, quiz/attempt `IN` filters) and in-memory Maps for aggregation.
- `src/lib/readiness.ts` contains only pure functions; data fetching remains in pages.
- `Promise.all` used for parallel independent queries (content, progress, quizzes, attempts).
- Readiness queries are bounded (one per course/enrollment set).

## 7. Files created

- `src/lib/readiness.ts` — core readiness library (pure functions, types, badge helpers, action helpers).
- `docs/phase-15-readiness.md` — this document.

## 8. Files modified

- `src/app/(protected)/dashboard/page.tsx` — Student dashboard: added "Learning readiness" section with global recommended next step + per-course readiness list (state badge, lessons completed/remaining, quiz states, action button). Replaced My courses `nextAction` usage with shared `recommendedAction` helpers.
- `src/app/(protected)/dashboard/courses/[id]/page.tsx` — Course detail:
  - Student: added "Learning readiness" card (state badge, message, lesson/quiz breakdown, recommended action).
  - Staff: added "Readiness overview" AnalyticsSection (6 metric counts + per-enrollment readiness table with state badge + recommended action) and "Readiness insights" section (deterministic counts for assessments available / needs review / passed / completed / no activity).
- `src/app/(protected)/dashboard/courses/[id]/lessons/[lessonId]/page.tsx` — Lesson detail (student): added "Lesson readiness" card (status badge, completed-at timestamp, next lesson link, factual note that assessments are course-scoped, not lesson-scoped).
- `src/app/(protected)/dashboard/courses/[id]/quizzes/[quizId]/page.tsx` — Quiz detail:
  - Student: added "Your readiness" card (state badge, attempt counts, best/last score, retry note, no attempt limit notice).
  - Staff: added "Readiness distribution" AnalyticsSection (4 metric counts: not attempted, in progress, passed, failed) across active enrollments for this quiz.

## 9. Routes changed

| Route | Changes |
|-------|---------|
| `/dashboard` | Student: Learning readiness section with global + per-course cards. |
| `/dashboard/courses/[id]` | Student: Learning readiness card. Staff: Readiness overview + Readiness insights. |
| `/dashboard/courses/[id]/lessons/[lessonId]` | Student: Lesson readiness card + assessment scope note. |
| `/dashboard/courses/[id]/quizzes/[quizId]` | Student: Your readiness card. Staff: Readiness distribution. |

## 10. Database changes

- **Migration created: NO**
- **Migration applied: N/A**
- **DATABASE CHANGES: NONE**

## 11. Validation results

- `npx tsc --noEmit` — **PASS**
- `npm run lint` — **PASS** (0 errors, 0 warnings)

## 12. Manual testing results

- **Automated / unauthenticated (PASS, executed):** `/login` 200; `/dashboard`, `/dashboard/courses/[id]`, `/dashboard/courses/[id]/lessons/[lessonId]`, `/dashboard/courses/[id]/quizzes/[quizId]`, `/dashboard/courses/[id]/quizzes/[quizId]/attempt`, `/dashboard/courses/[id]/quizzes/[quizId]/attempts/[attemptId]`, `/dashboard/students/[id]` all 307 → `/login`. No new ERROR entries in dev log.
- **Authenticated (NOT RUN — requires real ADMIN/INSTRUCTOR/SALES/COUNSELOR/STUDENT logins):** Readiness badge accuracy, recommended next action ordering, student readiness state transitions, staff readiness distribution counts, cross-org isolation, unpublished-quiz denial, forged-identifier rejection.

## 13. Known limitations

1. **Lesson→quiz gating is not enforced** — assessments remain available to enrolled learners regardless of lesson completion (by architecture, not bug). The "Assessment available" state is a recommended ordering, not a gate.
2. **No attempt limits** — the schema does not have `max_attempts`; the UI never claims a limit exists.
3. **Lesson readiness on lesson page** shows assessment scope note but does not imply a quiz belongs to the lesson.
4. **Student.profile_id may be unlinked** (Phase 6 provisioning migration unapplied) — end-to-end student readiness not exercisable without it.
5. **Course completion remains lesson-based** (Phase 12/13 rule). Quiz-passed state is shown as additional detail ("Passed") but does not alter completion.
6. **Staff readiness distribution on quiz page** counts only active enrollments; paused/cancelled/completed enrollments are excluded.

## 14. Recommended Phase 16

- **Architecture decision required** for lesson↔quiz relationship:
  - Option A: Add `lessons.quiz_id` (nullable FK) — each lesson can have at most one quiz.
  - Option B: Add `quizzes.lesson_id` (nullable FK) — each quiz can be tied to one lesson.
  - Option C: Add join table `lesson_quizzes` — many-to-many for complex structures.
  - Migration + RLS policy updates + backward compatibility (existing course-scoped quizzes remain valid, new lesson-scoped quizzes opt-in).
- Optional: `quizzes.max_attempts` for retry limits (requires schema + application enforcement + RLS).