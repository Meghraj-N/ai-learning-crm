-- ============================================================================
-- AI Learning & CRM Hub — V1 Initial Schema
-- Migration: 20260817024257_initial_schema.sql
-- Source of truth: docs/database-architecture-v1.md (approved decisions A1-A16)
--
-- Scope: 17 application tables, constraints, indexes, RLS, helper functions.
-- No seed data in this migration (dev seed is a separate, environment-specific step).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Shared trigger function: updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. organizations
-- ----------------------------------------------------------------------------
create table public.organizations (
  organization_id uuid primary key default gen_random_uuid(),
  name            text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. profiles (business extension of auth.users; 1:1)
-- ----------------------------------------------------------------------------
create table public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  organization_id  uuid references public.organizations (organization_id) on delete restrict,
  email            text not null,
  full_name        text not null,
  avatar_url       text,
  role             text not null check (role in ('admin', 'sales', 'counselor', 'instructor', 'student')),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (email = lower(email))
);

create index profiles_organization_id_idx on public.profiles (organization_id);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3.1 Profile auto-creation on auth signup (trigger runs with definer rights)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (
    new.id,
    coalesce(lower(new.email), ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4. students (business records; optional link to a profile for future login)
-- ----------------------------------------------------------------------------
create table public.students (
  student_id      uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  profile_id      uuid references public.profiles (user_id) on delete set null,
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  notes           text,
  created_by      uuid references public.profiles (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- One student per email per org; soft-deleted rows don't block reuse
create unique index students_org_email_unique
  on public.students (organization_id, lower(email))
  where deleted_at is null and email is not null;

create index students_org_active_idx
  on public.students (organization_id)
  where deleted_at is null;

create index students_profile_id_idx on public.students (profile_id);

create trigger trg_students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. leads (CRM pipeline; lead -> student conversion via leads.student_id)
-- ----------------------------------------------------------------------------
create table public.leads (
  lead_id         uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  source          text,
  status          text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'lost')),
  score           smallint not null default 0 check (score between 0 and 100),
  assigned_to     uuid references public.profiles (user_id) on delete set null,
  student_id      uuid references public.students (student_id) on delete set null,
  converted_at    timestamptz,
  converted_by    uuid references public.profiles (user_id) on delete set null,
  notes           text,
  created_by      uuid references public.profiles (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  -- A converted lead must point at a student and carry a timestamp; no other status may.
  check ((status = 'converted') = (student_id is not null and converted_at is not null))
);

create index leads_org_status_idx
  on public.leads (organization_id, status);

create index leads_org_assigned_status_idx
  on public.leads (organization_id, assigned_to, status);

create index leads_org_active_idx
  on public.leads (organization_id)
  where deleted_at is null;

create index leads_student_id_idx on public.leads (student_id);
create index leads_assigned_to_idx on public.leads (assigned_to);

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. lead_activities (append-only CRM timeline)
-- ----------------------------------------------------------------------------
create table public.lead_activities (
  activity_id     uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  lead_id         uuid not null references public.leads (lead_id) on delete cascade,
  performed_by    uuid references public.profiles (user_id) on delete set null,
  activity_type   text not null check (activity_type in ('call', 'email', 'meeting', 'note', 'whatsapp', 'status_change', 'assignment', 'converted')),
  occurred_at     timestamptz not null default now(),
  notes           text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index lead_activities_lead_timeline_idx
  on public.lead_activities (lead_id, occurred_at desc);

create index lead_activities_org_timeline_idx
  on public.lead_activities (organization_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- 7. followups (scheduled tasks against leads; automation-ready)
-- ----------------------------------------------------------------------------
create table public.followups (
  followup_id     uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  lead_id         uuid not null references public.leads (lead_id) on delete cascade,
  assigned_to     uuid references public.profiles (user_id) on delete set null,
  title           text not null,
  notes           text,
  due_at          timestamptz not null,
  priority        text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status          text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  completed_at    timestamptz,
  completed_by    uuid references public.profiles (user_id) on delete set null,
  reminder_at     timestamptz,
  created_by      uuid references public.profiles (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (status <> 'completed' or completed_at is not null)
);

create index followups_assigned_status_due_idx
  on public.followups (assigned_to, status, due_at);

create index followups_lead_id_idx on public.followups (lead_id);
create index followups_org_status_idx on public.followups (organization_id, status);

create trigger trg_followups_updated_at
  before update on public.followups
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. courses (content tree root; archived lifecycle instead of soft delete)
-- ----------------------------------------------------------------------------
create table public.courses (
  course_id       uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  title           text not null,
  description     text,
  status          text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by      uuid references public.profiles (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index courses_org_status_idx on public.courses (organization_id, status);

create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 9. course_modules (deterministic ordering: unique (course_id, position))
-- ----------------------------------------------------------------------------
create table public.course_modules (
  module_id       uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  course_id       uuid not null references public.courses (course_id) on delete cascade,
  title           text not null,
  position        integer not null check (position >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (course_id, position)
);

create trigger trg_course_modules_updated_at
  before update on public.course_modules
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. lessons (deterministic ordering: unique (module_id, position))
-- ----------------------------------------------------------------------------
create table public.lessons (
  lesson_id       uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  module_id       uuid not null references public.course_modules (module_id) on delete cascade,
  title           text not null,
  content         text not null default '',
  position        integer not null check (position >= 0),
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (module_id, position)
);

create index lessons_organization_id_idx on public.lessons (organization_id);

create trigger trg_lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 11. quizzes (course-scoped)
-- ----------------------------------------------------------------------------
create table public.quizzes (
  quiz_id         uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  course_id       uuid not null references public.courses (course_id) on delete cascade,
  title           text not null,
  description     text,
  pass_threshold  smallint not null default 70 check (pass_threshold between 0 and 100),
  is_published    boolean not null default false,
  created_by      uuid references public.profiles (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index quizzes_course_id_idx on public.quizzes (course_id);
create index quizzes_organization_id_idx on public.quizzes (organization_id);

create trigger trg_quizzes_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 12. quiz_questions (deterministic ordering: unique (quiz_id, position))
-- ----------------------------------------------------------------------------
create table public.quiz_questions (
  question_id     uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  quiz_id         uuid not null references public.quizzes (quiz_id) on delete cascade,
  position        integer not null check (position >= 0),
  question_type   text not null default 'multiple_choice' check (question_type in ('multiple_choice', 'true_false')),
  question        text not null,
  options         jsonb not null,
  correct_answer  jsonb not null,
  points          smallint not null default 1 check (points >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (quiz_id, position),
  check (jsonb_typeof(options) = 'array'),
  check (jsonb_typeof(correct_answer) = 'array')
);

create trigger trg_quiz_questions_updated_at
  before update on public.quiz_questions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 13. enrollments (student x course lifecycle)
-- ----------------------------------------------------------------------------
create table public.enrollments (
  enrollment_id   uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  student_id      uuid not null references public.students (student_id) on delete cascade,
  course_id       uuid not null references public.courses (course_id) on delete restrict,
  status          text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  ended_at        timestamptz,
  enrolled_by     uuid references public.profiles (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- A student can never hold two open enrollments in the same course
create unique index enrollments_student_course_open_unique
  on public.enrollments (student_id, course_id)
  where status in ('active', 'paused');

create index enrollments_student_status_idx on public.enrollments (student_id, status);
create index enrollments_course_status_idx on public.enrollments (course_id, status);
create index enrollments_organization_id_idx on public.enrollments (organization_id);

create trigger trg_enrollments_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 14. lesson_progress (composite PK; status + timestamps only, no percentages)
-- ----------------------------------------------------------------------------
create table public.lesson_progress (
  enrollment_id    uuid not null references public.enrollments (enrollment_id) on delete cascade,
  lesson_id        uuid not null references public.lessons (lesson_id) on delete cascade,
  status           text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  started_at       timestamptz,
  last_accessed_at timestamptz,
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (enrollment_id, lesson_id),
  check ((status = 'not_started') = (started_at is null and completed_at is null)),
  check (status <> 'completed' or completed_at is not null)
);

create index lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);

create trigger trg_lesson_progress_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 15. quiz_attempts (no organization_id: org reached via quizzes FK chain)
-- ----------------------------------------------------------------------------
create table public.quiz_attempts (
  attempt_id   uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes (quiz_id) on delete cascade,
  student_id   uuid not null references public.students (student_id) on delete cascade,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  score        smallint,
  max_score    smallint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Draft attempts carry no score; submitted attempts carry both.
  check ((submitted_at is null) = (score is null and max_score is null)),
  -- Score cannot exceed the snapshot maximum (NULL-safe: passes when either side is NULL).
  check (score is null or score between 0 and max_score)
);

create index quiz_attempts_quiz_submitted_idx on public.quiz_attempts (quiz_id, submitted_at);
create index quiz_attempts_student_submitted_idx on public.quiz_attempts (student_id, submitted_at);
create index quiz_attempts_quiz_student_idx on public.quiz_attempts (quiz_id, student_id);

create trigger trg_quiz_attempts_updated_at
  before update on public.quiz_attempts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 16. quiz_attempt_answers (per-question results; composite PK)
-- ----------------------------------------------------------------------------
create table public.quiz_attempt_answers (
  attempt_id     uuid not null references public.quiz_attempts (attempt_id) on delete cascade,
  question_id    uuid not null references public.quiz_questions (question_id) on delete cascade,
  selected_answer jsonb not null,
  is_correct     boolean not null,
  points_earned  smallint not null default 0 check (points_earned >= 0),
  created_at     timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index quiz_attempt_answers_question_id_idx on public.quiz_attempt_answers (question_id);

-- ----------------------------------------------------------------------------
-- 17. ai_conversations (thread; lead XOR student binding)
-- ----------------------------------------------------------------------------
create table public.ai_conversations (
  conversation_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (organization_id) on delete restrict,
  user_id         uuid references public.profiles (user_id) on delete set null,
  lead_id         uuid references public.leads (lead_id) on delete set null,
  student_id      uuid references public.students (student_id) on delete set null,
  title           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- A thread is about a lead OR a student OR neither, never both.
  check (lead_id is null or student_id is null)
);

create index ai_conversations_org_updated_idx
  on public.ai_conversations (organization_id, updated_at desc);

create index ai_conversations_user_id_idx on public.ai_conversations (user_id);
create index ai_conversations_lead_id_idx on public.ai_conversations (lead_id);
create index ai_conversations_student_id_idx on public.ai_conversations (student_id);

create trigger trg_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 18. ai_messages (turns within a conversation)
-- ----------------------------------------------------------------------------
create table public.ai_messages (
  message_id      uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (conversation_id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at);

-- ----------------------------------------------------------------------------
-- 19. RLS helper functions (SECURITY DEFINER: org/role derived from auth.uid())
--     Authorization is derived ONLY from the authenticated session + profiles.
--     Client-supplied organization_id / user_id / role values are never trusted.
-- ----------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.profiles
  where user_id = auth.uid()
    and is_active;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where user_id = auth.uid()
    and is_active;
$$;

-- True only when the acting user is an active member of an organization
-- AND their role is in the required list.
create or replace function public.has_role(required text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and is_active
      and organization_id is not null
      and role = any (required)
  );
$$;

-- ----------------------------------------------------------------------------
-- 20. Profile privilege-escalation guard
--     RLS cannot compare OLD/NEW rows, so a BEFORE UPDATE trigger enforces
--     that role / organization membership / active status are admin-only.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.role is distinct from old.role
    or new.organization_id is distinct from old.organization_id
    or new.is_active is distinct from old.is_active
  ) and not public.has_role(array['admin']) then
    raise exception 'Only admins may change role, organization membership, or active status';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- ----------------------------------------------------------------------------
-- 21. RLS enablement
-- ----------------------------------------------------------------------------
alter table public.organizations       enable row level security;
alter table public.profiles            enable row level security;
alter table public.leads               enable row level security;
alter table public.lead_activities     enable row level security;
alter table public.followups           enable row level security;
alter table public.students            enable row level security;
alter table public.courses             enable row level security;
alter table public.course_modules      enable row level security;
alter table public.lessons             enable row level security;
alter table public.enrollments         enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.quizzes             enable row level security;
alter table public.quiz_questions      enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.quiz_attempt_answers enable row level security;
alter table public.ai_conversations    enable row level security;
alter table public.ai_messages         enable row level security;

-- ----------------------------------------------------------------------------
-- 22. RLS policies
-- ----------------------------------------------------------------------------

-- 22.1 organizations ---------------------------------------------------------
create policy organizations_select_members
  on public.organizations for select
  using (organization_id = public.current_org_id());

create policy organizations_insert_admin
  on public.organizations for insert to authenticated
  with check (public.has_role(array['admin']));

create policy organizations_update_admin
  on public.organizations for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin'])
  );

create policy organizations_delete_admin
  on public.organizations for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin'])
  );

-- 22.2 profiles --------------------------------------------------------------
create policy profiles_select_own
  on public.profiles for select
  using (user_id = auth.uid());

create policy profiles_select_org_staff_directory
  on public.profiles for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
  );

create policy profiles_insert_admin
  on public.profiles for insert to authenticated
  with check (public.has_role(array['admin']));

create policy profiles_update_self_or_admin
  on public.profiles for update to authenticated
  using (
    user_id = auth.uid()
    or (
      organization_id = public.current_org_id()
      and public.has_role(array['admin'])
    )
  )
  with check (
    user_id = auth.uid()
    or (
      organization_id = public.current_org_id()
      and public.has_role(array['admin'])
    )
  );

create policy profiles_delete_admin
  on public.profiles for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin'])
  );

-- 22.3 leads -----------------------------------------------------------------
create policy leads_select_org_staff
  on public.leads for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy leads_insert_org_staff
  on public.leads for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy leads_update_org_staff
  on public.leads for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy leads_delete_org_staff
  on public.leads for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

-- 22.4 lead_activities (append-only: select + insert only) -------------------
create policy lead_activities_select_org_staff
  on public.lead_activities for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy lead_activities_insert_org_staff
  on public.lead_activities for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

-- 22.5 followups -------------------------------------------------------------
create policy followups_select_org_staff
  on public.followups for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy followups_insert_org_staff
  on public.followups for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy followups_update_org_staff
  on public.followups for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy followups_delete_org_staff
  on public.followups for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

-- 22.6 students --------------------------------------------------------------
create policy students_select_staff
  on public.students for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
  );

create policy students_select_own
  on public.students for select
  using (profile_id = auth.uid());

create policy students_insert_org_staff
  on public.students for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy students_update_org_staff
  on public.students for update to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

create policy students_delete_org_staff
  on public.students for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

-- 22.7 courses ---------------------------------------------------------------
create policy courses_select_staff
  on public.courses for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
  );

create policy courses_select_student_published
  on public.courses for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['student'])
    and status = 'published'
  );

create policy courses_write_instructor_admin
  on public.courses for all to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  );

-- 22.8 course_modules --------------------------------------------------------
create policy course_modules_select_staff
  on public.course_modules for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
  );

create policy course_modules_select_student_published_course
  on public.course_modules for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['student'])
    and exists (
      select 1 from public.courses c
      where c.course_id = course_modules.course_id
        and c.status = 'published'
    )
  );

create policy course_modules_write_instructor_admin
  on public.course_modules for all to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  );

-- 22.9 lessons ---------------------------------------------------------------
create policy lessons_select_staff
  on public.lessons for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
  );

