# Phase 16: Lesson Resource Authoring

## Objective
To complete the LMS authoring experience by allowing instructors to manage downloadable lesson resources (PDFs, DOCX, PPTX) and external URLs within the existing `LessonForm` and securely render them to enrolled students.

## Architecture
- **Data Layer**: Leveraged the existing `lessons.resources` JSONB column. Defined `LessonResource` in `src/types/crm.ts` to strictly type the structure of the JSON payload.
- **Storage Layer**: Reused the existing `course-media` bucket. Configured uploads directly from the client to reduce server overhead and bypass Next.js API route limits on large payloads.
- **Client Components**: Built `ResourceManager` as a standalone client component for file selection, ordering, uploading, and external URL handling.
- **Server Actions**: Updated `createLesson` and `updateLesson` to parse the stringified JSON resources payload, enabling strict validation before persistence.

## Files Changed
- `src/types/crm.ts`
- `src/components/ui/resource-manager.tsx`
- `src/app/(protected)/dashboard/courses/lesson-form.tsx`
- `src/app/(protected)/dashboard/courses/actions.ts`
- `src/app/(protected)/dashboard/courses/[id]/page.tsx`
- `src/app/(protected)/dashboard/courses/[id]/lessons/[lessonId]/page.tsx`
- `src/lib/courses.ts`

## Security Model
- **Boundary Control**: Retained the server/client boundaries by keeping file uploading explicitly on the browser client (`createSupabaseBrowserClient()`). JSON serialization safely transfers the state back to the Server Action.
- **Validation**: Enforced HTTP/HTTPS prefix requirements and explicitly blocked `javascript:` schemes to prevent XSS payloads on the external URLs.
- **Signed URL Lifecycle**: Server-side resolution in `LessonView` fetches dynamic signed URLs with a 1-hour expiration. Storage objects are never directly exposed. Active Row Level Security (RLS) protects the bucket.

## Upload Lifecycle
1. User selects a document via `ResourceManager`.
2. Validated against max size (50MB) and allowed extensions.
3. Uploaded directly to `course-media` via `supabase.storage.upload`.
4. Progress UI locks.
5. On success, `url` path is stored in the local `LessonResource` state.
6. Instructor saves lesson. `resources` array is stringified into FormData and submitted to Server Action.
7. Server parses, validates, and commits to Postgres.

## Verification
- Clean linting (`npm run lint`).
- Clean production builds (`npm run build`).

## Known Limitations
- When a resource is removed from the form but the lesson is not saved, the file is orphaned in the Supabase bucket. A daily cron job could be implemented in the future to sweep the `course-media` bucket for orphaned resources.
