# AI Learning & CRM Hub

## Overview
AI Learning & CRM Hub is a comprehensive SaaS application that merges Customer Relationship Management (CRM) with a Learning Management System (LMS). It is designed to manage prospective leads, convert them into students, and deliver learning content augmented by intelligent assessment and readiness tracking.

## Product Purpose
To provide a unified platform where administrators can seamlessly track sales leads, enroll students in courses, and monitor their learning progress, supported by data-driven readiness intelligence.

## Technology Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS / shadcn/ui / Custom CSS (Dark SaaS theme)
- **Backend & Database**: Supabase (PostgreSQL, GoTrue Auth)
- **Deployment**: Vercel (Frontend), Supabase (Backend)
- **Testing**: Playwright (E2E)

## Current Version
**Version**: 1.0.0 (Release Candidate / STABLE)

## Production Status
**STABLE**: The application has passed the Phase 17 E2E Browser QA audit. All critical user flows, authentication, routing, and data integrity tests have passed.

## Major Modules
- **CRM**: Lead tracking, status management, assignment, and conversion.
- **LMS**: Student profiles, course catalogs, lesson progress, and quiz assessments.
- **Intelligence**: Learner readiness scoring and assessment intelligence (Phase 15 PATH A).
- **Administration**: User management, secure authentication, and protected routing.

## Documentation Reference
- [Architecture (architecture.md)](./architecture.md)
- [Features (features.md)](./features.md)
- [Routes Inventory (routes.md)](./routes.md)
- [Database Schema (database.md)](./database.md)
- [Phase Status (phase-status.md)](./phase-status.md)
- [Deployment (deployment.md)](./deployment.md)
- [Release V1.0 (release-v1.0.md)](./release-v1.0.md)