create policy lessons_select_student_published
  on public.lessons for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['student'])
    and is_published
    and exists (
      select 1
      from public.course_modules m
      join public.courses c on c.course_id = m.course_id
      where m.module_id = lessons.module_id
        and c.status = 'published'
    )
  );

create policy lessons_write_instructor_admin
  on public.lessons for all to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  );

-- 22.10 enrollments ----------------------------------------------------------
create policy enrollments_select_staff
  on public.enrollments for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
  );

create policy enrollments_select_own
  on public.enrollments for select
  using (
    exists (
      select 1 from public.students s
      where s.student_id = enrollments.student_id
        and s.profile_id = auth.uid()
    )
  );

create policy enrollments_write_org_staff
  on public.enrollments for all to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor'])
  );

-- 22.11 lesson_progress ------------------------------------------------------
create policy lesson_progress_select_staff
  on public.lesson_progress for select
  using (
    public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
    and exists (
      select 1 from public.enrollments e
      where e.enrollment_id = lesson_progress.enrollment_id
        and e.organization_id = public.current_org_id()
    )
  );

create policy lesson_progress_select_own
  on public.lesson_progress for select
  using (
    exists (
      select 1
      from public.enrollments e
      join public.students s on s.student_id = e.student_id
      where e.enrollment_id = lesson_progress.enrollment_id
        and s.profile_id = auth.uid()
    )
  );

