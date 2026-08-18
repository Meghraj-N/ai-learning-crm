import Link from "next/link";
import { requireCourseWriteContext } from "@/lib/crm";
import AccessDenied from "../../access-denied";
import { CourseForm } from "../course-form";

export default async function NewCoursePage() {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              New course
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Create a course for your organization.
            </p>
          </div>
          <Link
            href="/dashboard/courses"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Back to courses
          </Link>
        </div>
        <CourseForm />
      </div>
    </div>
  );
}
