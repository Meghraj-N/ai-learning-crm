# AI Learning & CRM Hub

## Overview
This is an integrated AI-powered Learning Management System (LMS) and Customer Relationship Management (CRM) platform. It provides a seamless experience for managing students, courses, leads, and analytics, powered by an AI assistant and a robust robust architecture.

## Core Modules
- Dashboard
- CRM
- Leads
- Students
- Courses
- Lessons
- Users
- Analytics
- AI Assistant
- Settings

## Authentication
Authentication is powered securely through Supabase Auth, supporting:
- Email/password
- Google OAuth
- Protected routes using Next.js Middleware
- Server-side session handling and validation
- Secure OAuth callbacks

## Course Management
Comprehensive course authoring tools including:
- Course management
- Course thumbnails
- Modules
- Lessons
- Lesson video
- Lesson images
- Lesson resources

## Lesson Resource Authoring
Phase 16 introduced advanced Lesson Resource Authoring capabilities:
- **File Uploads**: Direct to secure Supabase storage.
- **External URLs**: Support for external web resources.
- **Resource Ordering**: Drag-and-drop or explicit ordering.
- **URL Validation**: Rejects malformed or unsafe URL schemas (e.g. `javascript:`).
- **Secure Storage Uploads**: Client-side secure upload directly to `course-media` bucket.
- **Signed URLs**: Server-side resolution of temporary signed URLs for file resources.
- **Student Resource Access**: Secure contextual access for enrolled students.

## Security
The application is strictly secured across all boundaries:
- **Supabase RLS**: Row Level Security policies enforce contextual access.
- **Server-Side Authorization**: Deep server-side context checking for student/instructor roles.
- **Signed URLs**: Media objects are never exposed publicly; access requires an active, expiring token.
- **Private Media Access**: Enforced via storage policies.
- **Secure OAuth Flow**: Handled completely server-side.
- **Server/Client Component Boundaries**: Strict separation to prevent accidental data leakage or serialization errors.
- **Secret Handling**: Environment secrets are strictly verified and isolated.

## Technology Stack
- Next.js 15
- React 19
- TypeScript
- Supabase
- @supabase/ssr
- Tailwind CSS
- Vercel

## Development
To run this project locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Code quality and type checks:
   ```bash
   npm run lint
   npm run build
   ```

## Environment Variables
Required environment variables (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Deployment
This project is configured for seamless deployment on the Vercel platform. Pushing to the `main` branch automatically triggers a production build. Environment variables must be configured within the Vercel project settings prior to deployment.