create policy lesson_progress_write_student_own
  on public.lesson_progress for insert to authenticated
  with check (
    exists (
      select 1
      from public.enrollments e
      join public.students s on s.student_id = e.student_id
      where e.enrollment_id = lesson_progress.enrollment_id
        and s.profile_id = auth.uid()
    )
  );

create policy lesson_progress_write_staff
  on public.lesson_progress for insert to authenticated
  with check (
    public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
    and exists (
      select 1 from public.enrollments e
      where e.enrollment_id = lesson_progress.enrollment_id
        and e.organization_id = public.current_org_id()
    )
  );

create policy lesson_progress_update_student_own
  on public.lesson_progress for update to authenticated
  using (
    exists (
      select 1
      from public.enrollments e
      join public.students s on s.student_id = e.student_id
      where e.enrollment_id = lesson_progress.enrollment_id
        and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.enrollments e
      join public.students s on s.student_id = e.student_id
      where e.enrollment_id = lesson_progress.enrollment_id
        and s.profile_id = auth.uid()
    )
  );

create policy lesson_progress_update_staff
  on public.lesson_progress for update to authenticated
  using (
    public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
    and exists (
      select 1 from public.enrollments e
      where e.enrollment_id = lesson_progress.enrollment_id
        and e.organization_id = public.current_org_id()
    )
  )
  with check (
    public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
    and exists (
      select 1 from public.enrollments e
      where e.enrollment_id = lesson_progress.enrollment_id
        and e.organization_id = public.current_org_id()
    )
  );

