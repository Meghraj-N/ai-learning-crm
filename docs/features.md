# Features

## CRM
**Leads**
- **Lead management**: Create, view, update, and track prospective student leads.
- **Assignment**: Assign leads to specific sales representatives or admins.
- **Status**: Track lead status (e.g., New, Contacted, Qualified, Converted, Lost).
- **Search/Filter functionality**: Filter and search through lead tables.

## LMS
**Students**
- **Student profiles**: View detailed profiles of enrolled students.
- **Student list**: Centralized table for tracking all active learners.

**Courses**
- **Course catalog**: List of available courses and modules.
- **Course details**: View specific course metadata and structure.

**Learning Progress & Assessments**
- **Learning progress**: Track student advancement through course modules.
- **Assessments**: Access quiz results and evaluation scores.

## Intelligence
**Learner Readiness (Phase 15 PATH A)**
- **Readiness scoring**: High-level calculation indicating a student's preparedness.
- **Assessment intelligence**: Utilizing existing quiz scores to infer comprehension and risk.
- **Risk states**: UI states for highlighting at-risk learners or insufficient data scenarios.

## Administration
**Users**
- **User lists**: View registered administrative and student users.
- **Role tracking**: Differentiate between Admins, Instructors, and Students.

**Authentication & Security**
- **Authentication**: Secure login via Supabase GoTrue.
- **Protected routes**: Dashboard and internal CRM/LMS functionality are strictly gated behind authenticated sessions.
