# Phase 12 — Lesson Progress & Course Completion

## 1. What was implemented

Per-enrollment lesson progress on the existing `lesson_progress` table, with course completion derived from it:

- **Lesson progress state machine** (`not_started → in_progress → completed`) recorded per enrollment per lesson, with `started_at`, `completed_at`, `last_accessed_at` maintained to satisfy the table CHECK constraints.
- **Student controls on the lesson page**: "Start lesson" (marks `in_progress`) and "Complete lesson" (marks `completed`); completed lessons show a "✓ Completed" badge with the completion timestamp. Mutations run through idempotent, concurrency-safe server actions.
- **Course progress card** on the course detail page: "X of Y lessons completed", a progress bar, percentage, and a "✓ Course completed" state. Course completion is **derived** (`active` enrollment + all published lessons completed; 0% and "No lessons available yet." when there are no published lessons — never a misleading 100%).
- **Content-tree indicators** on the course detail page: ✓ (completed) / ● (in progress) / ○ (not started) per lesson for the enrolled student.
- **Staff visibility**: the course detail page now shows each enrollment's "X/Y lessons · Z%".
- **Student dashboard section** "My courses": enrolled active courses with title, progress bar, percentage, and completed counts (batch queries, no N+1).

## 2. Routes

- `/dashboard/courses/[id]/lessons/[lessonId]` — existing lesson view; student branch now renders progress controls + course progress card. Unchanged for staff.
- `/dashboard/courses/[id]` — existing course detail; adds the Course progress card + content-tree indicators (student) and per-enrollment progress (staff).
- `/dashboard` — existing dashboard; adds the "My courses" section for students.
- No new routes. No new pages.

## 3. Server actions

All in `src/app/(protected)/dashboard/courses/[id]/lessons/actions.ts`:

| Action | Context | Purpose |
| --- | --- | --- |
| `startLesson` | `requireStudentContext` | Mark a lesson `in_progress` (sets `started_at`/`last_accessed_at`); idempotent |
| `completeLesson` | `requireStudentContext` | Mark a lesson `completed` (sets `started_at`/`completed_at`/`last_accessed_at`); idempotent |

Both actions:
- Re-resolve the enrollment server-side (RLS `select_own` + `student_id = ctx.studentId` + `status = 'active'`); a student cannot mutate progress without an active, owned enrollment.
- Re-resolve the lesson server-side (RLS published-only for students) and verify its module's `course_id` matches the enrollment's `course_id`, so progress cannot be recorded against a lesson outside the enrolled course.
- Treat an already-`completed` row as a no-op (no regressions: `completed → in_progress/not_started` is impossible).
- On insert races, catch unique-violation `23505`, re-read, and apply a conditional update — safe under concurrent double-clicks.

## 4. Roles and permissions

| Role | Record progress | See own progress | See others' progress |
| --- | --- | --- | --- |
| ADMIN | — (no enrollment) | — | All (staff policy) |
| INSTRUCTOR | — | — | All (staff policy) |
| SALES | — | — | All (staff policy) |
| COUNSELOR | — | — | All (staff policy) |
| STUDENT | Own active enrollment only (server-side + RLS insert/update own) | Own only (RLS select own) | — |

## 5. Progress state machine

- `not_started`: `started_at` and `completed_at` are NULL.
- `in_progress`: `started_at` set, `completed_at` NULL.
- `completed`: both set.
- Transitions allowed: `not_started → in_progress`, `not_started → completed`, `in_progress → completed`. No regressions.
- The DB CHECK constraints `(status='not_started') = (started_at is null and completed_at is null)` and `status <> 'completed' OR completed_at is not null` are always satisfied by the action logic.

## 6. Course completion (derived)

- Completed when: enrollment is `active`, the course is published (RLS-scoped for students), at least one lesson is published, and every published lesson for the course has progress `completed`.
- `deriveProgress(completed, total)` in `src/lib/progress.ts` computes `percent = round(completed/total*100)`; `total = 0` → 0% + "No lessons available yet." (never 100%).
- The `enrollments.status` `active → completed` transition is **staff-only** (RLS `enrollments_write_org_staff`; students have no update policy). The UI therefore derives completion instead of writing `status = 'completed'`.

## 7. Performance

- No N+1. The course page batches: `getLessonProgressMap` (one query per own enrollment), `getCompletedCountsByEnrollment` (one `IN` query per enrollment list), reusing `getLessonCountsByCourse`.
- The dashboard fetches active enrollments (RLS-scoped), lesson counts per course, and completed counts per enrollment — three queries total, then in-memory mapping.

## 8. RLS behavior

No RLS changes. All policies already exist in the migration:
- `lesson_progress_select_staff` / `lesson_progress_write_staff` / `lesson_progress_update_staff` — staff read/write.
- `lesson_progress_select_own` / `lesson_progress_write_student_own` / `lesson_progress_update_student_own` — students read/write their own rows via `students.profile_id = auth.uid()`.
- `lessons_select_student_published` — students only read published lessons of published courses; `lesson_progress` joins/cross-checks are therefore safe.
- `enrollments_select_own` + `enrollments_write_org_staff` — students can never flip enrollment status; completion stays derived.

## 9. Database changes

- Migration created: **NO**
- Migration applied: **N/A**
- No database changes required. The existing schema fully supports this phase.

## 10. Validation results

- `npx tsc --noEmit` — **PASS**
- `npx eslint "src/**/*.{ts,tsx}"` — **PASS** (0 errors, 0 warnings)

## 11. Manual testing results

- **Automated / unauthenticated (PASS, executed):** the lesson view route, course detail, dashboard, and quiz routes all return 307 → `/login`; `/login` 200; full regression sweep unchanged. No new ERROR entries in the dev log after the change.
- **Authenticated (NOT RUN — requires a real ADMIN/INSTRUCTOR/SALES/COUNSELOR/STUDENT login):** start/complete a lesson, double-submit idempotency, indicator ✓/●/○ rendering, course progress card + completion state, staff "X/Y · Z%" per enrollment, student dashboard section, cross-org isolation, unpublished-lesson denial, regression of quiz/menu navigation.

## 12. Known limitations

1. **Automatic `enrollments.status = 'completed'` is not implemented.** Students cannot update enrollment status (RLS), and the staff-only transition would require a DB RPC/trigger to flip automatically. Completion is therefore a **derived UI state** (`Course completed`), not a stored enrollment status. A future migration could add a trigger on `lesson_progress` to flip `active → completed` when all published lessons are done.
2. **Student identity requires `students.profile_id` to be linked** to an auth profile. The Phase 6 provisioning migration is still **not applied**, so the student progress flow is not exercisable end-to-end until a profile is linked (same limitation as Phase 11).
3. **Progress is not gated on content.** A student can mark a lesson complete without reading it (no content-view tracking). Lesson-level "readiness" (e.g., watch duration, quiz gate) is product scope for a later phase.
4. **Staff progress is read-only on the course page** (display only). Management of a student's progress (fixing mistakes) is not offered; it would need new staff write actions in a future phase.

## 13. Recommended Phase 13

Next highest-value candidates (pick one):
- **Student progression UX**: module-level completion summaries, a "Continue learning" next-lesson affordance on the dashboard, and locked/unlocked sequencing driven by progress.
- **Quiz gating on content completion** (already anticipated in Phase 11 §13): require `lesson_progress.status = 'completed'` for the module's lessons before a quiz can be attempted.
- **Learner analytics**: staff dashboard with per-course completion heat-maps and per-student progress timelines (uses the same `lesson_progress` data).