-- 22.12 quizzes --------------------------------------------------------------
create policy quizzes_select_staff
  on public.quizzes for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
  );

create policy quizzes_select_student_enrolled
  on public.quizzes for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['student'])
    and is_published
    and exists (
      select 1
      from public.enrollments e
      join public.students s on s.student_id = e.student_id
      where e.course_id = quizzes.course_id
        and e.status = 'active'
        and s.profile_id = auth.uid()
    )
  );

create policy quizzes_write_instructor_admin
  on public.quizzes for all to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  );

-- 22.13 quiz_questions -------------------------------------------------------
create policy quiz_questions_select_staff
  on public.quiz_questions for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
  );

create policy quiz_questions_select_student_enrolled
  on public.quiz_questions for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['student'])
    and exists (
      select 1
      from public.quizzes q
      where q.quiz_id = quiz_questions.quiz_id
        and q.is_published
        and exists (
          select 1
          from public.enrollments e
          join public.students s on s.student_id = e.student_id
          where e.course_id = q.course_id
            and e.status = 'active'
            and s.profile_id = auth.uid()
        )
    )
  );

create policy quiz_questions_write_instructor_admin
  on public.quiz_questions for all to authenticated
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  )
  with check (
    organization_id = public.current_org_id()
    and public.has_role(array['instructor', 'admin'])
  );

