# AI Learning & CRM Hub — OpenCode Engineering Rules

## 1. Project Identity

Project: **AI Learning & CRM Hub**

This is a production-oriented client MVP combining:

* CRM
* LMS
* Student management
* Course management
* AI-powered business intelligence
* AI learning assistance

The application should be built as a clean, scalable SaaS foundation rather than a disposable prototype.

---

## 2. Current Technology Stack

Use the existing stack unless explicitly instructed otherwise:

* Next.js 16.3.1
* React
* TypeScript
* App Router
* Tailwind CSS
* ESLint
* Supabase PostgreSQL
* Supabase Auth
* Supabase Storage when required
* `@supabase/supabase-js`
* `@supabase/ssr`
* Gemini API
* Vercel
* GitHub

Do not replace the stack without explicit approval.

---

## 3. Agent Role

You are the **implementation engineer**.

Your responsibility is to:

* inspect the existing project
* implement approved architecture
* write production-quality TypeScript
* maintain type safety
* create clean reusable components
* implement database integrations
* write migrations when approved
* debug errors
* test changes
* keep the codebase maintainable

You are NOT the product owner.

You must not independently redefine product requirements or architecture.

---

## 4. Architecture Authority

Architecture decisions are controlled externally.

If a task specifies:

* database structure
* table relationships
* authentication architecture
* authorization model
* API architecture
* AI architecture
* folder architecture
* security model

follow the specification exactly.

If something appears ambiguous or contradictory, **stop and ask for clarification instead of inventing a solution**.

---

## 5. Before Making Changes

Before modifying the project:

1. Inspect the existing files.
2. Understand the current implementation.
3. Identify dependencies between files.
4. Determine the smallest safe change.
5. Explain the proposed changes for significant tasks.

Never assume that a file does not exist.

Never overwrite working code unnecessarily.

---

## 6. Minimal-Change Principle

Prefer:

```text
small change
→ test
→ verify
→ commit
```

over:

```text
large rewrite
→ hope it works
```

Do not rewrite entire files when a targeted modification is sufficient.

Do not refactor unrelated code while implementing a feature.

Do not introduce abstractions before they are needed.

---

## 7. TypeScript Rules

Use strict TypeScript.

Avoid:

```typescript
any
```

unless there is a documented technical reason.

Prefer:

* explicit interfaces/types
* inferred types where safe
* discriminated unions
* typed API responses
* typed database results

Do not silence TypeScript errors with:

```typescript
as any
```

or similar unsafe casts unless absolutely necessary.

---

## 8. Next.js Rules

Use the App Router correctly.

Prefer:

* Server Components by default
* Client Components only when browser interactivity is required
* Server Actions/API routes for server-side operations
* server-side access to secrets
* proper loading and error states

Do not unnecessarily add:

```text
"use client"
```

to entire page trees.

Never expose private API keys or secrets to browser code.

---

## 9. Supabase Rules

Supabase is the primary backend/database.

Use:

* PostgreSQL
* Supabase Auth
* Row Level Security
* typed queries where practical

Never create unrestricted production policies such as:

```sql
USING (true)
```

unless the data is intentionally public and the security implications are explicitly approved.

Never expose:

* service-role keys
* private API keys
* database passwords

to client-side code.

Use `.env.local` for local secrets.

Never commit `.env.local`.

---

## 10. Database Rules

Database design must prioritize:

* correct relationships
* referential integrity
* appropriate indexes
* useful constraints
* predictable naming
* future scalability
* organization-level data isolation

Use UUIDs for primary identifiers unless there is a specific reason not to.

Prefer:

```text
created_at
updated_at
```

for persistent business entities where appropriate.

Use foreign keys instead of relying only on application-level relationships.

Do not create duplicate or redundant tables without a clear reason.

Do not create database tables until the schema has been explicitly approved.

---

## 11. Multi-Tenant Readiness

V1 has a single business.

However, the database should remain capable of supporting multiple organizations later.

Where appropriate, use:

```text
organization_id
```

and design RLS policies around organization boundaries.

Do not build organization-switching UI unless explicitly requested.

---

## 12. CRM Principles

CRM functionality will eventually include:

* leads
* lead status
* lead assignment
* lead activities
* follow-ups
* lead scoring
* conversion to student
* AI lead analysis

CRM data should be auditable.

Avoid destructive operations when status/history tracking is more appropriate.

---

## 13. LMS Principles

LMS functionality will eventually include:

