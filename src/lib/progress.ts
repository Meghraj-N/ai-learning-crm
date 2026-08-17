import type { LessonProgressStatus } from "@/types/crm";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CourseModuleNode } from "@/lib/courses";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ProgressRow = {
  enrollment_id: string;
  lesson_id: string;
  status: LessonProgressStatus;
};

export type LessonProgressDetailRow = {
  enrollment_id: string;
  lesson_id: string;
  status: LessonProgressStatus;
  started_at: string | null;
  last_accessed_at: string | null;
  completed_at: string | null;
};

export async function getLessonProgressMap(
  supabase: ServerClient,
  enrollmentId: string
): Promise<Map<string, LessonProgressStatus>> {
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, status")
    .eq("enrollment_id", enrollmentId)
    .returns<{ lesson_id: string; status: LessonProgressStatus }[]>();

  return new Map((data ?? []).map((row) => [row.lesson_id, row.status]));
}

export async function getLessonProgressMaps(
  supabase: ServerClient,
  enrollmentIds: string[]
): Promise<Map<string, Map<string, LessonProgressStatus>>> {
  const maps = new Map<string, Map<string, LessonProgressStatus>>();
  if (enrollmentIds.length === 0) {
    return maps;
  }

  const { data } = await supabase
    .from("lesson_progress")
    .select("enrollment_id, lesson_id, status")
    .in("enrollment_id", enrollmentIds)
    .returns<ProgressRow[]>();

  for (const row of data ?? []) {
    let map = maps.get(row.enrollment_id);
    if (!map) {
      map = new Map();
      maps.set(row.enrollment_id, map);
    }
    map.set(row.lesson_id, row.status);
  }

  return maps;
}

export async function getLessonProgressRows(
  supabase: ServerClient,
  enrollmentIds: string[]
): Promise<LessonProgressDetailRow[]> {
  if (enrollmentIds.length === 0) {
    return [];
  }

  const { data } = await supabase
    .from("lesson_progress")
    .select(
      "enrollment_id, lesson_id, status, started_at, last_accessed_at, completed_at"
    )
    .in("enrollment_id", enrollmentIds)
    .returns<LessonProgressDetailRow[]>();

  return data ?? [];
}

export async function getCompletedCountsByEnrollment(
  supabase: ServerClient,
  enrollmentIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (enrollmentIds.length === 0) {
    return counts;
  }

  const { data } = await supabase
    .from("lesson_progress")
    .select("enrollment_id")
    .eq("status", "completed")
    .in("enrollment_id", enrollmentIds);

  for (const row of (data ?? []) as ProgressRow[]) {
    counts.set(
      row.enrollment_id,
      (counts.get(row.enrollment_id) ?? 0) + 1
    );
  }

  return counts;
}

export function deriveProgress(
  completed: number,
  total: number
): { completed: number; total: number; percent: number; isComplete: boolean } {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isComplete = total > 0 && completed >= total;
  return { completed, total, percent, isComplete };
}

export type NextActionQuiz = {
  quiz_id: string;
  title: string;
  pass_threshold: number;
  attempts: {
    submitted_at: string | null;
    score: number | null;
    max_score: number | null;
  }[];
};

export type NextLearningAction =
  | {
      kind: "lesson";
      lessonId: string;
      lessonTitle: string;
      moduleTitle: string;
      status: "not_started" | "in_progress";
    }
  | { kind: "quiz"; quizId: string; quizTitle: string }
  | { kind: "completed" };

export function hasPassedQuiz(quiz: NextActionQuiz): boolean {
  return quiz.attempts.some((attempt) => {
    if (
      attempt.submitted_at === null ||
      attempt.score === null ||
      attempt.max_score === null ||
      attempt.max_score === 0
    ) {
      return false;
    }
    return (
      Math.round((attempt.score / attempt.max_score) * 100) >=
      quiz.pass_threshold
    );
  });
}

export function deriveNextAction(
  content: CourseModuleNode[],
  progressMap: Map<string, LessonProgressStatus>,
  quizzes: NextActionQuiz[]
): NextLearningAction | null {
  const flat = content.flatMap((module) =>
    module.lessons.map((lesson) => ({
      lessonId: lesson.lesson_id,
      lessonTitle: lesson.title,
      moduleTitle: module.title,
    }))
  );

  const firstIncomplete = flat.find(
    (lesson) => progressMap.get(lesson.lessonId) !== "completed"
  );
  if (firstIncomplete) {
    const status =
      progressMap.get(firstIncomplete.lessonId) === "in_progress"
        ? "in_progress"
        : "not_started";
    return { ...firstIncomplete, kind: "lesson", status };
  }

  const pendingQuiz = quizzes.find((quiz) => !hasPassedQuiz(quiz));
  if (pendingQuiz) {
    return {
      kind: "quiz",
      quizId: pendingQuiz.quiz_id,
      quizTitle: pendingQuiz.title,
    };
  }

  return { kind: "completed" };
}