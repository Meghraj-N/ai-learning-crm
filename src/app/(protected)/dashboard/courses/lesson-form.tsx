"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createLesson, updateLesson, type ActionState } from "./actions";
import { MediaUploader } from "@/components/ui/media-uploader";

const TITLE_MAX = 200;
const CONTENT_MAX = 50000;

export function LessonForm({
  courseId,
  moduleId,
  lessonId,
  initialTitle,
  initialContent,
  initialVideoUrl,
  initialImageUrl,
  initialPublished,
  organizationId,
}: {
  courseId: string;
  moduleId: string;
  lessonId?: string;
  initialTitle?: string;
  initialContent?: string;
  initialVideoUrl?: string | null;
  initialImageUrl?: string | null;
  initialPublished?: boolean;
  organizationId: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(lessonId);
  const [open, setOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl ?? null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(initialVideoUrl ?? null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialImageUrl ?? null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateLesson : createLesson,
    { ok: false, error: null }
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)]"
      >
        {isEdit ? "Edit" : "Add lesson"}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 px-3 py-2"
    >
      <input
        type="hidden"
        name={isEdit ? "lessonId" : "moduleId"}
        value={isEdit ? lessonId ?? "" : moduleId}
      />
      {!isEdit && <input type="hidden" name="courseId" value={courseId} />}
      <input
        type="text"
        name="title"
        required
        maxLength={TITLE_MAX}
        defaultValue={initialTitle ?? ""}
        placeholder="Lesson title"
        autoFocus
        className="block w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
      />
      <textarea
        name="content"
        rows={4}
        maxLength={CONTENT_MAX}
        defaultValue={initialContent ?? ""}
        placeholder="Lesson content"
        className="block w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]"
      />
      <input type="hidden" name="video_url" value={videoUrl ?? ""} />
      <input type="hidden" name="image_url" value={imageUrl ?? ""} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-primary)]">Lesson Video</label>
          <MediaUploader
            bucket="course-media"
            folderPath={`org/${organizationId}/courses/${courseId}/lessons/${moduleId}/video`}
            accept="video/mp4, video/webm, video/quicktime"
            type="video"
            maxSizeMB={500}
            existingUrl={videoPreviewUrl}
            onUploadSuccess={(path, previewUrl) => {
              setVideoUrl(path);
              setVideoPreviewUrl(previewUrl);
            }}
            onRemove={() => {
              setVideoUrl(null);
              setVideoPreviewUrl(null);
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-primary)]">Lesson Image / Banner</label>
          <MediaUploader
            bucket="course-media"
            folderPath={`org/${organizationId}/courses/${courseId}/lessons/${moduleId}/image`}
            accept="image/jpeg, image/png, image/webp"
            type="image"
            maxSizeMB={10}
            existingUrl={imagePreviewUrl}
            onUploadSuccess={(path, previewUrl) => {
              setImageUrl(path);
              setImagePreviewUrl(previewUrl);
            }}
            onRemove={() => {
              setImageUrl(null);
              setImagePreviewUrl(null);
            }}
          />
        </div>
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={initialPublished ?? false}
            className="h-4 w-4 rounded border-[var(--color-border)]"
          />
          Published (visible to students)
        </label>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : isEdit ? "Save" : "Add lesson"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-highest)]"
        >
          Cancel
        </button>
        {state.error && <span className="text-xs text-[var(--color-destructive)]">{state.error}</span>}
        {state.ok && (
          <span className="text-xs text-[var(--color-success)]">
            {isEdit ? "Saved." : "Lesson created."}
          </span>
        )}
      </div>
      {!isEdit && (
        <p className="text-xs text-[var(--color-text-muted)]">
          New lessons are created unpublished and only become visible to students
          when you publish them.
        </p>
      )}
    </form>
  );
}
