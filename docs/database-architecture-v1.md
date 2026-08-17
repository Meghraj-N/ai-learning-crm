# AI Learning & CRM Hub — V1 Database Architecture Proposal

> **Status:** PROPOSAL — pending explicit approval. No SQL migration has been written or executed.
> **Role:** Database Architect + Senior Backend Engineer
> **Stack constraints:** Supabase PostgreSQL, UUID PKs, `timestamptz`, `snake_case`, Row Level Security mandatory, multi-tenant-ready (single-tenant UI in V1).

---

## 1. Executive Summary

The V1 schema is a single PostgreSQL database with **17 tables** organized into five domains:

| Domain | Tables |
|---|---|
| Tenant core | `organizations`, `profiles` |
| CRM | `leads`, `lead_activities`, `followups` |
| LMS content | `courses`, `course_modules`, `lessons`, `quizzes`, `quiz_questions` |
| LMS learners | `students`, `enrollments`, `lesson_progress`, `quiz_attempts`, `quiz_attempt_answers` |
| AI (future) | `ai_conversations`, `ai_messages` |

Key architectural decisions:

1. **Multi-tenant by design, single-tenant in use.** Every top-level business table carries `organization_id`. RLS derives the organization from the authenticated user's `profiles` row — never from client-supplied values.
2. **Authentication identity and business records are separated.** `auth.users` → `profiles` (1:1, platform identity + role) and `students` (organization business record). A student may optionally link to a profile for future login, without requiring one today.
3. **Lead → Student conversion is one-directional.** `leads.student_id` (nullable) points at the converted student. Contact data is copied once at conversion; the lead keeps its own immutable snapshot. Conversion is additionally recorded as a `converted` lead activity.
4. **Progress is derived, not duplicated.** `lesson_progress` stores only status + timestamps per `(enrollment, lesson)`. Completion percentages are computed in queries.
5. **Quiz answers get their own table** (`quiz_attempt_answers`) because per-question review, grading, and analytics are required for the AI tutor / quiz-generation roadmap.
6. **AI conversations are threads** (`ai_conversations`) with a separate `ai_messages` table — required for pagination, streaming, and debugging.
7. **Soft delete is applied only where business value demands it** (`leads`, `students`). Courses use an explicit `status` lifecycle instead. Everything else uses real status transitions.
8. **Database-level integrity everywhere:** FK constraints, `CHECK` constraints for statuses, partial unique indexes for deduplication, and composite primary keys where natural.

The schema is deliberately minimal: only two tables were added beyond the required entity list (`quiz_attempt_answers`, `ai_messages`), each justified in its section.

---

## 2. Entity Relationship Model

```
                          +--------------------+
                          |   organizations    |
                          +--------------------+
                                   |
                  +----------------+----------------+
                  |                                 |
       +----------v----------+          +-----------v------------+
       |     profiles        |          |        leads           |
       | (auth.users 1:1,    |          | (status, score,        |
       |  role, org member)  |          |  assigned_to)          |
       +----------+----------+          +-----------+------------+
                  |                                 |
                  | (optional                  |   | (conversion)
                  |  login)                    |   +------------+
                  |                            v                |
       +----------v----------+          +-------------------+   |
       |      students       |<---------|  leads.student_id  |   |
       | (business record,   |  (nullable FK, one direction)|   |
       |  no lead FK)        |          +-------------------+   |
       +----------+----------+                                   |
                  |                                              |
       +----------v----------+          +--------------------+   |
       |    enrollments      |          |  lead_activities   |   |
       | (student x course,  |          |  (activity_type,   |   |
       |  status lifecycle)  |          |   metadata JSONB)  |   |
       +----------+----------+          +---------+----------+   |
                  |                                 |            |
       +----------v----------+          +-----------v--------+   |
       |  lesson_progress    |          |     followups       |   |
       | (enrollment x       |          | (assigned_to,       |   |
       |  lesson, status,    |          |  due_at, priority)  |   |
       |  timestamps)        |          +--------------------+   |
       +---------------------+                                   |
                                                                 |
   (organization_id on all top-level tables)                     |
                                                                 |
   LMS CONTENT                                                    |
   +--------v-------------+          +-------------+-------------+
   |      courses         |          |           quizzes        |
   | (status: draft/      |          | (pass_threshold,         |
   |  published/archived) |          |  is_published)           |
   +--------+-------------+          +-----------+-------------+
            |                                  |
   +--------v-------------+          +---------v-------------+
   |   course_modules     |          |    quiz_questions     |
   | (course_id, position)|          | (quiz_id, position,   |
   +--------+-------------+          |  options JSONB,       |
            |                        |  correct_answer JSONB)|
   +--------v-------------+          +---------+-------------+
   |      lessons         |                    |
   | (module_id, position,|          +---------v-------------+
   |  content, published) |          |    quiz_attempts      |
   +----------------------+          | (quiz_id, student_id, |
                                     |  score, max_score)    |
                                     +---------+-------------+
                                               |
                                     +---------v-------------+
                                     | quiz_attempt_answers  |
                                     | (attempt_id x         |
                                     |  question_id)         |
                                     +-----------------------+

   AI DOMAIN
   +--------------------+          +------------------+
   |  ai_conversations  |--------->|   ai_messages    |
   | (user_id, lead_id?,| 1 : N    | (role, content,  |
   |  student_id?)      |          |  created_at)     |
   +--------------------+          +------------------+
```

### 2.1 Foreign key summary

| From | To | On delete |
|---|---|---|
| `profiles.user_id` | `auth.users(id)` | CASCADE (auth lifecycle owns identity) |
| `profiles.organization_id` | `organizations` | RESTRICT |
| `leads.organization_id` | `organizations` | RESTRICT |
| `leads.assigned_to` | `profiles(user_id)` | SET NULL |
| `leads.converted_by` | `profiles(user_id)` | SET NULL |
| `leads.created_by` | `profiles(user_id)` | SET NULL |
| `leads.student_id` | `students` | SET NULL |
| `lead_activities.lead_id` | `leads` | CASCADE |
| `lead_activities.performed_by` | `profiles(user_id)` | SET NULL |
| `followups.lead_id` | `leads` | CASCADE |
| `followups.assigned_to` / `completed_by` / `created_by` | `profiles(user_id)` | SET NULL |
| `students.organization_id` | `organizations` | RESTRICT |
| `students.profile_id` | `profiles(user_id)` | SET NULL |
| `students.created_by` | `profiles(user_id)` | SET NULL |
| `courses.organization_id` | `organizations` | RESTRICT |
| `courses.created_by` | `profiles(user_id)` | SET NULL |
| `course_modules.course_id` | `courses` | CASCADE |
| `lessons.module_id` | `course_modules` | CASCADE |
| `enrollments.student_id` | `students` | CASCADE |
| `enrollments.course_id` | `courses` | RESTRICT |
| `enrollments.enrolled_by` | `profiles(user_id)` | SET NULL |
| `lesson_progress.enrollment_id` | `enrollments` | CASCADE |
| `lesson_progress.lesson_id` | `lessons` | CASCADE |
| `quizzes.course_id` | `courses` | CASCADE |
| `quizzes.created_by` | `profiles(user_id)` | SET NULL |
| `quiz_questions.quiz_id` | `quizzes` | CASCADE |
| `quiz_attempts.quiz_id` | `quizzes` | CASCADE |
| `quiz_attempts.student_id` | `students` | CASCADE |
| `quiz_attempt_answers.attempt_id` | `quiz_attempts` | CASCADE |
| `quiz_attempt_answers.question_id` | `quiz_questions` | CASCADE |
| `ai_conversations.user_id` | `profiles(user_id)` | SET NULL |
| `ai_conversations.lead_id` | `leads` | SET NULL |
| `ai_conversations.student_id` | `students` | SET NULL |
| `ai_messages.conversation_id` | `ai_conversations` | CASCADE |

