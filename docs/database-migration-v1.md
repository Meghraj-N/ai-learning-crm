# V1 Database Migration — Implementation Record

**Status:** MIGRATION CREATED — not yet applied to Supabase.
**Migration file:** `supabase/migrations/20260817024257_initial_schema.sql`
**Source of truth:** `docs/database-architecture-v1.md` (approved decisions A1–A16)

---

## 1. What was created

Single initial migration containing the complete approved V1 schema:

| # | Table | Notes |
|---|---|---|
| 1 | `organizations` | Tenant root; RESTRICT delete from all children |
| 2 | `profiles` | 1:1 with `auth.users`; role CHECK; auto-created by `handle_new_user()` trigger |
| 3 | `leads` | Pipeline + conversion (`student_id`, `converted_at`, `converted_by`); soft delete |
| 4 | `lead_activities` | Append-only timeline; select + insert policies only |
| 5 | `followups` | `pending/completed/cancelled`; `reminder_at` for automation |
| 6 | `students` | Business record; optional `profile_id`; soft delete |
| 7 | `courses` | `draft/published/archived` lifecycle |
| 8 | `course_modules` | `UNIQUE (course_id, position)` |
| 9 | `lessons` | `UNIQUE (module_id, position)`; `is_published` |
| 10 | `enrollments` | `active/paused/completed/cancelled`; partial-unique one open enrollment |
| 11 | `lesson_progress` | Composite PK `(enrollment_id, lesson_id)`; no stored percentages |
| 12 | `quizzes` | Course-scoped; `pass_threshold` |
| 13 | `quiz_questions` | JSONB options/correct_answer; `UNIQUE (quiz_id, position)` |
| 14 | `quiz_attempts` | Draft vs submitted; score/max_score snapshot; multiple attempts allowed |
| 15 | `quiz_attempt_answers` | Per-question results; composite PK |
| 16 | `ai_conversations` | Lead XOR student binding; nullable owner |
| 17 | `ai_messages` | Per-turn rows; `(conversation_id, created_at)` index |

## 2. Key constraints

* `leads`: `(status='converted') = (student_id IS NOT NULL AND converted_at IS NOT NULL)`; `score BETWEEN 0 AND 100`
* `enrollments`: partial unique `(student_id, course_id) WHERE status IN ('active','paused')`
* `students`: partial unique `(organization_id, lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL`
* `lesson_progress`: `(status='not_started') = (started_at IS NULL AND completed_at IS NULL)`; completed requires `completed_at`
* `quiz_attempts`: draft ⇔ no score; `score BETWEEN 0 AND max_score`
* `quiz_questions`: `jsonb_typeof(options/correct_answer) = 'array'`
* `ai_conversations`: `lead_id IS NULL OR student_id IS NULL` (XOR)
* Ordering: `UNIQUE (course_id, position)`, `UNIQUE (module_id, position)`, `UNIQUE (quiz_id, position)`
* Roles/statuses: all `text` + CHECK (no enums, migration-friendly)
* `profiles`: `email = lower(email)`

## 3. Indexes (32 total)

Per §7 of the architecture document: pipeline (`leads (org,status)`, `(org,assigned_to,status)`), follow-up scheduler `(assigned_to, status, due_at)`, timelines `(lead_id, occurred_at DESC)` + `(org, occurred_at DESC)`, student/enrollment views, course navigation (unique ordering indexes), progress `(lesson_id)`, attempts, conversation lists, message threads. No speculative indexes.

## 4. RLS

* **Helper functions (SECURITY DEFINER, `search_path=''`):** `current_org_id()`, `current_user_role()`, `has_role(text[])` — derive org/role exclusively from `auth.uid()` → `profiles`. Client-supplied `organization_id`/`user_id`/`role` never authorize anything.
* **RLS enabled on all 17 tables** (62 policies total).
* **Pattern:** org-scoped staff policies (`organization_id = current_org_id() AND has_role(...)`), owner-scoped student policies (via `students.profile_id = auth.uid()` chains), append-only for `lead_activities`, admin-only role/membership writes.
* **Escalation guard:** `prevent_profile_privilege_escalation()` BEFORE UPDATE trigger — non-admins cannot change `role`, `organization_id`, or `is_active` (RLS cannot compare OLD/NEW).
* No `USING (true)` anywhere. Anonymous sessions (`auth.uid()` NULL) see nothing.
* Subordinate tables without `organization_id` (`lesson_progress`, `quiz_attempts`, `quiz_attempt_answers`, `ai_messages`) resolve org through their FK chain in policies.

## 5. Delete behavior

* RESTRICT: all `organization_id` FKs (no org deletion path); `enrollments.course_id` (archive instead)
* SET NULL: all `profiles` references (staff deletion never destroys history); `leads.student_id`; conversation lead/student/owner refs
* CASCADE: content trees (courses→modules→lessons, quizzes→questions) and subordinate history (activities, followups, progress, attempts, answers, messages) — only reachable via physical purge of the parent
* Soft delete: `leads.deleted_at`, `students.deleted_at` only

## 6. Validation performed

| Check | Result |
|---|---|
| Manual review of full 1,170-line migration | PASS (all 17 tables, FKs, delete behavior, indexes, constraints verified against architecture doc) |
| Structural counts | PASS — 17 tables, 32 indexes, 62 policies, 17 RLS-enabled, 6 functions, 16 triggers |
| `npm run lint` | PASS (no output/errors) |
| `npx tsc --noEmit` | PASS (no output/errors) |
| SQL execution | NOT RUN — no Supabase CLI/psql/Docker available; user applies via Supabase SQL editor |
| Supabase verify | NOT RUN |

## 7. Assumptions

* `pgcrypto` extension already available in Supabase (enabled by default); `create extension if not exists` is a safe no-op otherwise.
* `anon`, `authenticated`, `service_role` roles exist (Supabase default).
* Migration is applied by an account with `postgres`/owner privileges (Supabase SQL Editor).
* **No seed data** — dev seed requires real `auth.users` IDs and is environment-specific; deferred to a separate step after the migration is applied.
* One robustness addition beyond the doc: `handle_new_user()` coalesces a NULL `auth.users.email` to `''` so phone-only signups don't break the trigger.

## 8. Remaining action (user)

1. Open Supabase Dashboard → SQL Editor (or `supabase db push` with CLI).
2. Run `supabase/migrations/20260817024257_initial_schema.sql` in full.
3. Confirm no errors; optionally verify with the queries below.
4. Then create dev seed (1 org + admin profile) using the real auth user ID.

### Post-apply verification queries

```sql
select tablename from pg_tables where schemaname = 'public' order by tablename; -- expect 17 rows
select count(*) from pg_policies where schemaname = 'public';                     -- expect 62
select relrowsecurity from pg_class where relname = 'leads';                       -- expect true
select proname from pg_proc where pronamespace = 'public'::regnamespace order by 1; -- helper functions
```