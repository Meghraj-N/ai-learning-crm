"use server";

import {
  requireCourseWriteContext,
  requireStudentContext,
} from "@/lib/crm";
import { isCorrectAnswer as gradeAnswer } from "@/lib/quizzes";
import { isQuizQuestionType as isQuestionTypeValue } from "@/types/crm";
import type { QuizQuestionType } from "@/types/crm";

export type ActionState = {
  ok: boolean;
  error: string | null;
};

export type RedirectActionState = ActionState & {
  redirect?: string;
  attemptId?: string;
};

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;
const QUESTION_MAX = 2000;
const OPTION_MAX = 200;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const POINTS_MAX = 1000;
const MAX_SCORE_SNAPSHOT = 30000;
const POSITION_SENTINEL = 1000000;

function cleanField(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function parseJsonArray(
  raw: FormDataEntryValue | null,
  label: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  const value = String(raw ?? "");
  if (!value) {
    return { ok: false, error: `${label} is required.` };
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: `${label} must be a list.` };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: `${label} is invalid.` };
  }
}

async function requireQuiz(
  ctx: NonNullable<Awaited<ReturnType<typeof requireCourseWriteContext>>>,
  quizId: string
): Promise<
  { quiz_id: string; course_id: string; is_published: boolean } | { error: string }
> {
  if (!quizId) {
    return { error: "Missing quiz." };
  }

  const { data: quiz, error } = await ctx.supabase
    .from("quizzes")
    .select("quiz_id, course_id, is_published")
    .eq("quiz_id", quizId)
    .maybeSingle<{ quiz_id: string; course_id: string; is_published: boolean }>();

  if (error || !quiz) {
    console.error("Quiz action: quiz not found", quizId, error?.message);
    return { error: "Quiz not found." };
  }

  return quiz;
}

async function requireQuestion(
  ctx: NonNullable<Awaited<ReturnType<typeof requireCourseWriteContext>>>,
  questionId: string
): Promise<{ question_id: string; quiz_id: string; position: number } | { error: string }> {
  if (!questionId) {
    return { error: "Missing question." };
  }

  const { data: question, error } = await ctx.supabase
    .from("quiz_questions")
    .select("question_id, quiz_id, position")
    .eq("question_id", questionId)
    .maybeSingle<{ question_id: string; quiz_id: string; position: number }>();

  if (error || !question) {
    console.error(
      "Quiz action: question not found",
      questionId,
      error?.message
    );
    return { error: "Question not found." };
  }

  return question;
}

export async function createQuiz(
  _prevState: RedirectActionState,
  formData: FormData
): Promise<RedirectActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const courseId = cleanField(formData.get("courseId"));
  const title = cleanField(formData.get("title"));
  const description = cleanField(formData.get("description"));
  const thresholdRaw = cleanField(formData.get("pass_threshold"));
  const isPublished = formData.get("is_published") === "on";

  if (!courseId) {
    return { ok: false, error: "Missing course." };
  }
  if (!title) {
    return { ok: false, error: "Quiz title is required." };
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

  const threshold = Number(thresholdRaw);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
    return { ok: false, error: "Pass threshold must be between 0 and 100." };
  }

  const { data: course } = await ctx.supabase
    .from("courses")
    .select("course_id")
    .eq("course_id", courseId)
    .maybeSingle<{ course_id: string }>();

  if (!course) {
    return { ok: false, error: "Course not found." };
  }

  const { data, error } = await ctx.supabase
    .from("quizzes")
    .insert({
      organization_id: ctx.organizationId,
      course_id: courseId,
      title,
      description: description || null,
      pass_threshold: threshold,
      is_published: isPublished,
      created_by: ctx.userId,
    })
    .select("quiz_id")
    .single<{ quiz_id: string }>();

  if (error) {
    console.error("createQuiz: insert failed", error.message);
    return { ok: false, error: "Unable to create the quiz." };
  }

  return {
    ok: true,
    error: null,
    redirect: `/dashboard/courses/${courseId}/quizzes/${data.quiz_id}`,
  };
}

export async function updateQuiz(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const quizId = cleanField(formData.get("quizId"));
  const title = cleanField(formData.get("title"));
  const description = cleanField(formData.get("description"));
  const thresholdRaw = cleanField(formData.get("pass_threshold"));
  const isPublished = formData.get("is_published") === "on";

  if (!title) {
    return { ok: false, error: "Quiz title is required." };
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

  const threshold = Number(thresholdRaw);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
    return { ok: false, error: "Pass threshold must be between 0 and 100." };
  }

  const quiz = await requireQuiz(ctx, quizId);
  if ("error" in quiz) {
    return { ok: false, error: quiz.error };
  }

  const { error } = await ctx.supabase
    .from("quizzes")
    .update({
      title,
      description: description || null,
      pass_threshold: threshold,
      is_published: isPublished,
    })
    .eq("quiz_id", quizId);

  if (error) {
    console.error("updateQuiz: update failed", quizId, error.message);
    return { ok: false, error: "Unable to update the quiz." };
  }

  return { ok: true, error: null };
}

