# Routes Inventory

| Route | Purpose | Authentication Requirement | Major Functionality |
|---|---|---|---|
| `/` | Landing/Redirect | None | Typically redirects to `/login` or marketing site. |
| `/login` | Authentication | None | User sign-in interface handling credentials. |
| `/dashboard` | Main Overview | Required | Core workspace, Phase 15 Readiness KPIs, general analytics. |
| `/dashboard/leads` | CRM List | Required | Displays tables of prospective students/leads. |
| `/dashboard/leads/new` | CRM Action | Required | Form to create a new lead. |
| `/dashboard/leads/[id]` | CRM Detail | Required | Detailed view of a specific lead, status updates, conversion. |
| `/dashboard/students` | LMS List | Required | Displays list of enrolled students. |
| `/dashboard/students/[id]` | LMS Detail | Required | Detailed progress and learning profile of a student. |
| `/dashboard/courses` | LMS List | Required | Displays course catalog. |
| `/dashboard/courses/[id]` | LMS Detail | Required | Detailed structure and metadata for a specific course. |
| `/dashboard/users` | Admin List | Required | User management and roles overview. |
| `/dashboard/analytics` | Intelligence | Required | Advanced charts and metrics for system health (placeholder). |
| `/dashboard/ai` | Intelligence | Required | AI Assistant interface (placeholder/deferred). |
| `/dashboard/settings` | Admin Config | Required | System and user preferences (placeholder). |
