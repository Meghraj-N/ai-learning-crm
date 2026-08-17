"use server";

import {
  requireCourseWriteContext,
  requireEnrollmentWriteContext,
} from "@/lib/crm";
import {
  canTransitionEnrollment,
  isCourseStatus,
  isEnrollmentStatus,
  type CourseStatus,
  type EnrollmentStatus,
} from "@/types/crm";

export type ActionState = {
  ok: boolean;
  error: string | null;
};

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;
const LESSON_CONTENT_MAX = 50000;
const POSITION_SENTINEL = 1000000;

function cleanField(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

async function requireCourseForEdit(
  ctx: NonNullable<Awaited<ReturnType<typeof requireCourseWriteContext>>>,
  courseId: string
): Promise<{ course_id: string } | { error: string }> {
  if (!courseId) {
    return { error: "Missing course." };
  }

  const { data: course, error } = await ctx.supabase
    .from("courses")
    .select("course_id")
    .eq("course_id", courseId)
    .maybeSingle<{ course_id: string }>();

  if (error || !course) {
    console.error("Course action: course not found", courseId, error?.message);
    return { error: "Course not found." };
  }

  return course;
}

export async function createCourse(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState & { courseId?: string }> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const title = cleanField(formData.get("title"));
  const description = cleanField(formData.get("description"));
  const status = cleanField(formData.get("status"));

  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  if (title.length > TITLE_MAX) {
    return {
      ok: false,
      error: `Title must be at most ${TITLE_MAX} characters.`,
    };
  }
  if (description.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Description must be at most ${DESCRIPTION_MAX} characters.`,
    };
  }
  if (!isCourseStatus(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const { data, error } = await ctx.supabase
    .from("courses")
    .insert({
      organization_id: ctx.organizationId,
      title,
      description: description || null,
      status: status as CourseStatus,
      created_by: ctx.userId,
    })
    .select("course_id")
    .single<{ course_id: string }>();

  if (error) {
    console.error("createCourse: insert failed", error.message);
    return { ok: false, error: "Could not create the course. Please try again." };
  }

  return { ok: true, error: null, courseId: data.course_id };
}

export async function updateCourse(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const courseId = cleanField(formData.get("courseId"));
  const title = cleanField(formData.get("title"));
  const description = cleanField(formData.get("description"));
  const status = cleanField(formData.get("status"));

  if (!title) {
    return { ok: false, error: "Title is required." };
  }
  if (title.length > TITLE_MAX) {
    return {
      ok: false,
      error: `Title must be at most ${TITLE_MAX} characters.`,
    };
  }
  if (description.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Description must be at most ${DESCRIPTION_MAX} characters.`,
    };
  }
  if (!isCourseStatus(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const course = await requireCourseForEdit(ctx, courseId);
  if ("error" in course) {
    return { ok: false, error: course.error };
  }

  const { error } = await ctx.supabase
    .from("courses")
    .update({
      title,
      description: description || null,
      status: status as CourseStatus,
    })
    .eq("course_id", courseId);

  if (error) {
    console.error("updateCourse: update failed", courseId, error.message);
    return { ok: false, error: "Could not update the course. Please try again." };
  }

  return { ok: true, error: null };
}

export type EnrollmentActionState = ActionState & {
  alreadyEnrolled?: boolean;
};

export async function createEnrollment(
  _prevState: EnrollmentActionState,
  formData: FormData
): Promise<EnrollmentActionState> {
  const ctx = await requireEnrollmentWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const courseId = cleanField(formData.get("courseId"));
  const studentId = cleanField(formData.get("studentId"));

  if (!courseId || !studentId) {
    return { ok: false, error: "Course and student are required." };
  }

  const { data: course, error: courseError } = await ctx.supabase
    .from("courses")
    .select("course_id, status")
    .eq("course_id", courseId)
    .maybeSingle<{ course_id: string; status: string }>();

  if (courseError || !course) {
    console.error("createEnrollment: course not found", courseId, courseError?.message);
    return { ok: false, error: "Course not found." };
  }
  if (course.status === "archived") {
    return {
      ok: false,
      error: "This course is archived and cannot be enrolled.",
    };
  }

  const { data: student, error: studentError } = await ctx.supabase
    .from("students")
    .select("student_id")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .maybeSingle<{ student_id: string }>();

  if (studentError || !student) {
    console.error("createEnrollment: student not found", studentId, studentError?.message);
    return { ok: false, error: "Student not found." };
  }

  const { data: existing, error: existingError } = await ctx.supabase
    .from("enrollments")
    .select("enrollment_id")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .in("status", ["active", "paused"] as string[])
    .maybeSingle<{ enrollment_id: string }>();

  if (existingError) {
    console.error("createEnrollment: existing check failed", existingError.message);
    return { ok: false, error: "Could not enroll the student. Please try again." };
  }
  if (existing) {
    return {
      ok: true,
      error: null,
      alreadyEnrolled: true,
    };
  }

  const { error: insertError } = await ctx.supabase
    .from("enrollments")
    .insert({
      organization_id: ctx.organizationId,
      student_id: studentId,
      course_id: courseId,
      status: "active",
      enrolled_by: ctx.userId,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        ok: true,
        error: null,
        alreadyEnrolled: true,
      };
    }
    console.error("createEnrollment: insert failed", insertError.message);
    return { ok: false, error: "Could not enroll the student. Please try again." };
  }

  return { ok: true, error: null };
}

export async function updateEnrollmentStatus(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireEnrollmentWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const enrollmentId = cleanField(formData.get("enrollmentId"));
  const status = cleanField(formData.get("status"));

  if (!enrollmentId) {
    return { ok: false, error: "Missing enrollment." };
  }
  if (!isEnrollmentStatus(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const { data: enrollment, error: fetchError } = await ctx.supabase
    .from("enrollments")
    .select("enrollment_id, status")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle<{ enrollment_id: string; status: string }>();

  if (fetchError || !enrollment) {
    console.error(
      "updateEnrollmentStatus: enrollment not found",
      enrollmentId,
      fetchError?.message
    );
    return { ok: false, error: "Enrollment not found." };
  }

  const from = enrollment.status as EnrollmentStatus;
  const to = status as EnrollmentStatus;
  if (from === to) {
    return { ok: true, error: null };
  }
  if (!canTransitionEnrollment(from, to)) {
    return {
      ok: false,
      error: "This enrollment status change is not allowed.",
    };
  }

  const isTerminal = to === "completed" || to === "cancelled";
  const { error } = await ctx.supabase
    .from("enrollments")
    .update({
      status: to,
      ended_at: isTerminal ? new Date().toISOString() : null,
    })
    .eq("enrollment_id", enrollmentId);

  if (error) {
    console.error(
      "updateEnrollmentStatus: update failed",
      enrollmentId,
      error.message
    );
    return { ok: false, error: "Could not update the enrollment. Please try again." };
  }

  return { ok: true, error: null };
}

async function requireModule(
  ctx: NonNullable<Awaited<ReturnType<typeof requireCourseWriteContext>>>,
  moduleId: string
): Promise<{ module_id: string; course_id: string; position: number } | { error: string }> {
  if (!moduleId) {
    return { error: "Missing module." };
  }

  const { data: mod, error } = await ctx.supabase
    .from("course_modules")
    .select("module_id, course_id, position")
    .eq("module_id", moduleId)
    .maybeSingle<{ module_id: string; course_id: string; position: number }>();

  if (error || !mod) {
    console.error("Course action: module not found", moduleId, error?.message);
    return { error: "Module not found." };
  }

  return mod;
}

async function requireLesson(
  ctx: NonNullable<Awaited<ReturnType<typeof requireCourseWriteContext>>>,
  lessonId: string
): Promise<{ lesson_id: string; module_id: string; position: number } | { error: string }> {
  if (!lessonId) {
    return { error: "Missing lesson." };
  }

  const { data: lesson, error } = await ctx.supabase
    .from("lessons")
    .select("lesson_id, module_id, position")
    .eq("lesson_id", lessonId)
    .maybeSingle<{ lesson_id: string; module_id: string; position: number }>();

  if (error || !lesson) {
    console.error("Course action: lesson not found", lessonId, error?.message);
    return { error: "Lesson not found." };
  }

  return lesson;
}

async function requireModuleInCourse(
  ctx: NonNullable<Awaited<ReturnType<typeof requireCourseWriteContext>>>,
  moduleId: string,
  courseId: string
): Promise<{ module_id: string; course_id: string } | { error: string }> {
  if (!moduleId || !courseId) {
    return { error: "Missing module." };
  }

  const { data: mod, error } = await ctx.supabase
    .from("course_modules")
    .select("module_id, course_id")
    .eq("module_id", moduleId)
    .maybeSingle<{ module_id: string; course_id: string }>();

  if (error || !mod) {
    console.error(
      "Course action: module not found",
      moduleId,
      error?.message
    );
    return { error: "Module not found." };
  }
  if (mod.course_id !== courseId) {
    return { error: "Module not found." };
  }

  return mod;
}

async function nextPosition(
  supabase: NonNullable<Awaited<ReturnType<typeof requireCourseWriteContext>>>["supabase"],
  table: "course_modules" | "lessons",
  column: string,
  value: string
): Promise<number> {
  const { data: maxRow } = await supabase
    .from(table)
    .select("position")
    .eq(column, value)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();

  return (maxRow?.position ?? 0) + 1;
}

export async function createModule(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const courseId = cleanField(formData.get("courseId"));
  const title = cleanField(formData.get("title"));

  if (!courseId) {
    return { ok: false, error: "Missing course." };
  }
  if (!title) {
    return { ok: false, error: "Module title is required." };
  }
  if (title.length > TITLE_MAX) {
    return {
      ok: false,
      error: `Title must be at most ${TITLE_MAX} characters.`,
    };
  }

  const { data: course } = await ctx.supabase
    .from("courses")
    .select("course_id")
    .eq("course_id", courseId)
    .maybeSingle<{ course_id: string }>();

  if (!course) {
    return { ok: false, error: "Course not found." };
  }

  const position = await nextPosition(ctx.supabase, "course_modules", "course_id", courseId);

  const { error } = await ctx.supabase.from("course_modules").insert({
    organization_id: ctx.organizationId,
    course_id: courseId,
    title,
    position,
  });

  if (error) {
    console.error("createModule: insert failed", error.message);
    return { ok: false, error: "Unable to create module." };
  }

  return { ok: true, error: null };
}

export async function updateModule(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const moduleId = cleanField(formData.get("moduleId"));
  const title = cleanField(formData.get("title"));

  if (!title) {
    return { ok: false, error: "Module title is required." };
  }
  if (title.length > TITLE_MAX) {
    return {
      ok: false,
      error: `Title must be at most ${TITLE_MAX} characters.`,
    };
  }

  const mod = await requireModule(ctx, moduleId);
  if ("error" in mod) {
    return { ok: false, error: mod.error };
  }

  const { error } = await ctx.supabase
    .from("course_modules")
    .update({ title })
    .eq("module_id", moduleId);

  if (error) {
    console.error("updateModule: update failed", moduleId, error.message);
    return { ok: false, error: "Unable to update module." };
  }

  return { ok: true, error: null };
}

export async function moveModule(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const moduleId = cleanField(formData.get("moduleId"));
  const direction = cleanField(formData.get("direction"));
  if (direction !== "up" && direction !== "down") {
    return { ok: false, error: "Invalid direction." };
  }

  const mod = await requireModule(ctx, moduleId);
  if ("error" in mod) {
    return { ok: false, error: mod.error };
  }

  const targetPosition = direction === "up" ? mod.position - 1 : mod.position + 1;
  if (targetPosition < 0) {
    return { ok: true, error: null };
  }

  const { data: neighbor } = await ctx.supabase
    .from("course_modules")
    .select("module_id")
    .eq("course_id", mod.course_id)
    .eq("position", targetPosition)
    .maybeSingle<{ module_id: string }>();

  if (!neighbor) {
    return { ok: true, error: null };
  }

  const { error: sentinelError } = await ctx.supabase
    .from("course_modules")
    .update({ position: POSITION_SENTINEL })
    .eq("module_id", mod.module_id)
    .eq("course_id", mod.course_id);

  if (sentinelError) {
    console.error("moveModule: sentinel update failed", moduleId, sentinelError.message);
    return { ok: false, error: "Unable to reorder modules." };
  }

  const { error: neighborError } = await ctx.supabase
    .from("course_modules")
    .update({ position: mod.position })
    .eq("module_id", neighbor.module_id)
    .eq("course_id", mod.course_id);

  if (neighborError) {
    console.error("moveModule: neighbor update failed", moduleId, neighborError.message);
    return { ok: false, error: "Unable to reorder modules." };
  }

  const { error: targetError } = await ctx.supabase
    .from("course_modules")
    .update({ position: targetPosition })
    .eq("module_id", mod.module_id)
    .eq("course_id", mod.course_id);

  if (targetError) {
    console.error("moveModule: target update failed", moduleId, targetError.message);
    return { ok: false, error: "Unable to reorder modules." };
  }

  return { ok: true, error: null };
}

export async function createLesson(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const courseId = cleanField(formData.get("courseId"));
  const moduleId = cleanField(formData.get("moduleId"));
  const title = cleanField(formData.get("title"));
  const content = String(formData.get("content") ?? "");

  if (!courseId || !moduleId) {
    return { ok: false, error: "Missing module." };
  }
  if (!title) {
    return { ok: false, error: "Lesson title is required." };
  }
  if (title.length > TITLE_MAX) {
    return {
      ok: false,
      error: `Title must be at most ${TITLE_MAX} characters.`,
    };
  }
  if (content.length > LESSON_CONTENT_MAX) {
    return {
      ok: false,
      error: `Content must be at most ${LESSON_CONTENT_MAX} characters.`,
    };
  }

  const mod = await requireModuleInCourse(ctx, moduleId, courseId);
  if ("error" in mod) {
    return { ok: false, error: mod.error };
  }

  const position = await nextPosition(ctx.supabase, "lessons", "module_id", moduleId);

  const { error } = await ctx.supabase.from("lessons").insert({
    organization_id: ctx.organizationId,
    module_id: moduleId,
    title,
    content,
    position,
    is_published: false,
  });

  if (error) {
    console.error("createLesson: insert failed", error.message);
    return { ok: false, error: "Unable to create lesson." };
  }

  return { ok: true, error: null };
}

export async function updateLesson(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const lessonId = cleanField(formData.get("lessonId"));
  const title = cleanField(formData.get("title"));
  const content = String(formData.get("content") ?? "");
  const publishedValue = formData.get("is_published");
  const isPublished = publishedValue === "on";

  if (!title) {
    return { ok: false, error: "Lesson title is required." };
  }
  if (title.length > TITLE_MAX) {
    return {
      ok: false,
      error: `Title must be at most ${TITLE_MAX} characters.`,
    };
  }
  if (content.length > LESSON_CONTENT_MAX) {
    return {
      ok: false,
      error: `Content must be at most ${LESSON_CONTENT_MAX} characters.`,
    };
  }

  const lesson = await requireLesson(ctx, lessonId);
  if ("error" in lesson) {
    return { ok: false, error: lesson.error };
  }

  const { error } = await ctx.supabase
    .from("lessons")
    .update({ title, content, is_published: isPublished })
    .eq("lesson_id", lessonId);

  if (error) {
    console.error("updateLesson: update failed", lessonId, error.message);
    return { ok: false, error: "Unable to update lesson." };
  }

  return { ok: true, error: null };
}

export async function toggleLessonPublished(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const lessonId = cleanField(formData.get("lessonId"));
  if (!lessonId) {
    return { ok: false, error: "Missing lesson." };
  }

  const { data: lesson, error: fetchError } = await ctx.supabase
    .from("lessons")
    .select("lesson_id, is_published")
    .eq("lesson_id", lessonId)
    .maybeSingle<{ lesson_id: string; is_published: boolean }>();

  if (fetchError || !lesson) {
    console.error(
      "toggleLessonPublished: lesson not found",
      lessonId,
      fetchError?.message
    );
    return { ok: false, error: "Lesson not found." };
  }

  const { error } = await ctx.supabase
    .from("lessons")
    .update({ is_published: !lesson.is_published })
    .eq("lesson_id", lessonId);

  if (error) {
    console.error("toggleLessonPublished: update failed", lessonId, error.message);
    return { ok: false, error: "Unable to update lesson." };
  }

  return { ok: true, error: null };
}

export async function moveLesson(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const lessonId = cleanField(formData.get("lessonId"));
  const direction = cleanField(formData.get("direction"));
  if (direction !== "up" && direction !== "down") {
    return { ok: false, error: "Invalid direction." };
  }

  const lesson = await requireLesson(ctx, lessonId);
  if ("error" in lesson) {
    return { ok: false, error: lesson.error };
  }

  const targetPosition = direction === "up" ? lesson.position - 1 : lesson.position + 1;
  if (targetPosition < 0) {
    return { ok: true, error: null };
  }

  const { data: neighbor } = await ctx.supabase
    .from("lessons")
    .select("lesson_id")
    .eq("module_id", lesson.module_id)
    .eq("position", targetPosition)
    .maybeSingle<{ lesson_id: string }>();

  if (!neighbor) {
    return { ok: true, error: null };
  }

  const { error: sentinelError } = await ctx.supabase
    .from("lessons")
    .update({ position: POSITION_SENTINEL })
    .eq("lesson_id", lesson.lesson_id)
    .eq("module_id", lesson.module_id);

  if (sentinelError) {
    console.error("moveLesson: sentinel update failed", lessonId, sentinelError.message);
    return { ok: false, error: "Unable to reorder lessons." };
  }

  const { error: neighborError } = await ctx.supabase
    .from("lessons")
    .update({ position: lesson.position })
    .eq("lesson_id", neighbor.lesson_id)
    .eq("module_id", lesson.module_id);

  if (neighborError) {
    console.error("moveLesson: neighbor update failed", lessonId, neighborError.message);
    return { ok: false, error: "Unable to reorder lessons." };
  }

  const { error: targetError } = await ctx.supabase
    .from("lessons")
    .update({ position: targetPosition })
    .eq("lesson_id", lesson.lesson_id)
    .eq("module_id", lesson.module_id);

  if (targetError) {
    console.error("moveLesson: target update failed", lessonId, targetError.message);
    return { ok: false, error: "Unable to reorder lessons." };
  }

  return { ok: true, error: null };
}