type QuestionPayload = {
  question: string;
  question_type: QuizQuestionType;
  options: string[];
  correct_answer: number[];
  points: number;
};

function validateQuestionPayload(formData: FormData):
  | { ok: true; payload: QuestionPayload }
  | { ok: false; error: string } {
  const question = cleanField(formData.get("question"));
  const questionType = cleanField(formData.get("question_type"));
  const pointsRaw = cleanField(formData.get("points"));

  if (!question) {
    return { ok: false, error: "Question text is required." };
  }
  if (question.length > QUESTION_MAX) {
    return {
      ok: false,
      error: `Question must be at most ${QUESTION_MAX} characters.`,
    };
  }
  if (!isQuestionTypeValue(questionType)) {
    return { ok: false, error: "Invalid question type." };
  }

  const points = Number(pointsRaw);
  if (!Number.isInteger(points) || points < 0 || points > POINTS_MAX) {
    return {
      ok: false,
      error: `Points must be between 0 and ${POINTS_MAX}.`,
    };
  }

  const optionsResult = parseJsonArray(formData.get("options"), "Options");
  if (!optionsResult.ok) {
    return optionsResult;
  }
  const rawOptions = optionsResult.value;
  if (
    !Array.isArray(rawOptions) ||
    !rawOptions.every((option) => typeof option === "string")
  ) {
    return { ok: false, error: "Each option must be text." };
  }
  const options = rawOptions as string[];
  const trimmedOptions = options.map((option) => option.trim());
  if (
    trimmedOptions.length < MIN_OPTIONS ||
    trimmedOptions.length > MAX_OPTIONS
  ) {
    return {
      ok: false,
      error: `A question needs ${MIN_OPTIONS} to ${MAX_OPTIONS} options.`,
    };
  }
  if (trimmedOptions.some((option) => !option)) {
    return { ok: false, error: "Options cannot be empty." };
  }
  if (trimmedOptions.some((option) => option.length > OPTION_MAX)) {
    return {
      ok: false,
      error: `Each option must be at most ${OPTION_MAX} characters.`,
    };
  }

  const correctResult = parseJsonArray(
    formData.get("correct_answer"),
    "Correct answer"
  );
  if (!correctResult.ok) {
    return correctResult;
  }
  const rawCorrect = correctResult.value;
  if (
    !Array.isArray(rawCorrect) ||
    !rawCorrect.every(
      (index) => typeof index === "number" && Number.isInteger(index)
    )
  ) {
    return { ok: false, error: "Correct answer is out of range." };
  }
  const correct = rawCorrect as number[];
  if (
    correct.some(
      (index) => index < 0 || index >= trimmedOptions.length
    )
  ) {
    return { ok: false, error: "Correct answer is out of range." };
  }
  if (correct.length === 0) {
    return { ok: false, error: "Select at least one correct option." };
  }
  if (correct.length > 1) {
    return {
      ok: false,
      error:
        "This release supports a single correct option per question.",
    };
  }

  return {
    ok: true,
    payload: {
      question,
      question_type: questionType as QuizQuestionType,
      options: trimmedOptions,
      correct_answer: [...correct],
      points,
    },
  };
}

