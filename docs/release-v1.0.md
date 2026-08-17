# Release Notes: V1.0.0

## Product Details
- **Product**: AI Learning & CRM Hub
- **Version**: 1.0.0
- **Status**: STABLE

> **V1.0 is the stable baseline.** All subsequent feature development (Phase 18+) must branch from this state.

## Release Scope
V1.0 establishes the foundational Learning Management System and Customer Relationship Management platforms, augmented with initial Intelligence scoring logic, securely deployed on a robust Next.js + Supabase stack. It features a complete visual overhaul utilizing a "Dark SaaS" UI.

## Implemented Modules
- **Authentication**: Secure JWT-based routing and session management.
- **CRM System**: Lead ingestion, tracking, and conversion management.
- **LMS System**: Student tracking, course catalog, lesson delivery, and quizzes.
- **Intelligence**: Learner Readiness KPIs (PATH A).
- **Admin**: User roles and system management.

## QA Results
- **Authentication / Protected Routes**: PASS
- **Dashboard / Data Layer**: PASS
- **E2E Browser Validation**: PASS
- **Responsive Layouts**: PASS
- **Lint**: PASS (0 issues)
- **Build**: PASS
- **Console/Network**: PASS (0 errors during runtime validation)

## Known Limitations
- Real-time chat or multi-tenancy are not supported in this baseline.
- AI Assistant endpoints are currently UI placeholders without backend integration.

## Deferred Functionality
- **Phase 15 PATH B (Quiz Gating)**: Intentionally deferred. The current `initial_schema.sql` lacks the direct `lesson <-> quiz` relational mapping required to dynamically block/unlock sequential lessons based on distinct assessment scores.

## Deployment Status
- **Vercel**: Configured for automatic deployments from `main`.
- **Supabase**: Configured for Edge functions and live database connections.

## Rollback / Recovery Information
In the event of a deployment failure:
- **Frontend**: Vercel supports instantaneous rollbacks to the previous deployment via the Vercel Dashboard.
- **Database**: Supabase supports Point-in-Time Recovery (PITR) and manual SQL schema rollbacks using the `migrations` history.
