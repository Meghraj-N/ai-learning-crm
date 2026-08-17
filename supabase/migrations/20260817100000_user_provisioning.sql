-- ============================================================================
-- AI Learning & CRM Hub — V1 User Provisioning (Phase 6)
-- Migration: 20260817100000_user_provisioning.sql
--
-- Purpose: fix the Auth -> profiles provisioning flaw and enable secure
-- Admin user management, without weakening RLS or organization isolation.
--
-- Architecture decision: role NULL = authenticated but NOT provisioned.
--   AUTHENTICATION != AUTHORIZATION.
--   A new Auth user gets a safe unprovisioned profile (no organization,
--   no role). Authorization (organization + role + active status) is only
--   granted later by an Admin of the acting organization, server-side.
--
-- Why NULL role is safe here:
--   - has_role() requires organization_id IS NOT NULL AND role = ANY(...)
--     -> NULL role/org always evaluates to "no access" for unprovisioned users.
--   - current_org_id() / current_user_role() return NULL for unprovisioned users.
--   - Every existing org-scoped policy therefore blocks unprovisioned users
--     with zero policy changes. The CHECK constraint still validates all
--     non-NULL roles; SQL CHECK treats NULL as "passes".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.role becomes nullable. NULL = authenticated, not yet provisioned.
-- ----------------------------------------------------------------------------
alter table public.profiles
  alter column role drop not null;

comment on column public.profiles.role is
  'NULL = authenticated but not yet provisioned. Non-NULL must be one of the five approved roles (admin, sales, counselor, instructor, student).';

-- ----------------------------------------------------------------------------
-- 2. Harden handle_new_user(): profile creation must never fail on missing
--    email/metadata. Creates a safe unprovisioned profile only
--    (organization_id NULL, role NULL, is_active default true).
--    It never assigns a role or organization, so it can never grant
--    elevated privileges.
-- ----------------------------------------------------------------------------
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
      split_part(coalesce(new.email, ''), '@', 1),
      'user'
    )
  );
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Strengthen the privilege-escalation guard. Preserves the original
--    purpose (only active admins may change role/org/active status) and adds:
--      a) No user may change their OWN security fields (blocks admin
--         self-demotion / self-deactivation footguns and any self-elevation).
--      b) Admin accounts may not be modified through the application at all
--         (protection for changing another admin's role).
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
  ) then
    if new.user_id = auth.uid() then
      raise exception 'Users may not change their own role, organization, or active status';
    end if;
    if not public.has_role(array['admin']) then
      raise exception 'Only admins may change role, organization membership, or active status';
    end if;
    if old.role = 'admin' then
      raise exception 'Admin accounts may not be modified through the application';
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Allow admins to UPDATE unprovisioned profiles.
--    USING is extended so an admin may target rows in their organization OR
--    the unprovisioned pool (organization_id IS NULL).
--    WITH CHECK is UNCHANGED: the NEW row must belong to the acting admin's
--    organization, so provisioning cannot assign an arbitrary organization
--    and organization isolation is preserved.
-- ----------------------------------------------------------------------------
drop policy if exists profiles_update_self_or_admin on public.profiles;

create policy profiles_update_self_or_admin
  on public.profiles for update to authenticated
  using (
    user_id = auth.uid()
    or (
      organization_id = public.current_org_id()
      and public.has_role(array['admin'])
    )
    or (
      organization_id is null
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

-- ----------------------------------------------------------------------------
-- 5. Admins may list the unprovisioned pool so new users can be provisioned.
--    Single-business V1 note: unprovisioned profiles belong to no
--    organization, so any admin can list the pool; provisioned rows remain
--    strictly org-scoped and staff directories are unchanged.
-- ----------------------------------------------------------------------------
create policy profiles_select_unprovisioned_admin
  on public.profiles for select to authenticated
  using (
    organization_id is null
    and public.has_role(array['admin'])
  );  