async function nextQuestionPosition(
  supabase: NonNullable<Awaited<ReturnType<typeof requireCourseWriteContext>>>["supabase"],
  quizId: string
): Promise<number> {
  const { data: maxRow } = await supabase
    .from("quiz_questions")
    .select("position")
    .eq("quiz_id", quizId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();

  return (maxRow?.position ?? 0) + 1;
}

export async function createQuestion(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const quizId = cleanField(formData.get("quizId"));
  if (!quizId) {
    return { ok: false, error: "Missing quiz." };
  }

  const quiz = await requireQuiz(ctx, quizId);
  if ("error" in quiz) {
    return { ok: false, error: quiz.error };
  }

  const validation = validateQuestionPayload(formData);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const position = await nextQuestionPosition(ctx.supabase, quizId);

  const { error } = await ctx.supabase.from("quiz_questions").insert({
    organization_id: ctx.organizationId,
    quiz_id: quizId,
    position,
    question_type: validation.payload.question_type,
    question: validation.payload.question,
    options: validation.payload.options,
    correct_answer: validation.payload.correct_answer,
    points: validation.payload.points,
  });

  if (error) {
    console.error("createQuestion: insert failed", error.message);
    return { ok: false, error: "Unable to create the question." };
  }

  return { ok: true, error: null };
}

export async function updateQuestion(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const questionId = cleanField(formData.get("questionId"));
  const question = await requireQuestion(ctx, questionId);
  if ("error" in question) {
    return { ok: false, error: question.error };
  }

  const validation = validateQuestionPayload(formData);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const { error } = await ctx.supabase
    .from("quiz_questions")
    .update({
      question_type: validation.payload.question_type,
      question: validation.payload.question,
      options: validation.payload.options,
      correct_answer: validation.payload.correct_answer,
      points: validation.payload.points,
    })
    .eq("question_id", questionId);

  if (error) {
    console.error("updateQuestion: update failed", questionId, error.message);
    return { ok: false, error: "Unable to update the question." };
  }

  return { ok: true, error: null };
}

export async function moveQuestion(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireCourseWriteContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const questionId = cleanField(formData.get("questionId"));
  const direction = cleanField(formData.get("direction"));
  if (direction !== "up" && direction !== "down") {
    return { ok: false, error: "Invalid direction." };
  }

  const question = await requireQuestion(ctx, questionId);
  if ("error" in question) {
    return { ok: false, error: question.error };
  }

  const targetPosition =
    direction === "up" ? question.position - 1 : question.position + 1;
  if (targetPosition < 0) {
    return { ok: true, error: null };
  }

  const { data: neighbor } = await ctx.supabase
    .from("quiz_questions")
    .select("question_id")
    .eq("quiz_id", question.quiz_id)
    .eq("position", targetPosition)
    .maybeSingle<{ question_id: string }>();

  if (!neighbor) {
    return { ok: true, error: null };
  }

  const { error: sentinelError } = await ctx.supabase
    .from("quiz_questions")
    .update({ position: POSITION_SENTINEL })
    .eq("question_id", question.question_id)
    .eq("quiz_id", question.quiz_id);

  if (sentinelError) {
    console.error(
      "moveQuestion: sentinel update failed",
      questionId,
      sentinelError.message
    );
    return { ok: false, error: "Unable to reorder questions." };
  }

  const { error: neighborError } = await ctx.supabase
    .from("quiz_questions")
    .update({ position: question.position })
    .eq("question_id", neighbor.question_id)
    .eq("quiz_id", question.quiz_id);

  if (neighborError) {
    console.error(
      "moveQuestion: neighbor update failed",
      questionId,
      neighborError.message
    );
    return { ok: false, error: "Unable to reorder questions." };
  }

  const { error: targetError } = await ctx.supabase
    .from("quiz_questions")
    .update({ position: targetPosition })
    .eq("question_id", question.question_id)
    .eq("quiz_id", question.quiz_id);

  if (targetError) {
    console.error(
      "moveQuestion: target update failed",
      questionId,
      targetError.message
    );
    return { ok: false, error: "Unable to reorder questions." };
  }

  return { ok: true, error: null };
}

export async function startAttempt(
  _prevState: RedirectActionState,
  formData: FormData
): Promise<RedirectActionState> {
  const ctx = await requireStudentContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const quizId = cleanField(formData.get("quizId"));
  if (!quizId) {
    return { ok: false, error: "Missing quiz." };
  }

  const { data: quiz } = await ctx.supabase
    .from("quizzes")
    .select("quiz_id, course_id")
    .eq("quiz_id", quizId)
    .maybeSingle<{ quiz_id: string; course_id: string }>();

  if (!quiz) {
    return { ok: false, error: "Quiz not found or not available to you." };
  }

  const { data: existing } = await ctx.supabase
    .from("quiz_attempts")
    .select("attempt_id")
    .eq("quiz_id", quizId)
    .eq("student_id", ctx.studentId)
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ attempt_id: string }>();

  if (existing) {
    return {
      ok: true,
      error: null,
      attemptId: existing.attempt_id,
      redirect: `/dashboard/courses/${quiz.course_id}/quizzes/${quizId}/attempt`,
    };
  }

  const { data, error } = await ctx.supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      student_id: ctx.studentId,
    })
    .select("attempt_id")
    .single<{ attempt_id: string }>();

  if (error) {
    console.error("startAttempt: insert failed", error.message);
    return { ok: false, error: "Unable to start the attempt." };
  }

  return {
    ok: true,
    error: null,
    attemptId: data.attempt_id,
    redirect: `/dashboard/courses/${quiz.course_id}/quizzes/${quizId}/attempt`,
  };
}

