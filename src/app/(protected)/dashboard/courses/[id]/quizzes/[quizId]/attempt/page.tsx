import Link from "next/link";
import { requireStudentContext } from "@/lib/crm";
import { getQuizQuestions, toAnswerableQuestions } from "@/lib/quizzes";
import AccessDenied from "../../../../../access-denied";
import { AttemptForm } from "../../attempt-form";

export default async function QuizAttemptPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string }>;
}) {
  const ctx = await requireStudentContext();
  if (!ctx) {
    return <AccessDenied />;
  }

  const { id, quizId } = await params;

  const { data: quiz } = await ctx.supabase
    .from("quizzes")
    .select("quiz_id, course_id, title, pass_threshold")
    .eq("quiz_id", quizId)
    .maybeSingle<{
      quiz_id: string;
      course_id: string;
      title: string;
      pass_threshold: number;
    }>();

  if (!quiz || quiz.course_id !== id) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Quiz not found
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            This quiz is not available to you.
          </p>
          <Link
            href={`/dashboard/courses/${id}`}
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to course
          </Link>
        </div>
      </div>
    );
  }

  const { data: course } = await ctx.supabase
    .from("courses")
    .select("course_id, title")
    .eq("course_id", quiz.course_id)
    .maybeSingle<{ course_id: string; title: string }>();

  const { data: attempt } = await ctx.supabase
    .from("quiz_attempts")
    .select("attempt_id")
    .eq("quiz_id", quizId)
    .eq("student_id", ctx.studentId)
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ attempt_id: string }>();

  if (!attempt) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            No attempt in progress
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Start an attempt from the quiz page before answering.
          </p>
          <Link
            href={`/dashboard/courses/${quiz.course_id}/quizzes/${quiz.quiz_id}`}
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to quiz
          </Link>
        </div>
      </div>
    );
  }

  const questions = await getQuizQuestions(ctx.supabase, quizId);
  if (questions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            This quiz has no questions yet
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Check back later or contact your organization.
          </p>
          <Link
            href={`/dashboard/courses/${quiz.course_id}/quizzes/${quiz.quiz_id}`}
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to quiz
          </Link>
        </div>
      </div>
    );
  }

  const answerable = toAnswerableQuestions(questions);

  return (
    <div className="flex flex-1 justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <nav className="text-sm text-zinc-500">
          <Link href="/dashboard/courses" className="hover:text-zinc-900">
            Courses
          </Link>
          <span className="mx-1">/</span>
          <Link
            href={`/dashboard/courses/${quiz.course_id}`}
            className="hover:text-zinc-900"
          >
            {course?.title ?? "Course"}
          </Link>
          <span className="mx-1">/</span>
          <Link
            href={`/dashboard/courses/${quiz.course_id}/quizzes/${quiz.quiz_id}`}
            className="hover:text-zinc-900"
          >
            {quiz.title}
          </Link>
          <span className="mx-1">/</span>
          <span className="text-zinc-900">Attempt</span>
        </nav>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
          {quiz.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pass threshold: {quiz.pass_threshold}%. Answer all{" "}
          {questions.length} questions and submit when done.
        </p>

        <AttemptForm
          attemptId={attempt.attempt_id}
          questions={answerable}
        />
      </div>
    </div>
  );
}