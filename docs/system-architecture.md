# System architecture

## Scope and evidence

This document describes the tracked repository as of 2026-08-18. The SQL migrations are the repository schema source; the live Supabase project, Vercel project, GitHub remote, and deployed domain were not available for inspection in this workspace.

## Application

The application uses Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS 4, and Supabase SSR. Pages and layouts are server components by default. Forms, navigation, status controls, and media upload controls are client components. Server Actions execute writes with the caller's Supabase cookie session and are expected to perform authorization through `src/lib/crm.ts` or `src/lib/admin.ts`.

`src/proxy.ts` refreshes the Supabase cookie session and protects `/dashboard/**`. The protected layout repeats the `getUser()` check, so direct rendering is also guarded. Dashboard navigation is assembled server-side from the current profile role before it reaches the client sidebar.

## Authentication and authorization

Supabase Auth is the identity source. Browser and server clients use only the public Supabase URL and publishable key. The service-role client is server-only and is not imported by browser components.

Email/password login and signup use server actions. Google OAuth starts in the browser and returns to `/auth/callback`, which exchanges the code for a cookie session. Password recovery generates an origin-aware callback URL and then exchanges the recovery code before `/reset-password` renders. Callback `next` values accept only local absolute paths.

The `handle_new_user` trigger creates a profile with a null role and organization. This is deliberately authenticated-but-unprovisioned: an administrator must assign an organization and approved role. It never grants admin access automatically.

## Roles and navigation

Valid application roles are `admin`, `sales`, `counselor`, `instructor`, and `student`. Role and organization checks are derived from `profiles` and enforced by Supabase RLS. The dashboard conditionally displays Leads, Students, Users, and Settings; visibility is not relied on for authorization because page and action contexts check roles again.

## Domain data

- CRM: `leads`, `lead_activities`, and `followups`; lead conversion links a lead to a `students` row.
- LMS: `courses` -> `course_modules` -> `lessons`; `enrollments` associate students with courses; `lesson_progress` is per enrollment and lesson.
- Assessments: `quizzes` are course-scoped; `quiz_questions`, `quiz_attempts`, and `quiz_attempt_answers` support attempts and scoring.
- Intelligence: readiness and analytics are derived at read time from progress and assessment data. There is no lesson-to-quiz foreign key, so sequential quiz gating is intentionally not implemented.

## Storage

`course-media` is a private Supabase Storage bucket. New objects use `org/{organization_id}/courses/{course_id}/...`; browser uploads store object paths, create short-lived signed URLs only for preview, and are limited by bucket MIME type and size rules. The migration `20260818120000_secure_course_media.sql` restricts staff by organization and students to active enrollment in the published course named in the object path. Media from the old unscoped path convention must be re-uploaded before applying the restrictive policy in a live project.

## Deployment

The intended path is Git -> GitHub -> Vercel -> Supabase. Required client variables are in `.env.example`; `SUPABASE_SERVICE_ROLE_KEY` is server-only and optional unless the admin client is used. Configure Supabase redirect allow-lists for both local origins and the production Vercel origin, including `/auth/callback` and its password-recovery flow.
