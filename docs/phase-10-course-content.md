# Phase 10 — Course Content Management (Modules + Lessons)

## 1. What was implemented

Course content management for the AI Learning & CRM Hub:

- Module management: create, edit (title), reorder (move up/down)
- Lesson management: create, edit (title/content/published), publish/unpublish toggle, reorder (move up/down)
- Staff content tree on the course detail page (ADMIN / INSTRUCTOR manage; SALES / COUNSELOR view)
- Student published-content view: course detail shows published modules/lessons, and a lesson renderer with previous/next navigation

Scope is strictly course content. Learning progress, quizzes, AI, and student signup are explicitly out of scope (later phases).

## 2. Routes

- `/dashboard/courses` — existing catalog (unchanged)
- `/dashboard/courses/[id]` — course detail; now includes the full module/lesson content tree with management controls for ADMIN/INSTRUCTOR and published-only content for students
- `/dashboard/courses/[id]/edit` — existing course edit (unchanged)
- `/dashboard/courses/[id]/lessons/[lessonId]` — **new** lesson renderer (staff + students; students see only published lessons)

No separate `/content` nested routes were added — the existing course detail page is reused as the content manager to avoid route duplication.

## 3. Server actions

All in `src/app/(protected)/dashboard/courses/actions.ts`, all gated by `requireCourseWriteContext()` (ADMIN + INSTRUCTOR):

| Action | Purpose |
| --- | --- |
| `createModule` | Append a module at `max(position) + 1` |
| `updateModule` | Edit module title |
| `moveModule` | Swap a module with its neighbor (up/down) |
| `createLesson` | Append a lesson at `max(position) + 1`, always `is_published = false` |
| `updateLesson` | Edit title/content/published |
| `toggleLessonPublished` | Flip `is_published` |
| `moveLesson` | Swap a lesson with its neighbor within its module (up/down) |

Every action authenticates, resolves the profile, derives `organization_id` server-side, validates role, and re-fetches the target resource through RLS-scoped queries. Errors are sanitized; raw DB errors only reach server logs.

## 4. Roles and permissions

| Role | Manage content | View content |
| --- | --- | --- |
| ADMIN | Yes | All (incl. drafts) |
| INSTRUCTOR | Yes | All (incl. drafts) |
| SALES | No | All (via `course_modules_select_staff` / `lessons_select_staff`) |
| COUNSELOR | No | All (via staff policies) |
| STUDENT | No | Published courses only; published lessons only (RLS) |

## 5. Module ordering strategy

- Positions are 1-based contiguous integers per course (`UNIQUE (course_id, position)`).
- Adjacent move only (up/down buttons), three-step sentinel swap to avoid any temporary `UNIQUE` violation:
  1. Move target to `POSITION_SENTINEL` (1000000)
  2. Move neighbor into the target's old slot
  3. Move target into the neighbor's old slot
- Contiguity is preserved (adjacent swap), bounds are disabled in the UI (`position <= 1` / `position >= total`).
- Multi-statement, non-transactional (Supabase client has no multi-statement transactions and an RPC is out of scope). Documented limitation: a failure between steps could leave the sentinel position applied; the next action on that item is bounded by the sentinel guard, and a manual position normalization in the DB would be the recovery. Risk is low (small N).

## 6. Lesson ordering strategy

Identical to modules, scoped to `UNIQUE (module_id, position)`. Lessons never move across modules.

## 7. Publishing behavior

- New lessons are created with `is_published = false` (explicitly set, matching the DB default). They are never visible to students until published.
- Publishing/unpublishing is a one-click toggle (ADMIN/INSTRUCTOR only) and is also available in the lesson edit form.
- The course itself retains the existing lifecycle (`draft | published | archived`); a published course is required (RLS) for any lesson to reach students.

## 8. Student visibility

Students see, on the course detail page, only modules of their org and only published lessons (both enforced by RLS: `course_modules_select_student_published_course`, `lessons_select_student_published`). The lesson renderer applies the same RLS — an unpublished lesson URL returns "Lesson not found" for students. Previous/next navigation skips unpublished lessons for students.

## 9. RLS behavior

No RLS changes. Staff policies already expose all modules/lessons of the org to admin/sales/counselor/instructor; student policies already restrict to published courses and published lessons. Content actions depend on `courses_write_instructor_admin`/`course_modules_write_instructor_admin`/`lessons_write_instructor_admin` (org + admin/instructor) — sales/counselor writes are rejected by both the server context check and RLS.

## 10. Database changes

- Migration created: **NO**
- Migration applied: **N/A**
- No database changes were required. The existing schema fully supports this phase.

## 11. Validation results

- `npx tsc --noEmit` — **PASS**
- `npm run lint` — **PASS** (0 errors, 0 warnings)

## 12. Manual testing results

- **Automated / unauthenticated (PASS, executed):** `/dashboard/courses/abc/lessons/xyz` → 307 `/login`; regressions `/login` (200), `/api/supabase-test` (success), all dashboard routes → 307 `/login`.
- **Authenticated (NOT RUN — requires a real ADMIN/INSTRUCTOR/SALES/COUNSELOR/STUDENT login):** module create/edit/reorder, lesson create/edit/publish/reorder, ordering uniqueness/contiguity, student published-only visibility, cross-org isolation, URL access to unpublished lessons by students.

## 13. Known limitations

1. Reorder is non-transactional (3 statements) — see ordering strategy above.
2. The content tree loads full lesson content for staff edit forms in one extra query; acceptable at MVP scale, could be moved to on-demand fetch if courses grow large.
3. No lesson delete (no delete policy existed / lifecycle model prefers archive + unpublished). Not part of the approved architecture.
4. Course detail/lesson pages only fully compile on first authenticated render; tsc/lint cover type and import correctness.
5. Editing is per-field inline forms; no drag-and-drop (deliberately out of scope for V1).

## 14. Recommended Phase 11

Quizzes foundation: the schema already contains `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_attempt_answers` with staff write + student attempt policies. Phase 11 should add quiz CRUD per course, question management, and (with enrollments/lessons already in place) the student attempt flow, leaving `lesson_progress` for Phase 12.
