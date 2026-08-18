# Route inventory

All `/dashboard/**` routes require a Supabase cookie session through `src/proxy.ts` and the protected layout. Individual pages and server actions perform role checks; navigation visibility is not authorization.

| Route | Purpose | Auth / role | Render and data | Status |
| --- | --- | --- | --- | --- |
| `/` | Redirect to login | Public | Server redirect | Implemented |
| `/login` | Email/password and Google sign-in | Guest only | Server page + client form; Supabase Auth | Implemented |
| `/signup` | Email/password and Google sign-up | Guest only | Server page + client form; Supabase Auth/profile trigger | Implemented |
| `/forgot-password` | Start recovery email | Guest only | Server action; Supabase Auth | Implemented |
| `/reset-password` | Complete recovery | Recovery session required | Server page + server action; Supabase Auth | Implemented |
| `/auth/callback` | Exchange OAuth/recovery code | Public callback | Route handler; Supabase SSR | Implemented |
| `/dashboard` | Role-aware overview/readiness | Authenticated; content by role | Server page; profiles, CRM/LMS/analytics data | Implemented |
| `/dashboard/leads` | Lead list | CRM staff | Server page; `leads` | Implemented |
| `/dashboard/leads/new` | Create lead | CRM staff | Server page/client form/action; `leads` | Implemented |
| `/dashboard/leads/[id]` | Lead, assignment, conversion, activities, follow-ups | CRM staff | Server page/client controls/actions; CRM tables | Implemented |
| `/dashboard/students` | Student directory | Student-view roles | Server page; `students` | Implemented |
| `/dashboard/students/[id]` | Student detail and enrollment progress | Student-view roles | Server page/actions; students, enrollments, progress | Implemented |
| `/dashboard/courses` | Course catalog | Authenticated; writes restricted | Server page; courses, modules, enrollments | Implemented |
| `/dashboard/courses/new` | Create course | Instructor/admin | Server page/client form/action; `courses` | Implemented |
| `/dashboard/courses/[id]` | Course, modules, lessons, enrollment, quizzes | Role-aware | Server page/client controls/actions; LMS tables | Implemented |
| `/dashboard/courses/[id]/edit` | Edit course and thumbnail | Instructor/admin | Server page/client form/action; courses and private storage | Implemented |
| `/dashboard/courses/[id]/lessons/[lessonId]` | Lesson reading and progress | Enrolled student or staff | Server page/client controls; lessons/progress | Implemented |
| `/dashboard/courses/[id]/quizzes/[quizId]` | Quiz management and results | Role-aware | Server page/client controls/actions; quiz tables | Implemented |
| `/dashboard/courses/[id]/quizzes/[quizId]/attempt` | Begin/continue attempt | Enrolled student | Server page/client form/action; quiz tables | Implemented |
| `/dashboard/courses/[id]/quizzes/[quizId]/attempts/[attemptId]` | Attempt review | Attempt owner or staff | Server page; quiz tables | Implemented |
| `/dashboard/users` | User provisioning and role/active management | Admin | Server page/client forms/actions; profiles and Auth admin path | Implemented |
| `/dashboard/analytics` | Organization analytics and readiness | Admin | Server page; analytics queries | Implemented |
| `/dashboard/settings` | Settings placeholder | Admin | Server page | Placeholder |
No `/dashboard/ai` route exists in the repository; earlier documentation that listed it was inaccurate.
