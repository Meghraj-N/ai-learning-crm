# Database

Repository migrations define 17 application tables: `organizations`, `profiles`, `students`, `leads`, `lead_activities`, `followups`, `courses`, `course_modules`, `lessons`, `quizzes`, `quiz_questions`, `enrollments`, `lesson_progress`, `quiz_attempts`, `quiz_attempt_answers`, `ai_conversations`, and `ai_messages`.

The principal chains are `auth.users -> profiles`, `organizations ->` all organization-scoped records, `courses -> course_modules -> lessons`, `students <-> enrollments <-> courses`, and `quizzes -> quiz_questions / quiz_attempts -> quiz_attempt_answers`. `lesson_progress` is keyed by `(enrollment_id, lesson_id)`. Constraints, partial unique indexes, timestamps, and foreign keys are in `supabase/migrations/20260817024257_initial_schema.sql`.

RLS is enabled for every application table. `current_org_id`, `current_user_role`, and `has_role` derive authorization from the authenticated profile, not browser input. The provisioning migration permits null role/org for an unprovisioned identity and protects role, organization, and active-state changes against self-escalation.

The tracked schema does not prove the live production schema. Compare `supabase migration list` and the Supabase dashboard before applying any migration. There is no lesson-to-quiz relationship, so sequential quiz gating remains deferred.
