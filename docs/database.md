# Database Architecture

## Overview
The application relies on **Supabase** (PostgreSQL) for its data layer.

## Important Tables
- **profiles**: Extended user information mapping to `auth.users`.
- **leads**: CRM data tracking prospective students and their conversion status.
- **courses**: LMS course metadata.
- **lessons**: Individual modules associated with courses.
- **quizzes**: Assessment entities.
- **student_progress**: Tracks a student's completion of courses and lessons.
- **quiz_attempts**: Records scores and completion status for assessments.

## Relationships
- **users (auth)** 1:1 **profiles**
- **courses** 1:M **lessons**
- **courses** 1:M **quizzes**
- **users** 1:M **student_progress** (via `profiles`)
- **users** 1:M **quiz_attempts**

## Authentication Relationship
User identity is handled by `auth.users` in Supabase GoTrue. The application uses triggers to automatically provision a matching row in the `profiles` table whenever a new user signs up.

## Phase 15 Data Dependencies
Phase 15 (Learner Readiness & Assessment Intelligence) aggregates data from `student_progress` and `quiz_attempts` to generate predictive KPIs.

> [!WARNING]
> **IMPORTANT: DEFERRED FUNCTIONALITY**
> The current schema does NOT contain the `lesson <-> quiz` relationship required for true quiz gating. 
> Therefore, **PATH B** (enforcing specific quiz passing before unlocking the next sequential lesson) remains intentionally deferred until a database schema migration adds this relationship.