-- 22.14 quiz_attempts (org via quizzes FK chain) -----------------------------
create policy quiz_attempts_select_staff
  on public.quiz_attempts for select
  using (
    public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
    and exists (
      select 1 from public.quizzes q
      where q.quiz_id = quiz_attempts.quiz_id
        and q.organization_id = public.current_org_id()
    )
  );

create policy quiz_attempts_select_own
  on public.quiz_attempts for select
  using (
    exists (
      select 1 from public.students s
      where s.student_id = quiz_attempts.student_id
        and s.profile_id = auth.uid()
    )
  );

create policy quiz_attempts_insert_own
  on public.quiz_attempts for insert to authenticated
  with check (
    exists (
      select 1 from public.students s
      where s.student_id = quiz_attempts.student_id
        and s.profile_id = auth.uid()
    )
  );

create policy quiz_attempts_update_own
  on public.quiz_attempts for update to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.student_id = quiz_attempts.student_id
        and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.student_id = quiz_attempts.student_id
        and s.profile_id = auth.uid()
    )
  );

-- 22.15 quiz_attempt_answers (org via attempt -> quiz chain) -----------------
create policy quiz_attempt_answers_select_staff
  on public.quiz_attempt_answers for select
  using (
    public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
    and exists (
      select 1
      from public.quiz_attempts a
      join public.quizzes q on q.quiz_id = a.quiz_id
      where a.attempt_id = quiz_attempt_answers.attempt_id
        and q.organization_id = public.current_org_id()
    )
  );