### 2.2 Delete-behavior rationale

* **RESTRICT on `organizations`** — an organization with any data cannot be deleted; tenant removal is a future SaaS concern handled by a controlled process.
* **RESTRICT on `enrollments.course_id`** — a course with enrollments must not vanish; courses are archived via `status` instead.
* **SET NULL on `profiles` references** — deleting a staff account must never destroy historical business records (leads, follow-ups, enrollments). The reference is nulled; `created_by`/`assigned_to` become "unknown user".
* **CASCADE on subordinate history** — `lead_activities`, `followups`, `lesson_progress`, `quiz_attempts`, `quiz_attempt_answers`, `ai_messages` are child records with no meaning without their parent. CASCADE only takes effect when a parent row is *physically* deleted, which in normal operation never happens for soft-deletable entities (`leads`, `students`).
* **CASCADE on content trees** — `courses → course_modules → lessons` and `quizzes → quiz_questions`: deleting a course definition removes its content tree (the course's `status='archived'` is the intended business path; physical deletion is an admin purge).

---

## 3. Table-by-Table Design

Conventions used throughout:

* Primary keys: `uuid` (`gen_random_uuid()` default), except the natural composite PKs noted explicitly.
* Timestamps: `timestamptz`, default `now()`.
* `organization_id` is `NOT NULL` on every top-level tenant table. Subordinate tables that are *always* accessed through their parent (`lesson_progress`, `quiz_attempts`, `quiz_attempt_answers`, `ai_messages`) omit it; RLS walks the FK chain instead (see §5). This avoids redundant columns while keeping RLS correct.
* `updated_at` is maintained by a shared `set_updated_at()` trigger function applied to every table that carries the column.
* All `CHECK` constraints on status columns use `text` values (not Postgres enums) for migration friendliness; a lookup table can replace them later if roles/statuses grow.

### 3.1 `organizations`

**Purpose:** Tenant root. Exactly one row in V1; multiple in future SaaS.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `organization_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `name` | `text` | no | — | Display name |
| `is_active` | `boolean` | no | `true` | Tenant suspension flag (future SaaS) |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `organization_id`. **Foreign keys:** none. **Unique:** none. **Check:** none. **Indexes:** none beyond PK (single row in V1). **Delete behavior:** RESTRICT via all children.

### 3.2 `profiles`

**Purpose:** Business-facing extension of `auth.users` (1:1). Holds identity snapshot, organization membership, and role. This is the *trusted* source for RLS and authorization — the client never writes role or organization membership here.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `user_id` | `uuid` | no | — | Primary key = `auth.users.id` |
| `organization_id` | `uuid` | yes | `null` | Membership; nullable so a user can exist before assignment, and to allow cross-org admins later |
| `email` | `text` | no | — | Snapshot synced from `auth.users` (normalized lowercase) |
| `full_name` | `text` | no | — | Display name |
| `avatar_url` | `text` | yes | `null` | Avatar (Supabase Storage later) |
| `role` | `text` | no | — | `CHECK (role IN ('admin','sales','counselor','instructor','student'))` |
| `is_active` | `boolean` | no | `true` | Disables access without deleting the account |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `user_id`. **Foreign keys:** `organization_id → organizations(organization_id)` ON DELETE RESTRICT; `user_id → auth.users(id)` ON DELETE CASCADE. **Unique:** none (PK already enforces 1:1). **Check:** `role IN (...5 roles...)`. **Indexes:** `(organization_id)` — org staff directory lookups. **Trigger:** `handle_new_user()` — after INSERT on `auth.users`, create the profile (email + full name from `raw_user_meta_data`). Role is assigned by an admin afterwards; there is no default role.

### 3.3 `leads`

**Purpose:** CRM pipeline record. Person + pipeline state + assignment + score.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `lead_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `first_name` | `text` | no | — | |
| `last_name` | `text` | no | — | |
| `email` | `text` | yes | `null` | Optional — leads may arrive via phone/WhatsApp |
| `phone` | `text` | yes | `null` | |
| `source` | `text` | yes | `null` | Open-ended origin: `website`, `whatsapp`, `referral`, `walk_in`, ... |
| `status` | `text` | no | `'new'` | `CHECK (status IN ('new','contacted','qualified','converted','lost'))` |
| `score` | `smallint` | no | `0` | `CHECK (score BETWEEN 0 AND 100)`; AI lead scoring writes here later |
| `assigned_to` | `uuid` | yes | `null` | Owning salesperson/counselor (profile) |
| `student_id` | `uuid` | yes | `null` | Set on conversion; points at the resulting student |
| `converted_at` | `timestamptz` | yes | `null` | Conversion timestamp |
| `converted_by` | `uuid` | yes | `null` | Who performed the conversion |
| `notes` | `text` | yes | `null` | Free-form intake notes |
| `created_by` | `uuid` | yes | `null` | Who created the lead |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |
| `deleted_at` | `timestamptz` | yes | `null` | Soft delete (see §8) |

**Primary key:** `lead_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `assigned_to → profiles(user_id)` SET NULL; `converted_by → profiles(user_id)` SET NULL; `created_by → profiles(user_id)` SET NULL; `student_id → students(student_id)` SET NULL. **Check constraints:**
* `CHECK (score BETWEEN 0 AND 100)`
* `CHECK (status IN ('new','contacted','qualified','converted','lost'))`
* `CHECK ((status = 'converted') = (student_id IS NOT NULL AND converted_at IS NOT NULL))` — a converted lead must point at a student and carry a timestamp; no other status may.

**Indexes:**
* `(organization_id, status)` — pipeline/kanban queries per org
* `(organization_id, assigned_to, status)` — "my leads" per stage
* `(organization_id, deleted_at)` partial — active-leads lists skip soft-deleted rows
* `(student_id)` — reverse lookup: which lead converted to this student
* `(assigned_to)` — reassignment and workload queries (FK lookup)

**Delete behavior:** soft delete only. Physical deletion is an admin purge; on purge, `lead_activities` and `followups` cascade, `ai_conversations.lead_id` is SET NULL.

### 3.4 `lead_activities`

**Purpose:** Append-only CRM history/timeline for a lead. One table with a typed activity — deliberately not overengineered into multiple tables.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `activity_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant (org-wide timeline queries) |
| `lead_id` | `uuid` | no | — | Parent lead |
| `performed_by` | `uuid` | yes | `null` | Actor profile; NULL if user later deleted |
| `activity_type` | `text` | no | — | `CHECK` in (`call`, `email`, `meeting`, `note`, `whatsapp`, `status_change`, `assignment`, `converted`) |
| `occurred_at` | `timestamptz` | no | `now()` | Business timestamp (may differ from insert time for backfilled history) |
| `notes` | `text` | yes | `null` | Free text for call/meeting/note entries |
| `metadata` | `jsonb` | yes | `null` | Structured extras: `{"from":"new","to":"qualified"}` for `status_change`; `{"assigned_to":...}` for `assignment`; `{"student_id":...}` for `converted` |
| `created_at` | `timestamptz` | no | `now()` | |

**Primary key:** `activity_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `lead_id → leads(lead_id)` ON DELETE CASCADE; `performed_by → profiles(user_id)` SET NULL. **Check:** `activity_type IN (...)` (8 values). **Indexes:**
* `(lead_id, occurred_at DESC)` — timeline rendering
* `(organization_id, occurred_at DESC)` — org-wide activity feed/reporting

**Delete behavior:** append-only in normal operation (no update API; no soft delete — history is a log). Hard-deleted only via lead purge cascade.

### 3.5 `followups`

**Purpose:** Scheduled tasks against a lead — the basis for future automation (reminders, WhatsApp nudges).

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `followup_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `lead_id` | `uuid` | no | — | Parent lead |
| `assigned_to` | `uuid` | yes | `null` | Responsible profile; NULL = unassigned pool |
| `title` | `text` | no | — | Short subject, e.g. "Call re: demo" |
| `notes` | `text` | yes | `null` | |
| `due_at` | `timestamptz` | no | — | Due date/time |
| `priority` | `text` | no | `'medium'` | `CHECK (priority IN ('low','medium','high'))` |
| `status` | `text` | no | `'pending'` | `CHECK (status IN ('pending','completed','cancelled'))` |
| `completed_at` | `timestamptz` | yes | `null` | |
| `completed_by` | `uuid` | yes | `null` | |
| `reminder_at` | `timestamptz` | yes | `null` | Scheduled reminder moment; the only automation-ready column in V1 |
| `created_by` | `uuid` | yes | `null` | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `followup_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `lead_id → leads(lead_id)` CASCADE; `assigned_to/completed_by/created_by → profiles(user_id)` SET NULL. **Check constraints:**
* `CHECK (priority IN ('low','medium','high'))`
* `CHECK (status IN ('pending','completed','cancelled'))`
* `CHECK (status <> 'completed' OR completed_at IS NOT NULL)` — completed follow-ups must carry a completion timestamp.

"Overdue" is deliberately **not** stored — it is derived (`status = 'pending' AND due_at < now()`), avoiding a drift-prone column.

**Indexes:**
* `(assigned_to, status, due_at)` — the "my follow-ups, sorted by due" query; the automation scheduler's core index
* `(lead_id)` — lead detail page list
* `(organization_id, status)` — org-wide follow-up board

**Delete behavior:** no soft delete (lifecycle via status); cascade on lead purge.

### 3.6 `students`

**Purpose:** Organization business record for a learner. Deliberately separate from `profiles` (see §4.2). May optionally link to a login identity.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `student_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `profile_id` | `uuid` | yes | `null` | Optional login identity; NULL until a student account exists |
| `first_name` | `text` | no | — | |
| `last_name` | `text` | no | — | |
| `email` | `text` | yes | `null` | |
| `phone` | `text` | yes | `null` | |
| `notes` | `text` | yes | `null` | |
| `created_by` | `uuid` | yes | `null` | Who created the record |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |
| `deleted_at` | `timestamptz` | yes | `null` | Soft delete (see §8) |

**Primary key:** `student_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `profile_id → profiles(user_id)` SET NULL; `created_by → profiles(user_id)` SET NULL. **Unique:** partial — `UNIQUE (organization_id, lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL` (one student per email per org; soft-deleted rows don't block reuse). **Indexes:**
* `(organization_id, deleted_at)` partial — active student lists
* `(profile_id)` — login lookup: find the student record for `auth.uid()`

**Delete behavior:** soft delete. On physical purge, `enrollments` cascade, `leads.student_id` and `ai_conversations.student_id` are SET NULL.

### 3.7 `courses`

**Purpose:** Root of the LMS content tree.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `course_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `title` | `text` | no | — | |
| `description` | `text` | yes | `null` | |
| `status` | `text` | no | `'draft'` | `CHECK (status IN ('draft','published','archived'))` — replaces soft delete (see §8) |
| `created_by` | `uuid` | yes | `null` | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `course_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `created_by → profiles(user_id)` SET NULL. **Check:** `status IN ('draft','published','archived')`. **Indexes:** `(organization_id, status)` — published-course catalogs. **Delete behavior:** no soft delete; the `archived` status is the tombstone. Physical deletion is an admin purge that cascades through modules/lessons and quizzes; `enrollments.course_id` is RESTRICT, so a course with enrollments cannot be physically deleted (archive instead).

### 3.8 `course_modules`

**Purpose:** Second level of the content tree.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `module_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `course_id` | `uuid` | no | — | Parent course |
| `title` | `text` | no | — | |
| `position` | `integer` | no | — | `CHECK (position >= 0)` |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `module_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `course_id → courses(course_id)` CASCADE. **Unique:** `(course_id, position)` — deterministic ordering, no duplicates. **Check:** `position >= 0`. **Indexes:** `(course_id, position)` via unique constraint (covers course-navigation queries). **Delete behavior:** cascade from course purge; module deletion cascades lessons.

### 3.9 `lessons`

**Purpose:** Leaf of the content tree — the actual learning content.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `lesson_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `module_id` | `uuid` | no | — | Parent module |
| `title` | `text` | no | — | |
| `content` | `text` | no | `''` | Lesson body (markdown in V1) |
| `position` | `integer` | no | — | `CHECK (position >= 0)` |
| `is_published` | `boolean` | no | `false` | Per-lesson visibility; allows releasing a module incrementally |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `lesson_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `module_id → course_modules(module_id)` CASCADE. **Unique:** `(module_id, position)`. **Check:** `position >= 0`. **Indexes:** `(module_id, position)` via unique constraint; `(organization_id)` for org-scoped queries. **Delete behavior:** unpublish instead of delete; cascade on module purge.

### 3.10 `enrollments`

**Purpose:** The (student, course) relationship with an explicit lifecycle.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `enrollment_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `student_id` | `uuid` | no | — | Learner |
| `course_id` | `uuid` | no | — | Course |
| `status` | `text` | no | `'active'` | `CHECK (status IN ('active','paused','completed','cancelled'))` (see §4.4) |
| `ended_at` | `timestamptz` | yes | `null` | Set when status leaves `active` (completion or cancellation) |
| `enrolled_by` | `uuid` | yes | `null` | Staff who enrolled the student |
| `created_at` | `timestamptz` | no | `now()` | Enrollment moment |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `enrollment_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `student_id → students(student_id)` CASCADE; `course_id → courses(course_id)` RESTRICT; `enrolled_by → profiles(user_id)` SET NULL. **Check:** `status IN ('active','paused','completed','cancelled')`. **Unique:** partial — `UNIQUE (student_id, course_id) WHERE status IN ('active','paused')` — a student can never hold two open enrollments in the same course; completed/cancelled rows don't block re-enrollment. **Indexes:**
* `(student_id, status)` — "my courses" page
* `(course_id, status)` — course roster / enrollment counts
* `(organization_id)` — tenant scoping

**Delete behavior:** no soft delete — `cancelled` is the terminal state. Physical delete only via student purge cascade.

### 3.11 `lesson_progress`

**Purpose:** Per-(enrollment, lesson) learning state. Minimal by design — no stored percentage (derived, see §4.6).

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `enrollment_id` | `uuid` | no | — | Composite PK part 1 |
| `lesson_id` | `uuid` | no | — | Composite PK part 2 |
| `status` | `text` | no | `'not_started'` | `CHECK (status IN ('not_started','in_progress','completed'))` |
| `started_at` | `timestamptz` | yes | `null` | First access |
| `last_accessed_at` | `timestamptz` | yes | `null` | Most recent access (updated on every open) |
| `completed_at` | `timestamptz` | yes | `null` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `(enrollment_id, lesson_id)` — natural composite key; also makes the common `INSERT ... ON CONFLICT (enrollment_id, lesson_id) DO UPDATE` upsert trivial. **Foreign keys:** `enrollment_id → enrollments(enrollment_id)` CASCADE; `lesson_id → lessons(lesson_id)` CASCADE. **Check constraints:**
* `CHECK (status IN ('not_started','in_progress','completed'))`
* `CHECK ((status = 'not_started') = (started_at IS NULL AND completed_at IS NULL))` — not-started rows carry no timestamps; any other status must have started.
* `CHECK (status <> 'completed' OR completed_at IS NOT NULL)` — completed rows carry a completion timestamp.

**Indexes:** `(lesson_id)` — per-lesson completion stats; `(enrollment_id)` covered by PK prefix. **Delete behavior:** cascade on enrollment/lesson purge; never soft-deleted (history). Rows are inserted lazily on first access — no rows for unstarted lessons.

### 3.12 `quizzes`

**Purpose:** A quiz belongs to a course (per the approved domain model, quizzes sit alongside modules under a course).

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `quiz_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `course_id` | `uuid` | no | — | Parent course |
| `title` | `text` | no | — | |
| `description` | `text` | yes | `null` | Instructions shown before starting |
| `pass_threshold` | `smallint` | no | `70` | `CHECK (pass_threshold BETWEEN 0 AND 100)` — percent required to pass |
| `is_published` | `boolean` | no | `false` | Visibility to enrolled students |
| `created_by` | `uuid` | yes | `null` | |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `quiz_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `course_id → courses(course_id)` CASCADE; `created_by → profiles(user_id)` SET NULL. **Check:** `pass_threshold BETWEEN 0 AND 100`. **Indexes:** `(course_id)` — course quizzes list; `(organization_id)` — tenant scoping. **Delete behavior:** no soft delete — unpublish to retire. AI-generated quizzes insert here with no schema change.

### 3.13 `quiz_questions`

**Purpose:** Questions within a quiz, with deterministic ordering.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `question_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `quiz_id` | `uuid` | no | — | Parent quiz |
| `position` | `integer` | no | — | `CHECK (position >= 0)` |
| `question_type` | `text` | no | `'multiple_choice'` | `CHECK (question_type IN ('multiple_choice','true_false'))` |
| `question` | `text` | no | — | The prompt |
| `options` | `jsonb` | no | — | Array of option strings, e.g. `["Paris","London","Berlin"]` |
| `correct_answer` | `jsonb` | no | — | Array of correct option indices, e.g. `[0]` — supports multi-select later without a schema change |
| `points` | `smallint` | no | `1` | `CHECK (points >= 0)` |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `question_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `quiz_id → quizzes(quiz_id)` CASCADE. **Unique:** `(quiz_id, position)`. **Check:** `question_type IN ('multiple_choice','true_false')`, `points >= 0`, `position >= 0`. **Indexes:** `(quiz_id, position)` via unique constraint. **Delete behavior:** cascade on quiz purge. Option/correct-answer JSONB is validated by the application at write time; a `CHECK (jsonb_typeof(options) = 'array')` guard may be added in the migration.

### 3.14 `quiz_attempts`

**Purpose:** One row per attempt by a student on a quiz. Multiple attempts per student are explicitly supported.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `attempt_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `quiz_id` | `uuid` | no | — | Parent quiz |
| `student_id` | `uuid` | no | — | Taker |
| `started_at` | `timestamptz` | no | `now()` | |
| `submitted_at` | `timestamptz` | yes | `null` | NULL while the attempt is in progress |
| `score` | `smallint` | yes | `null` | Points earned; NULL until submitted |
| `max_score` | `smallint` | yes | `null` | Sum of question points *at submission time* (snapshot; safe if questions are later edited) |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `attempt_id`. **Foreign keys:** `quiz_id → quizzes(quiz_id)` CASCADE; `student_id → students(student_id)` CASCADE. **Check constraints:**
* `CHECK ((submitted_at IS NULL) = (score IS NULL AND max_score IS NULL))` — draft attempts carry no score; submitted attempts carry both.
* `CHECK (score IS NULL OR score BETWEEN 0 AND max_score)` — score cannot exceed the snapshot maximum (NULL-safe in SQL; passes when either side is NULL).

**Indexes:**
* `(quiz_id, submitted_at)` — "who has/hasn't attempted" per quiz
* `(student_id, submitted_at)` — "my attempts" history
* `(quiz_id, student_id)` — per-student attempt history on a quiz

**Delete behavior:** cascade on quiz/student purge. Pass/fail is **not stored** — derived (`score / max_score * 100 >= quiz.pass_threshold`), so threshold changes retroactively reflect without data rewrites.

### 3.15 `quiz_attempt_answers`

**Purpose:** Per-question result of an attempt. **Recommended additional table** — required, not optional:

* **Answer review UI** — students see exactly which option they chose for each question; instructors see what each student picked.
* **Per-question analytics** — which questions are failed most (input for AI quiz generation and instructor insights).
* **AI tutor feedback** — the AI can reference the exact question and the student's exact answer.
* **Grading integrity** — `is_correct` and `points_earned` are snapshotted at submission time, so later edits to a question cannot retroactively change results.

Storing this as a JSONB column on `quiz_attempts` would make all of the above awkward (parsing, indexing, growth).

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `attempt_id` | `uuid` | no | — | Composite PK part 1 |
| `question_id` | `uuid` | no | — | Composite PK part 2 |
| `selected_answer` | `jsonb` | no | — | Chosen option indices, e.g. `[0]` |
| `is_correct` | `boolean` | no | — | Graded at submission |
| `points_earned` | `smallint` | no | `0` | `CHECK (points_earned >= 0)` |
| `created_at` | `timestamptz` | no | `now()` | |

**Primary key:** `(attempt_id, question_id)`. **Foreign keys:** `attempt_id → quiz_attempts(attempt_id)` CASCADE; `question_id → quiz_questions(question_id)` CASCADE. **Check:** `points_earned >= 0`. **Indexes:** `(question_id)` — per-question difficulty stats. **Delete behavior:** cascade on attempt/question purge. Grading is application-side at submission; DB check constraints (`points_earned >= 0`, `score <= max_score`) are the safety net.

### 3.16 `ai_conversations`

**Purpose:** A conversation thread — the unit of AI context. May be bound to a lead, a student, or neither (general assistant).

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `conversation_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `organization_id` | `uuid` | no | — | Tenant |
| `user_id` | `uuid` | yes | `null` | Owner profile (authenticated user who started the thread); NULL preserves history if the user is deleted |
| `lead_id` | `uuid` | yes | `null` | Optional bound lead |
| `student_id` | `uuid` | yes | `null` | Optional bound student |
| `title` | `text` | yes | `null` | Auto-generated or user-set summary |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

**Primary key:** `conversation_id`. **Foreign keys:** `organization_id → organizations` RESTRICT; `user_id → profiles(user_id)` SET NULL; `lead_id → leads(lead_id)` SET NULL; `student_id → students(student_id)` SET NULL. **Check:** `CHECK (lead_id IS NULL OR student_id IS NULL)` — a thread is about a lead **or** a student **or** neither, never both. **Indexes:**
* `(organization_id, updated_at DESC)` — conversation list
* `(user_id)` — "my conversations"
* `(lead_id)` — AI context per lead
* `(student_id)` — AI tutor context per student

**Delete behavior:** no soft delete in V1 (threads are small and cheap); SET NULL on all entity references keeps history intact.

### 3.17 `ai_messages`

**Purpose:** Individual turns within a conversation. **Recommended additional table** — required because:

* A conversation accumulates many turns; a JSONB "messages" column on the conversation would grow unboundedly and cannot be paginated efficiently.
* Streaming UIs need to append messages incrementally; each turn needs its own row and timestamp.
* Debugging and cost tracking benefit from per-message rows (role/content), with model/token columns addable later without restructuring.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| `message_id` | `uuid` | no | `gen_random_uuid()` | Primary key |
| `conversation_id` | `uuid` | no | — | Parent thread |
| `role` | `text` | no | — | `CHECK (role IN ('user','assistant','system'))` |
| `content` | `text` | no | — | Message body |
| `created_at` | `timestamptz` | no | `now()` | |

**Primary key:** `message_id`. **Foreign keys:** `conversation_id → ai_conversations(conversation_id)` CASCADE. **Check:** `role IN ('user','assistant','system')`. **Indexes:** `(conversation_id, created_at)` — chronological thread retrieval. **Delete behavior:** cascade on conversation delete (threads are not individually purged in V1). Future columns (`model`, `input_tokens`, `output_tokens`, `error`) are additive.

---

## 4. Relationship Decisions

### 4.1 Lead → Student conversion

**Decision: `leads.student_id` (nullable FK) — the lead references the student it became. No reverse FK, no conversion table.**

* **Direction.** The CRM pipeline queries "which student did this lead become" (`lead → student`, 1:1, nullable). The student page finds its origin lead via the indexed `leads.student_id` reverse lookup. A second FK (`students.lead_id`) would create a circular dependency with no additional capability — both directions would always be written in the same transaction, and either alone answers both questions.
* **Conversion metadata lives on the lead**: `converted_at`, `converted_by`, plus a `converted` row in `lead_activities` with `metadata.student_id`. This is a single, atomic transition; a dedicated `conversions` table would be an empty shell (one row per converted lead, no future rows in V1) — overengineering.
* **Personal data duplication is accepted and justified.** The student row is created once from the lead's contact data at conversion. Rationale: (a) a student can exist without ever having been a lead (imports, walk-ins) and vice versa, so neither table can be the single source of truth for both; (b) post-conversion edits to the student (changed email, married name) must not silently rewrite the sales history; (c) leads may be legally purged/soft-deleted while students live on. The duplication is one-time (no sync job), bounded, and auditable.
* **Integrity is database-enforced**: `CHECK ((status = 'converted') = (student_id IS NOT NULL AND converted_at IS NOT NULL))` — a lead cannot claim conversion without a student, and a student link cannot exist without conversion status.

### 4.2 Profiles vs Students

**Decision: separate entities — `profiles` (auth identity) and `students` (business record), linked by an optional `students.profile_id`.**

| | `profiles` | `students` |
|---|---|---|
| Represents | Auth identity + platform role (staff and student logins) | A person being taught (a business record) |
| Scope | Platform-level, 1:1 with `auth.users` | Organization-level |
| Exists without the other | Yes — staff users are profiles with no student record | Yes — imported students have no login |
| Authorization source | `role` + `organization_id` drive RLS | Not used for authorization |

* Future student login: link `students.profile_id` to a profile with `role = 'student'`. Nothing forces every student to have an account today (`profile_id` nullable).
* A staff member who also enrolls in a course is represented by *two* rows (their profile + a student record pointing at it) — clean and rare.
* RLS for "student sees own progress" resolves through `students.profile_id = auth.uid()` — never through client-supplied student IDs.

### 4.3 Organization relationships

* `profiles.organization_id` is **nullable** — a user may exist before assignment (signup), and future cross-org admins are representable. RLS treats "no organization" as "no tenant data visible".
* Every top-level tenant table (`leads`, `students`, `courses`, `enrollments`, `quizzes`, `ai_conversations`, ...) carries `organization_id NOT NULL` with `ON DELETE RESTRICT`. Child tables omit it (see §3 conventions) — RLS walks the FK chain.
* No organization-switching UI, no org pickers in V1; the schema simply allows the column.

### 4.4 Enrollment lifecycle

**Decision: four states — `active`, `paused`, `completed`, `cancelled`.**

* The proposed values are sufficient and adopted, with one clarification: **no `pending` state**. V1 has no payment, approval, or invitation flow, so an enrollment is either open (`active`) or it isn't. Adding `pending` now would create an unexercised code path.
* `paused` is a real state for this business (course holidays, illness) and is distinct from `cancelled` (terminal) and `completed` (terminal).
* Terminal states are **not reversible via status alone** — reopening a completed/cancelled enrollment means a new enrollment row (allowed by the partial unique index).
* `ended_at` is set when the status leaves `active`; `completed` vs `cancelled` is disambiguated by the status value. Reporting uses `status = 'completed'`.
* Integrity: partial unique index `(student_id, course_id) WHERE status IN ('active','paused')` — one open enrollment per course per student, hard-enforced.

### 4.5 Course structure & ordering

**Decision: integer `position` with unique constraints — `UNIQUE (course_id, position)` on modules, `UNIQUE (module_id, position)` on lessons.**

* Deterministic ordering is enforced by the database; no application sort logic can produce duplicates.
* Integer positions with gaps (`10, 20, 30`) allow reordering without rewriting every row; renumbering is a transaction-local operation when compaction is needed.
* Alternatives rejected: fractional ordering (unnecessary complexity), linked lists (harder to query and validate), `created_at` ordering (not a content decision).
* Course-level `status` and lesson-level `is_published` control visibility. Modules have no flag — a module is visible when its course is published and it contains ≥1 published lesson.

### 4.6 Progress model

**Decision: `lesson_progress` stores `status` + timestamps only. Completion percentages are computed, never stored.**

* **Lesson level**: `not_started` / `in_progress` / `completed` + `started_at` / `last_accessed_at` / `completed_at`. A percentage per lesson is redundant with status (0 / partial / 100) — there is no meaningful "62% of a lesson" in V1's page-based content.
* **Course level**: completion % = completed lessons ÷ published lessons, computed by a query/API. No column exists to drift out of sync.
* **Why `last_accessed_at` exists**: explicitly required for "resume where I left off" UX and inactivity reporting.
* **Why rows are lazy**: no row is created until first access; `not_started` is the absence of a row. This keeps the table small (only started lessons) and makes the primary query (`INSERT ... ON CONFLICT (enrollment_id, lesson_id) DO UPDATE`) single-statement.
* Composite PK `(enrollment_id, lesson_id)` is the natural key — a UUID here would add a column without adding capability.

### 4.7 Quiz model

**Decision: `quizzes` (per course) → `quiz_questions` → `quiz_attempts` → `quiz_attempt_answers`, with separate answers table (see §3.15 for full justification).**

* Multiple attempts: no unique constraint on `(quiz_id, student_id)` — explicitly allowed; the app may cap attempts.
* Scoring: `score`/`max_score` snapshot at submission; pass/fail derived from `pass_threshold` (threshold changes don't require rewriting attempts).
* Timestamps: `started_at`/`submitted_at` distinguish in-progress from submitted attempts; draft attempts (NULL score) are resume-able.
* AI-generated quizzes insert into `quiz_questions` with zero schema change; the `correct_answer` JSONB array already tolerates multi-select questions.
* Lesson-level quizzes are a future possibility (a nullable `lesson_id` on `quizzes`) — deliberately omitted from V1 per the approved domain model.

### 4.8 AI conversation model

**Decision: `ai_conversations` (thread) + `ai_messages` (turns) — two tables.**

* A conversation is bound to exactly one context: lead, student, or neither (`CHECK (lead_id IS NULL OR student_id IS NULL)`). `user_id` is nullable with SET NULL so deleting a staff/student account never destroys conversation history.
* Messages are a separate table because threads grow: pagination, incremental streaming appends, per-turn timestamps, and later token/cost columns all require row-level granularity. A JSONB array on the conversation is the tempting shortcut that becomes a maintenance burden at the exact moment AI usage ramps up.
* `ai_messages` carries no `organization_id` — RLS reaches the org through `conversation_id → ai_conversations.organization_id`.

---

## 5. RLS Architecture

### 5.1 Principle

```
auth.uid()  ──►  profiles (role, organization_id, is_active)  ──►  RLS policy  ──►  authorized rows
```

Authorization is **derived exclusively** from the authenticated session (`auth.uid()`) joined to `profiles`. A browser-sent `organization_id` is never trusted as proof of authorization — at most it is used in a `WHERE` clause, and the RLS `WITH CHECK` rejects any row whose `organization_id` does not match the session's organization. Injected org IDs simply select zero rows.

### 5.2 Helper functions (SECURITY DEFINER)

Policies stay readable by centralizing lookups in three `security definer` functions (owned by the schema owner, not exposed to the client):

| Function | Returns | Purpose |
|---|---|---|
| `public.current_org_id()` | `uuid` | `organization_id` from `profiles` for `auth.uid()`; NULL if none |
| `public.current_user_role()` | `text` | `role` from `profiles` for `auth.uid()` |
| `public.has_role(required text[])` | `boolean` | `current_user_role()` in required list, AND user `is_active`, AND org membership present |

Policy templates:

```text
-- Tenant scoping (every top-level table)
USING  (organization_id = public.current_org_id())
WITH CHECK (organization_id = public.current_org_id())

-- Role gate combined with tenant scoping
USING  (organization_id = public.current_org_id() AND public.has_role(ARRAY['admin','sales','counselor']))
```

`auth.uid() = NULL` (anonymous requests) makes `current_org_id()` NULL and every policy false — unauthenticated users see nothing.

### 5.3 Per-table policy model

| Table | Read | Write | Notes |
|---|---|---|---|
| `organizations` | all members of that org | admin only | Non-members see zero rows |
| `profiles` | own row always; org staff directory (all members); role/org columns visible | own row: self-editable fields only (`full_name`, `avatar_url`, `email`) | **`role` and `organization_id` updates: admin-only policy.** Client can never self-promote. |
| `leads` | org members | `sales`, `counselor`, `admin` | Students/instructors see nothing. Assignment change = `assignment` activity row (audited). |
| `lead_activities` | org members | `sales`, `counselor`, `admin` | Insert-only via app; no update/delete policies in V1 (append-only log). |
| `followups` | org members | `sales`, `counselor`, `admin` | "My follow-ups" = `assigned_to = auth.uid()` filter (RLS already org-scoped). |
| `students` | org members | `sales`, `counselor`, `admin`; instructor read-only; student: own row only (`profile_id = auth.uid()`) | |
| `courses` | org members; published courses also visible to `student` role | `instructor`, `admin` | Status transitions (`draft→published→archived`) admin/instructor only. |
| `course_modules` / `lessons` | as courses | as courses | Content visibility follows course status + lesson `is_published`. |
| `enrollments` | org members; students: own enrollments | `sales`, `counselor`, `admin` (create/cancel); instructor read | |
| `lesson_progress` | org members; student: own rows (via own enrollments) | student: own rows only (`in_progress`/`completed` self-report); staff write via app | |
| `quizzes` / `quiz_questions` | org members; published quizzes visible to enrolled students | `instructor`, `admin` | Student sees questions only when quiz published + enrolled in the parent course. |
| `quiz_attempts` | owner student + org staff | student: own attempts only; staff: none (grading via app) | Org scoping via `quiz_id → quizzes → courses.organization_id`. |
| `quiz_attempt_answers` | as attempts | student: own attempts only (insert at submission) | Org scoping via `attempt_id → quiz_attempts → quiz_id → quizzes → courses.organization_id`. |
| `ai_conversations` | owner + org admins (audit) | owner (create/update own); staff may create bound to their leads | Student conversations bound via `student_id`; org scoping direct. |
| `ai_messages` | as conversations | as conversations | Org via `conversation_id → ai_conversations.organization_id`. |

### 5.4 Role semantics

| Role | CRM | LMS | Platform |
|---|---|---|---|
| `admin` | full | full | org settings, profiles/roles, everything |
| `sales` | full (leads, activities, follow-ups, conversion) | create enrollments, view students | — |
| `counselor` | full (leads, activities, follow-ups, conversion) | view students, create enrollments | — |
| `instructor` | none | author courses/quizzes; view enrollments, progress, attempts; read students | — |
| `student` | none | own enrollments, lessons, progress, attempts, conversations | own profile |

`sales` vs `counselor` are functionally identical in V1's schema; the roles exist for future permission divergence (e.g., counselor cannot delete leads).

### 5.5 Why this is secure

* No `USING (true)` policies exist; every policy is org-scoped or owner-scoped.
* Role and membership data live in `profiles`, protected by RLS (no self-service role writes).
* Client-supplied `organization_id`/`user_id`/`role` values can only filter or be rejected — never grant access.
* Service-role key stays server-side (`.env.local`, never `NEXT_PUBLIC_`); the app's server layer uses the anon/publishable key with the user's session, so RLS applies to every application query.

---

## 6. Authentication Architecture

### 6.1 Relationship

```text
auth.users (Supabase-managed, NEVER modified directly)
    │  1 : 1  (trigger: handle_new_user)
    ▼
profiles (our table: email snapshot, full_name, role, organization_id, is_active)
    │  optional (students.profile_id, SET NULL)
    ▼
students (business records; may or may not have a login)
```

### 6.2 Rules

1. **`auth.users` is treated as read-only from application code.** All business logic touches `profiles` and below. The only write to `auth.users` is the standard Supabase auth flow itself (sign-up, admin user creation).
2. **`profiles` is created by trigger** on `auth.users` INSERT (email + name from metadata), guaranteeing a 1:1 profile for every identity — including students who later sign up.
3. **Roles are assigned by admins** post-creation; there is no default role, so a fresh user is inert (no tenant data) until explicitly provisioned. This closes the "sign up and see everything" hole.
4. **Student login path**: a `students.profile_id` is set when a student account is provisioned (their profile gets `role = 'student'`). Existing student records link to accounts; new sign-ups can create a student record on first profile completion.
5. **Authorization** flows: server code calls `supabase.auth.getUser()`, then relies on RLS (as above) for row-level enforcement, and reads `profiles.role` server-side for feature-level decisions. The browser never sends roles or org IDs as authority.
6. **`email` on profiles is a snapshot** synced on profile creation/update; `auth.users.email` remains canonical for authentication.

### 6.3 Current code note

`src/lib/supabase/server.ts` builds a client with the publishable key and no session context — fine for the connection test today. When auth UI and RLS queries arrive, this must be upgraded to a cookie/session-aware client (`@supabase/ssr` `createServerClient`) so requests carry the user's JWT and RLS applies. This is future work, not part of this task.

---

## 7. Index Strategy

Every index below exists because a concrete V1 query pattern needs it. No speculative indexes.

| Index | Table | Why |
|---|---|---|
| `(organization_id)` | `profiles` | Org staff directory; also the RLS join target for every policy |
| `(organization_id, status)` | `leads` | Pipeline/kanban: leads per org per stage |
| `(organization_id, assigned_to, status)` | `leads` | "My leads" per stage (the daily sales view) |
| `(organization_id, deleted_at)` partial | `leads` | All active-lead lists exclude soft-deleted rows cheaply |
| `(student_id)` | `leads` | Reverse conversion lookup: student → origin lead |
| `(assigned_to)` | `leads` | FK lookup + workload reports |
| `(lead_id, occurred_at DESC)` | `lead_activities` | Lead timeline rendering |
| `(organization_id, occurred_at DESC)` | `lead_activities` | Org-wide activity feed/reporting |
| `(assigned_to, status, due_at)` | `followups` | "My pending follow-ups by due date" — also the future automation scheduler's scan |
| `(lead_id)` | `followups` | Lead detail page list |
| `(organization_id, status)` | `followups` | Org follow-up board |
| `(organization_id, deleted_at)` partial | `students` | Active student lists |
| `(profile_id)` | `students` | Student login lookup (`auth.uid()` → student record) |
| `(organization_id, status)` | `courses` | Published-course catalog; archived filtering |
| `(course_id, position)` unique | `course_modules` | Course navigation (ordering constraint doubles as the index) |
| `(module_id, position)` unique | `lessons` | Module navigation |
| `(student_id, status)` | `enrollments` | "My courses" page |
| `(course_id, status)` | `enrollments` | Course roster, enrollment counts |
| `(organization_id)` | `enrollments` | Tenant scoping of roster queries |
| `(lesson_id)` | `lesson_progress` | Per-lesson completion stats (instructor view) |
| `(course_id)` | `quizzes` | Course quizzes list |
| `(organization_id)` | `quizzes` | Tenant scoping |
| `(quiz_id, position)` unique | `quiz_questions` | Question ordering + retrieval |
| `(quiz_id, submitted_at)` | `quiz_attempts` | Per-quiz attempt list ("who submitted") |
| `(student_id, submitted_at)` | `quiz_attempts` | Student attempt history |
| `(quiz_id, student_id)` | `quiz_attempts` | Per-student attempts on one quiz |
| `(question_id)` | `quiz_attempt_answers` | Per-question difficulty analytics |
| `(organization_id, updated_at DESC)` | `ai_conversations` | Conversation list (recents first) |
| `(user_id)` | `ai_conversations` | "My conversations" |
| `(lead_id)` | `ai_conversations` | AI context per lead |
| `(student_id)` | `ai_conversations` | AI tutor context per student |
| `(conversation_id, created_at)` | `ai_messages` | Chronological thread fetch |

Notes:

* **Partial unique indexes** (enrollments one-open-per-course; students one-email-per-org) enforce business rules the app cannot bypass.
* **FK lookup indexes** are only added where the FK is actually used in hot queries (`assigned_to`, `student_id`, `profile_id`, `lead_id`, `question_id`). FKs that are always reached via a parent's PK (e.g., `lesson_progress.lesson_id` is covered; `quiz_attempts.quiz_id` is the first column of two composite indexes) are not double-indexed.
* Lesson progress PK `(enrollment_id, lesson_id)` already serves all per-enrollment queries; `(lesson_id)` covers the cross-enrollment stats axis. No further indexes.
* At the stated scale (1,000+ leads, 10,000+ students) every query above is covered by a single b-tree scan; no composite index exceeds 3 columns; nothing is denormalized for performance.

---

## 8. Data Lifecycle Strategy

### 8.1 Deletion policy (who soft-deletes, who hard-deletes)

| Entity | Soft delete (`deleted_at`) | Why |
|---|---|---|
| `leads` | **Yes** | CRM history is business-critical: restorable pipeline data, audit continuity, compliance (retention). "Delete" = remove from pipeline; purge is a deliberate admin act. |
| `students` | **Yes** | Same rationale; also protects enrollment history and quiz attempts from accidental destruction. |
| `courses` | **No** — explicit `status = 'archived'` | A status transition is more honest than a tombstone: archived courses remain readable for reporting, and the state is visible in the UI. `deleted_at` + `archived` would be redundant. |
| `enrollments` | **No** — `cancelled` terminal state | Enrollment lifecycle is already a status machine; cancel is a business decision with `ended_at`. |
| `lead_activities` | **No** | Append-only log; "deletion" is meaningless — the record is the history. |
| `followups` | **No** — `cancelled` terminal state | Follow-ups are tasks, not records of truth. |
| `quizzes` / `quiz_questions` | **No** — `is_published = false` retires | Same reasoning as courses. |
| `lesson_progress`, `quiz_attempts`, `quiz_attempt_answers`, `ai_messages` | **No** | Subordinate history; their parent's lifecycle governs them. |
| `ai_conversations` | **No** | Small, cheap, potentially valuable history. |

### 8.2 Hard-delete paths (admin purge, rare)

1. **Lead purge** → cascades `lead_activities`, `followups`; SET NULLs `ai_conversations.lead_id`; `leads.student_id` was already cleared or points to a student that survives.
2. **Student purge** → cascades `enrollments`, `lesson_progress`, `quiz_attempts` (+ answers); SET NULLs `leads.student_id`, `students.profile_id` (profile survives), `ai_conversations.student_id`.
3. **Course purge** → cascades `course_modules`, `lessons`, `quizzes`, `quiz_questions`; blocked by RESTRICT if enrollments exist.
4. **User (profile) deletion** → cascades only the profile row itself; all `created_by`/`assigned_to`/`performed_by` references become NULL. Conversation ownership likewise SET NULL.
5. **Organization deletion** → RESTRICT everywhere; no path exists in V1.

### 8.3 Status transitions

| Entity | States (CHECK-enforced) | Transitions |
|---|---|---|
| `leads.status` | `new → contacted → qualified → converted \| lost` | Forward only in normal operation; `converted` requires `student_id` + `converted_at` (DB-enforced). |
| `followups.status` | `pending → completed \| cancelled` | `completed` requires `completed_at`; overdue is derived, never stored. |
| `enrollments.status` | `active ↔ paused`, `active → completed \| cancelled` | Terminal states are final (re-enroll = new row, allowed by partial unique index). |
| `courses.status` | `draft → published`, `published → archived` | `draft ↔ published` allowed while editing; archived is terminal. |
| `lesson_progress.status` | `not_started → in_progress → completed` | `completed` requires `completed_at`; no reversal (re-completion updates the timestamp). |

### 8.4 Audit fields

`created_at` + `updated_at` on every mutable business table (standard, cheap, no trigger logic beyond `set_updated_at()`).

**`created_by` only where ownership/accountability genuinely matters:**

| Table | `created_by` | Rationale |
|---|---|---|
| `leads` | yes | Sales accountability: who brought in the lead |
| `students` | yes | Who created the record |
| `courses`, `quizzes` | yes | Content authorship |
| `enrollments` | yes (`enrolled_by`) | Who enrolled the student |
| `followups` | yes | Who scheduled the task |

**No `updated_by` anywhere in V1.** Rationale: correct updater tracking requires update-trigger plumbing per table, and its main consumer (an audit trail of "who changed what") is already served for the CRM by `lead_activities` (typed events with `performed_by`), which is richer than a single updater column. If audit requirements harden, a dedicated `audit_log` table (or `updated_by` added selectively) is a clean follow-up — the decision is explicitly deferred, not forgotten.

**CRM actions** (`call`, `email`, `meeting`, `status_change`, `assignment`, `converted`) are captured as `lead_activities` rows with `performed_by` + `occurred_at` — this is the primary audit mechanism for business operations.

---

## 9. Future Extensibility

How this schema absorbs the roadmap without restructuring:

| Future feature | What already supports it | What would be added |
|---|---|---|
| **Multiple organizations** | `organizations` root, `organization_id` on all top-level tables, RLS derived from membership | Org-switching UI, `organization_memberships` (many-to-many staff), SaaS billing tables |
| **WhatsApp** | `lead_activities.activity_type = 'whatsapp'`, `followups.reminder_at` | `whatsapp_messages` log table, provider webhook tables |
| **Email automation** | `followups` (due_at/reminder_at/status), `lead_activities` (email type) | `email_campaigns` + `email_log` tables |
| **Payments** | `enrollments` lifecycle + `ended_at`; `students` | `payments`, `invoices`; enrollment gains a payment-derived gate (e.g., `payment_status`) |
| **Certificates** | `enrollments.status = 'completed'` + `lesson_progress` | `certificates` table keyed on enrollment; generation job |
| **Assignments** | content tree ordering + progress model | `assignments` table (course-scoped, like quizzes), `assignment_submissions` |
| **AI tutor** | `ai_conversations` + `ai_messages` (lead/student context, thread model) | `ai_messages.model`/token columns (additive) |
| **AI quiz generation** | `quiz_questions` (options/correct_answer JSONB) | nothing — writes into existing tables |
| **AI lead analysis** | `leads.score` (0–100), `lead_activities` | `lead_scores_history` or `ai_insights` table; scoring factors |
| **AI analytics** | full activity/progress/attempt history | `ai_insights` summaries table |
| **Notifications** | `followups.reminder_at` | `notifications` table, in-app + push |
| **Advanced reporting** | all history is retained and typed (`lead_activities`, `lesson_progress`, `quiz_attempts`) | materialized views / warehouse export |
| **Lesson-level quizzes** | — | nullable `quizzes.lesson_id` (additive, CHECK same-course) |
| **New roles / statuses** | CHECK constraints on `text` columns | constraint redefinition in one migration, or role lookup table |

---

## 10. Recommended Migration Order (future, NOT executed)

Logical migration sequence for the implementation phase, pending approval:

1. **`01_extensions.sql`** — `CREATE EXTENSION IF NOT EXISTS pgcrypto;` (for `gen_random_uuid()`); confirm `supabase` schema availability.
2. **`02_organizations.sql`** — `organizations` table.
3. **`03_profiles.sql`** — `profiles` table + `handle_new_user()` trigger on `auth.users`.
4. **`04_students.sql`** — `students` (+ partial unique email index).
5. **`05_leads.sql`** — `leads` (references students/profiles) + CHECK constraints + indexes.
6. **`06_crm_activity.sql`** — `lead_activities`, `followups` + indexes.
7. **`07_course_content.sql`** — `courses`, `course_modules`, `lessons` + unique ordering constraints.
8. **`08_quizzes.sql`** — `quizzes`, `quiz_questions`.
9. **`09_enrollments.sql`** — `enrollments` (+ partial unique) , `lesson_progress`.
10. **`10_quiz_attempts.sql`** — `quiz_attempts`, `quiz_attempt_answers`.
11. **`11_ai_conversations.sql`** — `ai_conversations`, `ai_messages`.
12. **`12_rls.sql`** — helper functions (`current_org_id`, `current_user_role`, `has_role`), `set_updated_at()` trigger; enable RLS on all tables; create policies per §5.
13. **`13_seed_dev.sql`** — dev-only seed: one organization, one admin profile, a sample course + module + lessons + quiz, a few sample leads/follow-ups, one student + enrollment (clearly marked as development data, removable in production).
14. **Verification** — run migrations in a Supabase local/dev environment; verify RLS by acting as each role via `set role`/JWT impersonation; confirm the existing connection test still passes; `npm run lint`.

All migrations are additive and forward-only; no destructive DDL in the sequence.

---

## 11. Risks / Trade-offs

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Lead/student contact duplication** — post-conversion edits don't propagate to the lead (by design) | Accepted trade-off; documented in §4.1. Conversion copies once; staff edit the student record thereafter. Option to add a sync/merge feature later if it becomes a real complaint. |
| 2 | **`text` + CHECK instead of enums** — roles/statuses are app-level constants, not DB types | Easier migrations; the cost is app-side validation duplication. Revisit with lookup tables if role logic grows. |
| 3 | **RLS policy complexity on chained tables** (`quiz_attempt_answers`, `ai_messages` walk 2–3 FKs to the org) | Policies are centralized in helper functions; chain depth is bounded (max 3 joins); scale is modest. If joins hurt, denormalize `organization_id` onto those tables in a later migration. |
| 4 | **No `updated_by`** — no full change-audit trail | `lead_activities` covers CRM change events; LMS content changes are low-frequency. A dedicated audit log is a clean follow-up. |
| 5 | **`profiles.organization_id` nullable** — a user can exist with no org | Intended (pre-provisioning, future cross-org admins). RLS makes org-less users invisible to all tenant data; risk is mis-provisioning, mitigated by admin-only role/org assignment. |
| 6 | **`auth.users` CASCADE to profiles** — deleting an auth user removes the profile | Deliberate (identity lifecycle); all business references are SET NULL so history survives. Staff deletion should be a two-step admin flow (deactivate → delete) enforced in the app. |
| 7 | **App-side quiz grading** — corrupted scores if the app misbehaves | DB CHECK constraints (`score <= max_score`, `points_earned >= 0`, submitted-vs-draft consistency) are the safety net; grading is a single server-side code path, easily tested. |
| 8 | **Single-org focus** — org switching, billing, memberships not built | By design (V1). The schema's org columns and RLS make the upgrade path mechanical, not architectural. |
| 9 | **`ai_conversations` CHECK (lead XOR student)** — no dual-context threads | Covers V1 semantics; a future "lead converted → student" handoff can create a new thread or relax the CHECK. |
| 10 | **No org index on `lesson_progress`** — org-wide progress queries join through enrollments | Covered by `(enrollment_id)` PK prefix + `(lesson_id)`; org-level analytics at 10k students remain trivial for Postgres. |

---

## 12. Approval Checklist

Explicit decisions requiring approval before any SQL is written:

- [ ] **A1. Lead→student conversion**: `leads.student_id` (one-directional, nullable FK); contact data copied once at conversion; conversion metadata on the lead + `converted` activity row; no conversion table. **Duplication accepted.**
- [ ] **A2. Profiles vs students**: separate tables; optional `students.profile_id` for future login; staff are profiles only.
- [ ] **A3. Roles**: five roles stored on `profiles` with CHECK; admin-only role/membership changes; no default role; no role UI in V1.
- [ ] **A4. Enrollment states**: `active / paused / completed / cancelled` (no `pending`); `ended_at`; partial-unique one-open-enrollment rule.
- [ ] **A5. Ordering**: integer `position` with `UNIQUE (parent, position)` on modules and lessons.
- [ ] **A6. Progress**: `lesson_progress` with status + timestamps, composite PK `(enrollment_id, lesson_id)`, derived percentages, lazy row creation, no stored percent.
- [ ] **A7. Quizzes**: course-scoped quizzes; `quiz_attempt_answers` as a separate table (required for review/grading/analytics); multiple attempts allowed; pass/fail derived from `pass_threshold`; `score`/`max_score` snapshots.
- [ ] **A8. CRM activities**: single `lead_activities` table with typed `activity_type` + `metadata` JSONB; append-only.
- [ ] **A9. Follow-ups**: `pending/completed/cancelled` + derived overdue; `reminder_at` included for future automation.
- [ ] **A10. AI model**: `ai_conversations` + `ai_messages` (two tables); lead XOR student binding; nullable owner with SET NULL.
- [ ] **A11. Soft delete scope**: `deleted_at` on `leads` and `students` only; courses via `archived` status; everything else via status transitions.
- [ ] **A12. Audit scope**: `created_by` on leads, students, courses, quizzes, enrollments, followups; **no `updated_by`** in V1.
- [ ] **A13. RLS model**: `current_org_id()` / `current_user_role()` / `has_role()` SECURITY DEFINER helpers; org-scoped + owner-scoped policies; admin-only role writes; no `USING (true)`.
- [ ] **A14. Additional tables**: `quiz_attempt_answers` and `ai_messages` approved as the only tables beyond the original entity list.
- [ ] **A15. Organization delete**: RESTRICT everywhere (no org deletion path in V1).
- [ ] **A16. Index set**: as listed in §7 — no additions without justification.

**On approval**, the next phase proceeds in the order of §10 (extensions → tables → constraints → indexes → RLS → seed → test).