type AnswerPayload = {
  question_id: string;
  selected: number[];
};

function isValidAnswerEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const record = entry as Record<string, unknown>;
  if (typeof record.question_id !== "string") {
    return false;
  }
  const selected = record.selected;
  if (!Array.isArray(selected)) {
    return false;
  }
  return selected.every(
    (value) => typeof value === "number" && Number.isInteger(value)
  );
}

export async function submitAttempt(
  _prevState: RedirectActionState,
  formData: FormData
): Promise<RedirectActionState> {
  const ctx = await requireStudentContext();
  if (!ctx) {
    return { ok: false, error: "Not authorized." };
  }

  const attemptId = cleanField(formData.get("attemptId"));
  if (!attemptId) {
    return { ok: false, error: "Missing attempt." };
  }

  const answersResult = parseJsonArray(formData.get("answers"), "Answers");
  if (!answersResult.ok) {
    return answersResult;
  }
  const rawAnswers = answersResult.value;
  if (
    !Array.isArray(rawAnswers) ||
    !rawAnswers.every(isValidAnswerEntry)
  ) {
    return { ok: false, error: "Answers are invalid." };
  }

  const { data: attempt } = await ctx.supabase
    .from("quiz_attempts")
    .select("attempt_id, quiz_id, submitted_at")
    .eq("attempt_id", attemptId)
    .eq("student_id", ctx.studentId)
    .maybeSingle<{ attempt_id: string; quiz_id: string; submitted_at: string | null }>();

  if (!attempt) {
    return { ok: false, error: "Attempt not found." };
  }
  if (attempt.submitted_at !== null) {
    return { ok: false, error: "This attempt was already submitted." };
  }

  const { data: quiz } = await ctx.supabase
    .from("quizzes")
    .select("quiz_id, course_id")
    .eq("quiz_id", attempt.quiz_id)
    .maybeSingle<{ quiz_id: string; course_id: string }>();

  if (!quiz) {
    return { ok: false, error: "Quiz not found or not available to you." };
  }

  const { data: questions } = await ctx.supabase
    .from("quiz_questions")
    .select(
      "question_id, position, question_type, options, correct_answer, points"
    )
    .eq("quiz_id", attempt.quiz_id)
    .order("position", { ascending: true })
    .returns<
      {
        question_id: string;
        position: number;
        question_type: QuizQuestionType;
        options: string[];
        correct_answer: number[];
        points: number;
      }[]
    >();

  const questionRows = questions ?? [];
  if (questionRows.length === 0) {
    return { ok: false, error: "This quiz has no questions." };
  }

  let score = 0;
  let maxScore = 0;
  const answers = questionRows.map((question) => {
    const submitted = (rawAnswers as AnswerPayload[]).find(
      (entry) => entry.question_id === question.question_id
    );
    const selected = (submitted?.selected ?? [])
      .filter(
        (index) => Number.isInteger(index) && index >= 0 && index < question.options.length
      )
      .slice(0, question.options.length);

    const isCorrect = gradeAnswer(selected, question.correct_answer);
    const pointsEarned = isCorrect ? question.points : 0;
    score += pointsEarned;
    maxScore += question.points;

    return {
      attempt_id: attemptId,
      question_id: question.question_id,
      selected_answer: selected,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    };
  });

  if (maxScore > MAX_SCORE_SNAPSHOT) {
    return {
      ok: false,
      error: "This quiz is too large to score. Reduce question points.",
    };
  }

  const { error: answersError } = await ctx.supabase
    .from("quiz_attempt_answers")
    .insert(answers);

  if (answersError && answersError.code !== "23505") {
    console.error("submitAttempt: answers insert failed", answersError.message);
    return { ok: false, error: "Unable to submit your answers." };
  }

  const { error: updateError } = await ctx.supabase
    .from("quiz_attempts")
    .update({
      submitted_at: new Date().toISOString(),
      score,
      max_score: maxScore,
    })
    .eq("attempt_id", attemptId)
    .eq("student_id", ctx.studentId);

  if (updateError) {
    console.error("submitAttempt: update failed", attemptId, updateError.message);
    return { ok: false, error: "Unable to submit the attempt." };
  }

  return {
    ok: true,
    error: null,
    attemptId,
    redirect: `/dashboard/courses/${quiz.course_id}/quizzes/${attempt.quiz_id}/attempts/${attemptId}`,
  };
}
