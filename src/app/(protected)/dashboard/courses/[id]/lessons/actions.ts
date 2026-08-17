"use server";

import { requireStudentContext } from "@/lib/crm";

export type ActionState = {
  ok: boolean;
  error: string | null;
};

type ProgressContext = {
  enrollment_id: string;
  course_id: string;
};

function cleanField(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

async function resolveProgressContext(
  ctx: NonNullable<Awaited<ReturnType<typeof requireStudentContext>>>,
  lessonId: string,
  enrollmentId: string
): Promise<ProgressContext | { error: string }> {
  if (!lessonId || !enrollmentId) {
    return { error: "Missing lesson." };
  }

  const { data: enrollment } = await ctx.supabase
    .from("enrollments")
    .select("enrollment_id, course_id, status")
    .eq("enrollment_id", enrollmentId)
    .eq("student_id", ctx.studentId)
    .maybeSingle<{ enrollment_id: string; course_id: string; status: string }>();

  if (!enrollment) {
    return { error: "Enrollment not found." };
  }
  if (enrollment.status !== "active") {
    return { error: "This course is not active for you." };
  }

  const { data: lesson } = await ctx.supabase
    .from("lessons")
    .select("lesson_id, module_id")
    .eq("lesson_id", lessonId)
    .maybeSingle<{ lesson_id: string; module_id: string }>();

  if (!lesson) {
    return { error: "Lesson is not available." };
  }

  const { data: module } = await ctx.supabase
    .from("course_modules")
    .select("course_id")
    .eq("module_id", lesson.module_id)
    .maybeSingle<{ course_id: string }>();

  if (!module || module.course_id !== enrollment.course_id) {
    return { error: "Lesson is not available." };
  }

  return {
    enrollment_id: enrollment.enrollment_id,
    course_id: enrollment.course_id,
  };
}

type ExistingRow = {
  lesson_id: string;
  status: string;
  started_at: string | null;
};

async function getExistingProgress(
  ctx: NonNullable<Awaited<ReturnType<typeof requireStudentContext>>>,
  enrollmentId: string,
  lessonId: string
): Promise<ExistingRow | null> {
  const { data } = await ctx.supabase
    .from("lesson_progress")
    .select("lesson_id, status, started_at")
    .eq("enrollment_id", enrollmentId)
    .eq("lesson_id", lessonId)
    .maybeSingle<ExistingRow>();

  return data ?? null;
}

export async function startLesson(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStudentContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const lessonId = cleanField(formData.get("lessonId"));
  const enrollmentId = cleanField(formData.get("enrollmentId"));

  const resolved = await resolveProgressContext(ctx, lessonId, enrollmentId);
  if ("error" in resolved) {
    return { ok: false, error: resolved.error };
  }

  const existing = await getExistingProgress(
    ctx,
    resolved.enrollment_id,
    lessonId
  );

  if (existing) {
    if (existing.status === "completed") {
      return { ok: true, error: null };
    }
    const { error } = await ctx.supabase
      .from("lesson_progress")
      .update({
        status: "in_progress",
        started_at: existing.started_at ?? new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      })
      .eq("enrollment_id", resolved.enrollment_id)
      .eq("lesson_id", lessonId);

    if (error) {
      console.error("startLesson: update failed", lessonId, error.message);
      return { ok: false, error: "Unable to update lesson progress." };
    }
    return { ok: true, error: null };
  }

  const { error } = await ctx.supabase.from("lesson_progress").insert({
    enrollment_id: resolved.enrollment_id,
    lesson_id: lessonId,
    status: "in_progress",
    started_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString(),
  });

  if (error && error.code !== "23505") {
    console.error("startLesson: insert failed", lessonId, error.message);
    return { ok: false, error: "Unable to update lesson progress." };
  }

  if (error?.code === "23505") {
    const raced = await getExistingProgress(
      ctx,
      resolved.enrollment_id,
      lessonId
    );
    if (raced && raced.status !== "completed") {
      await ctx.supabase
        .from("lesson_progress")
        .update({
          status: "in_progress",
          started_at: raced.started_at ?? new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
        })
        .eq("enrollment_id", resolved.enrollment_id)
        .eq("lesson_id", lessonId);
    }
  }

  return { ok: true, error: null };
}

export async function completeLesson(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStudentContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const lessonId = cleanField(formData.get("lessonId"));
  const enrollmentId = cleanField(formData.get("enrollmentId"));

  const resolved = await resolveProgressContext(ctx, lessonId, enrollmentId);
  if ("error" in resolved) {
    return { ok: false, error: resolved.error };
  }

  const existing = await getExistingProgress(
    ctx,
    resolved.enrollment_id,
    lessonId
  );

  const now = new Date().toISOString();

  if (existing) {
    if (existing.status === "completed") {
      return { ok: true, error: null };
    }
    const { error } = await ctx.supabase
      .from("lesson_progress")
      .update({
        status: "completed",
        started_at: existing.started_at ?? now,
        completed_at: now,
        last_accessed_at: now,
      })
      .eq("enrollment_id", resolved.enrollment_id)
      .eq("lesson_id", lessonId);

    if (error) {
      console.error("completeLesson: update failed", lessonId, error.message);
      return { ok: false, error: "Unable to update lesson progress." };
    }
    return { ok: true, error: null };
  }

  const { error } = await ctx.supabase.from("lesson_progress").insert({
    enrollment_id: resolved.enrollment_id,
    lesson_id: lessonId,
    status: "completed",
    started_at: now,
    completed_at: now,
    last_accessed_at: now,
  });

  if (error && error.code !== "23505") {
    console.error("completeLesson: insert failed", lessonId, error.message);
    return { ok: false, error: "Unable to update lesson progress." };
  }

  if (error?.code === "23505") {
    const raced = await getExistingProgress(
      ctx,
      resolved.enrollment_id,
      lessonId
    );
    if (raced && raced.status !== "completed") {
      await ctx.supabase
        .from("lesson_progress")
        .update({
          status: "completed",
          started_at: raced.started_at ?? now,
          completed_at: now,
          last_accessed_at: now,
        })
        .eq("enrollment_id", resolved.enrollment_id)
        .eq("lesson_id", lessonId);
    }
  }

  return { ok: true, error: null };
}