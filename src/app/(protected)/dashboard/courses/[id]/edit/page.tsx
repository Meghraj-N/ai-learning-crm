import Link from "next/link";
import { requireCourseWriteContext } from "@/lib/crm";
import type { Course } from "@/types/crm";
import AccessDenied from "../../../access-denied";
import { CourseForm } from "../../course-form";
import { getCourseMediaUrl } from "@/lib/course-media";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  const { id } = await params;

  const { data: course, error } = await ctx.supabase
    .from("courses")
    .select(
      "course_id, organization_id, title, description, thumbnail_url, status, created_by, created_at, updated_at"
    )
    .eq("course_id", id)
    .maybeSingle<Course>();

  if (error || !course) {
    console.error("EditCoursePage: course not found", id, error?.message);
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Course not found
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            The course you are looking for does not exist or is not available.
          </p>
          <Link
            href="/dashboard/courses"
            className="mt-6 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90"
          >
            Back to courses
          </Link>
        </div>
      </div>
    );
  }
  const thumbnailPreviewUrl = await getCourseMediaUrl(ctx.supabase, course.thumbnail_url);

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Edit course
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{course.title}</p>
          </div>
          <Link
            href={`/dashboard/courses/${course.course_id}`}
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Back to course
          </Link>
        </div>
        <CourseForm
          courseId={course.course_id}
          organizationId={ctx.organizationId}
          initialTitle={course.title}
          initialDescription={course.description ?? ""}
          initialThumbnailUrl={course.thumbnail_url}
          initialThumbnailPreviewUrl={thumbnailPreviewUrl}
          initialStatus={course.status}
        />
      </div>
    </div>
  );
}