* courses
* modules
* lessons
* enrollments
* progress
* quizzes
* quiz attempts
* student learning activity

Course content should have a deterministic ordering system.

Learning progress should be associated with the specific enrollment/student and lesson.

---

## 14. AI Principles

Gemini will eventually power:

* AI lead analysis
* AI business insights
* AI tutor
* quiz generation
* student assistance

AI calls must happen server-side.

Never expose Gemini API keys in client-side code.

AI responses should use structured output where appropriate.

Do not allow AI-generated content to directly perform destructive database operations without explicit application-level validation and authorization.

---

## 15. API and Server-Side Security

Validate all external/user-provided input.

Never trust:

* URL parameters
* form values
* request bodies
* client-provided organization IDs
* client-provided user IDs
* client-provided role values

Authorization must be checked server-side.

Do not rely solely on hiding UI elements for security.

---

## 16. UI Engineering Rules

The application should eventually have a polished modern SaaS interface.

Prioritize:

* responsive layouts
* accessible components
* consistent spacing
* reusable UI components
* meaningful empty states
* loading states
* error states
* clear navigation
* keyboard accessibility

Do not create excessive animations.

Do not sacrifice usability for visual effects.

---

## 17. Dependencies

Do not install packages automatically.

Before adding a new dependency:

1. Check whether the existing stack already provides the functionality.
2. Determine whether the dependency is genuinely necessary.
3. Explain why it is needed.
4. Add it only when appropriate.

Avoid dependency bloat.

---

## 18. File and Folder Discipline

Follow the existing project structure.

Prefer clear separation between:

```text
src/app
src/components
src/lib
src/types
```

Do not create arbitrary top-level directories.

Do not move files unless necessary.

---

## 19. Environment Variables

Never hard-code secrets.

Expected environment variables may include:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
GEMINI_API_KEY=
```

Only variables that genuinely need to be exposed to the browser should use:

```text
NEXT_PUBLIC_
```

Never expose server-only secrets through `NEXT_PUBLIC_`.

---

## 20. Testing and Verification

After meaningful changes, verify:

```bash
npm run lint
```

Also verify:

* TypeScript compilation where appropriate
* relevant routes
* API behavior
* database queries
* authentication behavior
* browser behavior

Do not claim a feature works without testing it.

---

## 21. Error Handling

Errors should be:

* meaningful
* actionable
* safely exposed to users
* detailed in server logs where appropriate

Do not hide errors with empty catch blocks.

Avoid generic:

```text
Something went wrong
```

when a useful safe message can be provided.

---

## 22. Git Discipline

Make small logical commits.

Use descriptive commit messages such as:

```text
Add Supabase database schema
Add CRM lead model
Add lead management API
Add AI lead analysis
Add course management
```

Do not commit:

```text
.env.local
```

or secrets.

Do not rewrite Git history unless explicitly instructed.

---

## 23. Working With AI Coding Tasks

When given a task:

### First

Understand the requirement.

### Second

Inspect the repository.

### Third

Identify affected files.

### Fourth

Implement the smallest complete solution.

### Fifth

Run appropriate validation.

### Sixth

Report:

```text
What changed
Files changed
Tests/checks performed
Any remaining issues
```

---

## 24. Do Not Overbuild

This is an MVP.

Do not prematurely implement:

* unnecessary microservices
* complex event buses
* unnecessary abstractions
* excessive state management
* complicated caching
* unnecessary third-party services
* enterprise features that have not been requested

Build the smallest production-quality solution that satisfies the approved requirement.

---

## 25. Critical Rule

**Never invent architecture when an architectural decision has not been approved.**

If you believe a different approach is better:

1. Explain the alternative.
2. Explain the trade-offs.
3. Wait for approval.

Do not silently change the architecture.

---

## 26. Current Development Phase

Current phase:

**Foundation → Database Architecture**

Completed:

* Next.js setup
* Git
* GitHub
* Vercel
* Supabase project
* Supabase packages
* environment configuration
* Supabase connection test

Current task:

**Design and review the V1 database schema.**

Do NOT yet:

* create database tables
* build CRM UI
* build LMS UI
* integrate Gemini
* build authentication UI
* build dashboard
* create fake production data

The database schema must be reviewed and explicitly approved before implementation.

---

## 27. Final Principle

Optimize for:

**Correctness → Security → Maintainability → Simplicity → Performance → Visual polish**

Do not optimize for speed at the expense of architecture.

When uncertain, stop and ask rather than guessing.