create policy quiz_attempt_answers_select_own
  on public.quiz_attempt_answers for select
  using (
    exists (
      select 1
      from public.quiz_attempts a
      join public.students s on s.student_id = a.student_id
      where a.attempt_id = quiz_attempt_answers.attempt_id
        and s.profile_id = auth.uid()
    )
  );

create policy quiz_attempt_answers_insert_own
  on public.quiz_attempt_answers for insert to authenticated
  with check (
    exists (
      select 1
      from public.quiz_attempts a
      join public.students s on s.student_id = a.student_id
      where a.attempt_id = quiz_attempt_answers.attempt_id
        and s.profile_id = auth.uid()
    )
  );

-- 22.16 ai_conversations -----------------------------------------------------
create policy ai_conversations_select_owner
  on public.ai_conversations for select
  using (user_id = auth.uid());

create policy ai_conversations_select_admin_audit
  on public.ai_conversations for select
  using (
    organization_id = public.current_org_id()
    and public.has_role(array['admin'])
  );

create policy ai_conversations_insert_owner
  on public.ai_conversations for insert to authenticated
  with check (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
  );

create policy ai_conversations_update_owner
  on public.ai_conversations for update to authenticated
  using (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
  )
  with check (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
  );

-- 22.17 ai_messages (org via conversation) -----------------------------------
create policy ai_messages_select_owner
  on public.ai_messages for select
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.conversation_id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy ai_messages_select_admin_audit
  on public.ai_messages for select
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.conversation_id = ai_messages.conversation_id
        and c.organization_id = public.current_org_id()
        and public.has_role(array['admin'])
    )
  );

create policy ai_messages_insert_owner
  on public.ai_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.conversation_id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 23. Function grants (policies evaluate for anon/authenticated sessions)
-- ----------------------------------------------------------------------------
grant execute on function public.set_updated_at() to anon, authenticated, service_role;
grant execute on function public.handle_new_user() to anon, authenticated, service_role;
grant execute on function public.prevent_profile_privilege_escalation() to anon, authenticated, service_role;
grant execute on function public.current_org_id() to anon, authenticated, service_role;
grant execute on function public.current_user_role() to anon, authenticated, service_role;
grant execute on function public.has_role(text[]) to anon, authenticated, service_role;