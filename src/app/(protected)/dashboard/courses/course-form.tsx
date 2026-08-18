"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { COURSE_STATUSES, type CourseStatus } from "@/types/crm";
import { createCourse, updateCourse } from "./actions";
import { MediaUploader } from "@/components/ui/media-uploader";
import { Textarea } from "@/components/ui/textarea";

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

export function CourseForm({
  courseId,
  initialTitle,
  initialDescription,
  initialThumbnailUrl,
  initialThumbnailPreviewUrl,
  organizationId,
  initialStatus,
}: {
  courseId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialThumbnailUrl?: string | null;
  initialThumbnailPreviewUrl?: string | null;
  organizationId: string;
  initialStatus?: CourseStatus;
}) {
  const router = useRouter();
  const isEdit = Boolean(courseId);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialThumbnailUrl ?? null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    initialThumbnailPreviewUrl ?? initialThumbnailUrl ?? null
  );

  const [state, formAction, pending] = useActionState(
    isEdit ? updateCourse : createCourse,
    { ok: false, error: null }
  );

  return (
    <form
      action={(formData) => {
        if (courseId) {
          formData.set("courseId", courseId);
        }
        formAction(formData);
      }}
      className="mt-6 space-y-4"
    >
      {state.ok && state.error === null && (
        <div className="rounded-md border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 px-4 py-3">
          <p className="text-sm text-[var(--color-success)]">
            {isEdit ? "Course updated." : "Course created."}
          </p>
        </div>
      )}
      {!state.ok && state.error && (
        <div className="rounded-md border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3">
          <p className="text-sm text-[var(--color-destructive)]">{state.error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={TITLE_MAX}
          defaultValue={initialTitle ?? ""}
          className="mt-1 block w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium text-[var(--color-text-primary)] mb-1"
        >
          Thumbnail Image
        </label>
        <MediaUploader
          bucket="course-media"
          folderPath={`org/${organizationId}/courses/${courseId ?? "draft"}/thumbnails`}
          accept="image/jpeg, image/png, image/webp"
          type="image"
          existingUrl={thumbnailPreviewUrl}
          onUploadSuccess={(path, previewUrl) => {
            setThumbnailUrl(path);
            setThumbnailPreviewUrl(previewUrl);
          }}
          onRemove={() => {
            setThumbnailUrl(null);
            setThumbnailPreviewUrl(null);
          }}
          disabled={!courseId}
          maxSizeMB={5}
        />
        {!courseId && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Save the course before uploading its thumbnail.
          </p>
        )}
        <input type="hidden" name="thumbnail_url" value={thumbnailUrl ?? ""} />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          defaultValue={initialDescription ?? ""}
          disabled={pending}
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Shown on the course card and detail page.
        </p>
      </div>

      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-[var(--color-text-primary)]"
        >
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={initialStatus ?? "draft"}
          className="mt-1 block w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)]"
        >
          {COURSE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Published courses are visible to students.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : isEdit
            ? "Save changes"
            : "Create course"}
      </button>

      {state.ok && state.error === null && !isEdit && "courseId" in state && (
        <button
          type="button"
          onClick={() =>
            router.push(
              `/dashboard/courses/${(state as { courseId?: string }).courseId}`
            )
          }
          className="ml-3 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)]"
        >
          View course
        </button>
      )}
    </form>
  );
}
