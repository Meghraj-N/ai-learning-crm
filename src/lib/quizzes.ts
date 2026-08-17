import type { QuizQuestionType } from "@/types/crm";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type QuizQuestionRow = {
  question_id: string;
  organization_id: string;
  quiz_id: string;
  position: number;
  question_type: QuizQuestionType;
  question: string;
  options: string[];
  correct_answer: number[];
  points: number;
  created_at: string;
  updated_at: string;
};

export type QuizQuestionNode = {
  question_id: string;
  position: number;
  question_type: QuizQuestionType;
  question: string;
  options: string[];
  correct_answer: number[];
  points: number;
};

export async function getQuizQuestions(
  supabase: ServerClient,
  quizId: string
): Promise<QuizQuestionNode[]> {
  const { data } = await supabase
    .from("quiz_questions")
    .select(
      "question_id, position, question_type, question, options, correct_answer, points"
    )
    .eq("quiz_id", quizId)
    .order("position", { ascending: true })
    .returns<QuizQuestionRow[]>();

  const rows = data ?? [];
  return rows.map((row) => ({
    question_id: row.question_id,
    position: row.position,
    question_type: row.question_type,
    question: row.question,
    options: row.options,
    correct_answer: row.correct_answer,
    points: row.points,
  }));
}

export type AnswerableQuestion = {
  question_id: string;
  position: number;
  question_type: QuizQuestionType;
  question: string;
  options: string[];
  points: number;
};

export function toAnswerableQuestions(
  questions: QuizQuestionNode[]
): AnswerableQuestion[] {
  return questions.map((question) => ({
    question_id: question.question_id,
    position: question.position,
    question_type: question.question_type,
    question: question.question,
    options: question.options,
    points: question.points,
  }));
}

export function isCorrectAnswer(
  selected: number[],
  correct: number[]
): boolean {
  if (!Array.isArray(selected) || !Array.isArray(correct)) {
    return false;
  }
  if (selected.length !== correct.length) {
    return false;
  }
  const left = [...selected].sort((a, b) => a - b);
  const right = [...correct].sort((a, b) => a - b);
  return left.every((value, index) => value === right[index]);
}
