# Changelog

## Phase 16 — Lesson Resource Authoring
- Added `LessonResource` type structure to strictly type resource data.
- Implemented `ResourceManager` component for client-side multi-resource handling.
- Supported file uploads directly to Supabase storage with progress indication.
- Supported external URL resources with strict HTTP/HTTPS validation.
- Enabled resource ordering and live storage cleanup upon removal.
- Updated server actions (`createLesson`, `updateLesson`) for strict server-side resource validation and JSON parsing.
- Integrated temporary signed URLs for secure student resource rendering.
- Passed all linting and production build validations.

## Previous Phases Summary
- **Phase 1-14**: Foundation setup including CRM (Leads, Students, Users), LMS capabilities (Courses, Modules, Lessons, Analytics), and AI Assistant integrations. Implemented Synthetix dark design system.
- **Phase 15**: Complete Authentication architecture (Supabase Auth, Email/Password, Google OAuth), Next.js Middleware route protection, and server-side session management.
- **Course Media Architecture**: Developed secure `course-media` storage, signed URL generation, and course thumbnail/lesson video integrations backed by strict Row Level Security (RLS).
