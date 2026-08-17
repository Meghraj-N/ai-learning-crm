# System Architecture

## Frontend
The frontend is built using **Next.js 16 (App Router)** and **React 19**. It utilizes Server Components for data fetching and SEO optimization, and Client Components for interactive UI elements.
- **Styling**: Tailwind CSS is used alongside `shadcn/ui` for accessible, reusable components. The application features a cohesive "Dark SaaS" aesthetic defined in `globals.css`.

## Backend
The backend architecture leverages the Next.js App Router API and server-side rendering combined with **Supabase** acting as a backend-as-a-service (BaaS).
- **Server/Client Boundaries**: Server components (`page.tsx`, `layout.tsx`) handle direct data fetching from Supabase using `@supabase/supabase-js` (or `@supabase/ssr`), while Client components (`"use client"`) handle interactive state (e.g., forms, dropdowns, buttons).

## Supabase
Supabase provides:
- **Database**: PostgreSQL for all relational data.
- **Authentication**: GoTrue for identity management.

## Authentication
Authentication is managed via Supabase Auth.
- Login requests are sent to Supabase.
- Session tokens are stored in secure cookies.
- **Middleware / Layout Protection**: `src/middleware.ts` and protected layout components (`src/app/(protected)/layout.tsx`) intercept requests to ensure only authenticated users can access the dashboard and CRM/LMS features. Unauthenticated users are redirected to `/login`.

## Database Access
Data access is performed through the official `@supabase/supabase-js` client. Server actions and server components initialize a server-side client to query the PostgreSQL database securely, bypassing Row Level Security (RLS) limitations where appropriate via service roles, or enforcing them via user session tokens.

## Major Reusable Components
- **DashboardShell / Sidebar / Topbar**: Core structural components for the application layout.
- **shadcn/ui Components**: Standardized UI elements (Buttons, Cards, Forms, Inputs, Badges, Tables).
- **Forms & Tables**: Reusable structures for Lead generation, Student lists, and Course catalogs.

## Phase 15 Architecture (Learner Readiness & Assessment Intelligence)
Phase 15 is implemented purely on the frontend/data-fetching layer without modifying the existing database schema (PATH A).
- It calculates learner readiness by analyzing available signals (e.g., quiz scores, lesson progress).
- Since the schema lacks a direct `lesson <-> quiz` relationship (PATH B is deferred), the intelligence algorithms extrapolate progress based on existing course-level progress and global quiz data.
- The UI exposes these calculations via the Dashboard Analytics and Readiness dashboards.
