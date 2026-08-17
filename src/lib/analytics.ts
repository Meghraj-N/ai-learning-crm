import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CourseModuleNode } from "@/lib/courses";
import type {
  CourseStatus,
  EnrollmentStatus,
  LessonProgressStatus,
} from "@/types/crm";
import { getCourseContents } from "@/lib/courses";
import { getLessonProgressRows, type LessonProgressDetailRow } from "@/lib/progress";
import type { QuizQuestionNode } from "@/lib/quizzes";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// ----------------------------------------------------------------------------
// Shared analytics record shapes
// ----------------------------------------------------------------------------

export type CompletionFilter =
  | "not_started"
  | "in_progress"
  | "nearly_complete"
  | "complete";

export type AnalyticsQuiz = {
  quiz_id: string;
  course_id: string;
  title: string;
  pass_threshold: number;
  is_published: boolean;
  course_title?: string;
};

export type AnalyticsAttempt = {
  attempt_id: string;
  quiz_id: string;
  student_id?: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
};

export type QuizAttemptSummary = {
  attempts: number;
  submitted: number;
  passed: number;
  failed: number;
  passRate: number | null;
  averagePercent: number | null;
  highestPercent: number | null;
  lowestPercent: number | null;
};

export type CourseQuizPerformance = {
  attempts: number;
  submitted: number;
  passed: number;
  passRate: number | null;
  averagePercent: number | null;
};

// ----------------------------------------------------------------------------
// Pure helpers (shared across pages; same pass rule as Phase 11 grading)
// ----------------------------------------------------------------------------

export function quizPercentage(
  score: number | null,
  maxScore: number | null
): number | null {
  if (score === null || maxScore === null || maxScore <= 0) {
    return null;
  }
  return Math.round((score / maxScore) * 100);
}

export function isPassingScore(
  score: number | null,
  maxScore: number | null,
  passThreshold: number
): boolean {
  const percent = quizPercentage(score, maxScore);
  return percent !== null && percent >= passThreshold;
}

export function summarizeAttempts(
  attempts: { submitted_at: string | null; score: number | null; max_score: number | null }[],
  passThreshold: number
): QuizAttemptSummary {
  const submitted = attempts.filter(
    (attempt) =>
      attempt.submitted_at !== null &&
      attempt.score !== null &&
      attempt.max_score !== null
  );
  const percents = submitted.map(
    (attempt) => quizPercentage(attempt.score, attempt.max_score) as number
  );
  const passed = submitted.filter((attempt) =>
    isPassingScore(attempt.score, attempt.max_score, passThreshold)
  ).length;
  return {
    attempts: attempts.length,
    submitted: submitted.length,
    passed,
    failed: submitted.length - passed,
    passRate:
      submitted.length > 0
        ? Math.round((passed / submitted.length) * 100)
        : null,
    averagePercent:
      percents.length > 0
        ? Math.round(
            percents.reduce((sum, percent) => sum + percent, 0) /
              percents.length
          )
        : null,
    highestPercent: percents.length > 0 ? Math.max(...percents) : null,
    lowestPercent: percents.length > 0 ? Math.min(...percents) : null,
  };
}

export function summarizeCourseQuizPerformance(
  attempts: AnalyticsAttempt[],
  quizzes: AnalyticsQuiz[]
): CourseQuizPerformance {
  const thresholdByQuiz = new Map(
    quizzes.map((quiz) => [quiz.quiz_id, quiz.pass_threshold])
  );
  const submitted = attempts.filter(
    (attempt) =>
      attempt.submitted_at !== null &&
      attempt.score !== null &&
      attempt.max_score !== null
  );
  const percents = submitted.map(
    (attempt) => quizPercentage(attempt.score, attempt.max_score) as number
  );
  const passed = submitted.filter((attempt) => {
    const threshold = thresholdByQuiz.get(attempt.quiz_id);
    if (threshold === undefined) {
      return false;
    }
    return isPassingScore(attempt.score, attempt.max_score, threshold);
  }).length;
  return {
    attempts: attempts.length,
    submitted: submitted.length,
    passed,
    passRate:
      submitted.length > 0
        ? Math.round((passed / submitted.length) * 100)
        : null,
    averagePercent:
      percents.length > 0
        ? Math.round(
            percents.reduce((sum, percent) => sum + percent, 0) /
              percents.length
          )
        : null,
  };
}

export function publishedLessonStats(
  content: CourseModuleNode[],
  progressMap: Map<string, LessonProgressStatus>
): {
  publishedLessons: number;
  completedPublished: number;
  percent: number;
  isComplete: boolean;
} {
  const published = content
    .flatMap((module) => module.lessons)
    .filter((lesson) => lesson.is_published);
  const completed = published.filter(
    (lesson) => progressMap.get(lesson.lesson_id) === "completed"
  ).length;
  const total = published.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return {
    publishedLessons: total,
    completedPublished: completed,
    percent,
    isComplete: total > 0 && completed >= total,
  };
}

// ----------------------------------------------------------------------------
// Student learning data (dashboard + staff student detail share this loader)
// ----------------------------------------------------------------------------

export type StudentEnrollment = {
  enrollment_id: string;
  course_id: string;
  course_title: string;
  course_status: CourseStatus | null;
  enrollment_status: EnrollmentStatus;
  created_at: string;
  ended_at: string | null;
};

export type StudentCourseLearning = {
  enrollment_id: string;
  course_id: string;
  course_title: string;
  course_status: CourseStatus | null;
  enrollment_status: EnrollmentStatus;
  enrolled_at: string;
  ended_at: string | null;
  completedLessons: number;
  totalPublishedLessons: number;
  remainingLessons: number;
  percent: number;
  isComplete: boolean;
  quizAttempts: number;
  quizSubmitted: number;
  quizzesPassed: number;
  quizPassRate: number | null;
  averageQuizScorePercent: number | null;
  lastActivityAt: string | null;
};

export type StudentQuizAttempt = {
  attempt_id: string;
  quiz_id: string;
  course_id: string;
  course_title: string;
  quiz_title: string;
  pass_threshold: number;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
};

export type StudentLearningAnalytics = {
  totalEnrolledCourses: number;
  activeCourses: number;
  completedCourses: number;
  overallCompletionPercent: number;
  publishedLessonsCompleted: number;
  publishedLessonsRemaining: number;
  quizzesAttempted: number;
  quizzesSubmitted: number;
  quizzesPassed: number;
  quizPassRate: number | null;
  averageQuizScorePercent: number | null;
};

export type StudentLearningData = {
  enrollments: StudentEnrollment[];
  contents: Map<string, CourseModuleNode[]>;
  progressRows: LessonProgressDetailRow[];
  progressMaps: Map<string, Map<string, LessonProgressStatus>>;
  quizzes: AnalyticsQuiz[];
  attempts: StudentQuizAttempt[];
  courses: StudentCourseLearning[];
  analytics: StudentLearningAnalytics;
};

type StudentEnrollmentQueryRow = {
  enrollment_id: string;
  course_id: string;
  status: EnrollmentStatus;
  created_at: string;
  ended_at: string | null;
  courses: { course_id: string; title: string; status: CourseStatus } | null;
};

type StudentAttemptQueryRow = {
  attempt_id: string;
  quiz_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
};

export function emptyStudentLearningAnalytics(): StudentLearningAnalytics {
  return {
    totalEnrolledCourses: 0,
    activeCourses: 0,
    completedCourses: 0,
    overallCompletionPercent: 0,
    publishedLessonsCompleted: 0,
    publishedLessonsRemaining: 0,
    quizzesAttempted: 0,
    quizzesSubmitted: 0,
    quizzesPassed: 0,
    quizPassRate: null,
    averageQuizScorePercent: null,
  };
}

export async function loadStudentLearningData(
  supabase: ServerClient,
  studentId: string
): Promise<StudentLearningData> {
  const base: StudentLearningData = {
    enrollments: [],
    contents: new Map(),
    progressRows: [],
    progressMaps: new Map(),
    quizzes: [],
    attempts: [],
    courses: [],
    analytics: emptyStudentLearningAnalytics(),
  };

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      "enrollment_id, course_id, status, created_at, ended_at, courses(course_id, title, status)"
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .returns<StudentEnrollmentQueryRow[]>();

  const enrollmentRows = enrollments ?? [];
  if (enrollmentRows.length === 0) {
    return base;
  }

  const courseIds = [
    ...new Set(enrollmentRows.map((enrollment) => enrollment.course_id)),
  ];
  const enrollmentIds = enrollmentRows.map(
    (enrollment) => enrollment.enrollment_id
  );

  const [contents, progressRows, quizzesRes] = await Promise.all([
    getCourseContents(supabase, courseIds),
    getLessonProgressRows(supabase, enrollmentIds),
    supabase
      .from("quizzes")
      .select(
        "quiz_id, course_id, title, pass_threshold, is_published, courses(title)"
      )
      .eq("is_published", true)
      .in("course_id", courseIds)
      .returns<
        (AnalyticsQuiz & { courses: { title: string } | null })[]
      >(),
  ]);

  const quizzes: AnalyticsQuiz[] = (quizzesRes.data ?? []).map((row) => ({
    quiz_id: row.quiz_id,
    course_id: row.course_id,
    title: row.title,
    pass_threshold: row.pass_threshold,
    is_published: row.is_published,
    course_title: row.courses?.title ?? "Course",
  }));
  const quizById = new Map(quizzes.map((quiz) => [quiz.quiz_id, quiz]));

  const attempts: StudentQuizAttempt[] = [];
  const { data: attemptRows } = await supabase
    .from("quiz_attempts")
    .select("attempt_id, quiz_id, started_at, submitted_at, score, max_score")
    .eq("student_id", studentId)
    .order("started_at", { ascending: false })
    .returns<StudentAttemptQueryRow[]>();

  for (const row of attemptRows ?? []) {
    const quiz = quizById.get(row.quiz_id);
    if (!quiz) {
      continue;
    }
    attempts.push({
      attempt_id: row.attempt_id,
      quiz_id: row.quiz_id,
      course_id: quiz.course_id,
      course_title: quiz.course_title ?? "Course",
      quiz_title: quiz.title,
      pass_threshold: quiz.pass_threshold,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      score: row.score,
      max_score: row.max_score,
    });
  }

  const progressMaps = new Map<string, Map<string, LessonProgressStatus>>();
  for (const row of progressRows) {
    let map = progressMaps.get(row.enrollment_id);
    if (!map) {
      map = new Map();
      progressMaps.set(row.enrollment_id, map);
    }
    map.set(row.lesson_id, row.status);
  }

  const enrollmentsOut: StudentEnrollment[] = [];
  const courses: StudentCourseLearning[] = [];
  let totalCompletedPublished = 0;
  let totalPublished = 0;
  let totalAttempts = 0;
  let totalSubmitted = 0;
  let totalPassed = 0;

  for (const enrollment of enrollmentRows) {
    const course = enrollment.courses;
    const courseTitle = course?.title ?? "Course";
    const content = contents.get(enrollment.course_id) ?? [];
    const progressMap =
      progressMaps.get(enrollment.enrollment_id) ??
      new Map<string, LessonProgressStatus>();
    const stats = publishedLessonStats(content, progressMap);
    const isComplete =
      enrollment.status === "active" &&
      course?.status === "published" &&
      stats.publishedLessons > 0 &&
      stats.completedPublished >= stats.publishedLessons;

    const courseQuizzes = quizzes.filter(
      (quiz) => quiz.course_id === enrollment.course_id
    );
    const courseAttempts = attempts.filter(
      (attempt) => attempt.course_id === enrollment.course_id
    );
    const quizPerf = summarizeCourseQuizPerformance(courseAttempts, courseQuizzes);

    let lastActivityAt: string | null = enrollment.created_at;
    const consider = (timestamp: string | null) => {
      if (timestamp !== null && (lastActivityAt === null || timestamp > lastActivityAt)) {
        lastActivityAt = timestamp;
      }
    };
    for (const row of progressRows) {
      if (row.enrollment_id === enrollment.enrollment_id) {
        consider(row.started_at);
        consider(row.last_accessed_at);
        consider(row.completed_at);
      }
    }
    for (const attempt of courseAttempts) {
      consider(attempt.started_at);
      consider(attempt.submitted_at);
    }

    totalCompletedPublished += stats.completedPublished;
    totalPublished += stats.publishedLessons;
    totalAttempts += quizPerf.attempts;
    totalSubmitted += quizPerf.submitted;
    totalPassed += quizPerf.passed;

    enrollmentsOut.push({
      enrollment_id: enrollment.enrollment_id,
      course_id: enrollment.course_id,
      course_title: courseTitle,
      course_status: course?.status ?? null,
      enrollment_status: enrollment.status,
      created_at: enrollment.created_at,
      ended_at: enrollment.ended_at,
    });
    courses.push({
      enrollment_id: enrollment.enrollment_id,
      course_id: enrollment.course_id,
      course_title: courseTitle,
      course_status: course?.status ?? null,
      enrollment_status: enrollment.status,
      enrolled_at: enrollment.created_at,
      ended_at: enrollment.ended_at,
      completedLessons: stats.completedPublished,
      totalPublishedLessons: stats.publishedLessons,
      remainingLessons: Math.max(0, stats.publishedLessons - stats.completedPublished),
      percent: stats.percent,
      isComplete,
      quizAttempts: quizPerf.attempts,
      quizSubmitted: quizPerf.submitted,
      quizzesPassed: quizPerf.passed,
      quizPassRate: quizPerf.passRate,
      averageQuizScorePercent: quizPerf.averagePercent,
      lastActivityAt,
    });
  }

  const analytics: StudentLearningAnalytics = {
    totalEnrolledCourses: enrollmentsOut.length,
    activeCourses: enrollmentsOut.filter(
      (enrollment) => enrollment.enrollment_status === "active"
    ).length,
    completedCourses: enrollmentsOut.filter(
      (enrollment) =>
        enrollment.enrollment_status === "completed" ||
        courses.some(
          (course) =>
            course.enrollment_id === enrollment.enrollment_id &&
            course.isComplete
        )
    ).length,
    overallCompletionPercent:
      totalPublished > 0 ? Math.round((totalCompletedPublished / totalPublished) * 100) : 0,
    publishedLessonsCompleted: totalCompletedPublished,
    publishedLessonsRemaining: Math.max(0, totalPublished - totalCompletedPublished),
    quizzesAttempted: totalAttempts,
    quizzesSubmitted: totalSubmitted,
    quizzesPassed: totalPassed,
    quizPassRate:
      totalSubmitted > 0 ? Math.round((totalPassed / totalSubmitted) * 100) : null,
    averageQuizScorePercent: null,
  };

  const submittedPercent = attempts
    .filter((attempt) => attempt.submitted_at !== null && attempt.score !== null)
    .map((attempt) => quizPercentage(attempt.score, attempt.max_score))
    .filter((percent): percent is number => percent !== null);
  analytics.averageQuizScorePercent =
    submittedPercent.length > 0
      ? Math.round(
          submittedPercent.reduce((sum, percent) => sum + percent, 0) /
            submittedPercent.length
        )
      : null;

  return {
    enrollments: enrollmentsOut,
    contents,
    progressRows,
    progressMaps,
    quizzes,
    attempts,
    courses,
    analytics,
  };
}

// ----------------------------------------------------------------------------
// Course analytics (staff, course detail page)
// ----------------------------------------------------------------------------

export type CourseEnrollmentRow = {
  enrollment_id: string;
  student_id: string;
  status: EnrollmentStatus;
  created_at: string;
  ended_at: string | null;
  students: { first_name: string; last_name: string } | null;
};

export type CourseEnrollmentAnalyticsRow = {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  enrollment_status: EnrollmentStatus;
  enrolled_at: string;
  ended_at: string | null;
  completedLessons: number;
  totalPublishedLessons: number;
  remainingLessons: number;
  completionPercent: number;
  isComplete: boolean;
  quizAttempts: number;
  quizSubmitted: number;
  quizzesPassed: number;
  quizPassRate: number | null;
  averageQuizScorePercent: number | null;
};

export function computeCourseEnrollmentAnalytics(
  enrollments: CourseEnrollmentRow[],
  progressRows: LessonProgressDetailRow[],
  publishedLessonIds: Set<string>,
  attempts: AnalyticsAttempt[],
  quizzes: AnalyticsQuiz[]
): CourseEnrollmentAnalyticsRow[] {
  const attemptsByStudent = new Map<string, AnalyticsAttempt[]>();
  for (const attempt of attempts) {
    if (attempt.student_id === undefined) {
      continue;
    }
    const list = attemptsByStudent.get(attempt.student_id) ?? [];
    list.push(attempt);
    attemptsByStudent.set(attempt.student_id, list);
  }

  const progressByEnrollment = new Map<string, LessonProgressDetailRow[]>();
  for (const row of progressRows) {
    const list = progressByEnrollment.get(row.enrollment_id) ?? [];
    list.push(row);
    progressByEnrollment.set(row.enrollment_id, list);
  }

  return enrollments.map((enrollment) => {
    const rows = progressByEnrollment.get(enrollment.enrollment_id) ?? [];
    const completedLessons = rows.filter(
      (row) => row.status === "completed" && publishedLessonIds.has(row.lesson_id)
    ).length;
    const total = publishedLessonIds.size;
    const completionPercent = total > 0 ? Math.round((completedLessons / total) * 100) : 0;
    const isComplete =
      enrollment.status === "active" && total > 0 && completedLessons >= total;
    const studentAttempts = attemptsByStudent.get(enrollment.student_id) ?? [];
    const quizPerf = summarizeCourseQuizPerformance(studentAttempts, quizzes);
    return {
      enrollment_id: enrollment.enrollment_id,
      student_id: enrollment.student_id,
      student_name: enrollment.students
        ? `${enrollment.students.first_name} ${enrollment.students.last_name}`
        : "Unknown student",
      enrollment_status: enrollment.status,
      enrolled_at: enrollment.created_at,
      ended_at: enrollment.ended_at,
      completedLessons,
      totalPublishedLessons: total,
      remainingLessons: Math.max(0, total - completedLessons),
      completionPercent,
      isComplete,
      quizAttempts: quizPerf.attempts,
      quizSubmitted: quizPerf.submitted,
      quizzesPassed: quizPerf.passed,
      quizPassRate: quizPerf.passRate,
      averageQuizScorePercent: quizPerf.averagePercent,
    };
  });
}

export type CourseAnalytics = {
  totalEnrollments: number;
  activeEnrollments: number;
  pausedEnrollments: number;
  completedEnrollments: number;
  cancelledEnrollments: number;
  averageCompletionPercent: number | null;
  studentsAt0: number;
  students1To49: number;
  students50To99: number;
  studentsAt100: number;
  totalPublishedLessons: number;
  totalPublishedQuizzes: number;
  quizAttempts: number;
  quizSubmitted: number;
  quizzesPassed: number;
  quizPassRate: number | null;
  averageQuizScorePercent: number | null;
};

export function computeCourseAnalytics(
  rows: CourseEnrollmentAnalyticsRow[],
  totalPublishedLessons: number,
  totalPublishedQuizzes: number,
  quizPerformance: CourseQuizPerformance
): CourseAnalytics {
  const countable = rows.filter((row) => row.totalPublishedLessons > 0);
  const averageCompletionPercent =
    countable.length > 0
      ? Math.round(
          countable.reduce((sum, row) => sum + row.completionPercent, 0) /
            countable.length
        )
      : null;
  return {
    totalEnrollments: rows.length,
    activeEnrollments: rows.filter(
      (row) => row.enrollment_status === "active"
    ).length,
    pausedEnrollments: rows.filter(
      (row) => row.enrollment_status === "paused"
    ).length,
    completedEnrollments: rows.filter(
      (row) => row.enrollment_status === "completed"
    ).length,
    cancelledEnrollments: rows.filter(
      (row) => row.enrollment_status === "cancelled"
    ).length,
    averageCompletionPercent,
    studentsAt0: countable.filter((row) => row.completionPercent === 0).length,
    students1To49: countable.filter(
      (row) => row.completionPercent >= 1 && row.completionPercent <= 49
    ).length,
    students50To99: countable.filter(
      (row) => row.completionPercent >= 50 && row.completionPercent <= 99
    ).length,
    studentsAt100: countable.filter((row) => row.completionPercent === 100).length,
    totalPublishedLessons,
    totalPublishedQuizzes,
    quizAttempts: quizPerformance.attempts,
    quizSubmitted: quizPerformance.submitted,
    quizzesPassed: quizPerformance.passed,
    quizPassRate: quizPerformance.passRate,
    averageQuizScorePercent: quizPerformance.averagePercent,
  };
}

// ----------------------------------------------------------------------------
// Learning insights (deterministic, data-only)
// ----------------------------------------------------------------------------

export type LearningInsights = {
  studentsAtZero: number;
  studentsBelowHalf: number;
  incompleteActiveEnrollments: number;
  repeatedlyFailingStudents: number;
  lowQuizPerformanceStudents: number;
  lessonsInProgressEnrollments: number;
};

export function computeLearningInsights(
  rows: CourseEnrollmentAnalyticsRow[],
  progressRows: LessonProgressDetailRow[],
  publishedLessonCount: number
): LearningInsights {
  const lessonsInProgressEnrollments = new Set<string>();
  for (const row of progressRows) {
    if (row.status === "in_progress") {
      lessonsInProgressEnrollments.add(row.enrollment_id);
    }
  }

  const repeatedFailures = new Set<string>();
  const lowPerformance = new Set<string>();
  const byStudent = new Map<string, CourseEnrollmentAnalyticsRow[]>();
  for (const row of rows) {
    const list = byStudent.get(row.student_id) ?? [];
    list.push(row);
    byStudent.set(row.student_id, list);
  }
  for (const studentRows of byStudent.values()) {
    const submitted = studentRows.reduce(
      (sum, row) => sum + row.quizSubmitted,
      0
    );
    const passed = studentRows.reduce((sum, row) => sum + row.quizzesPassed, 0);
    if (submitted >= 2 && passed === 0) {
      repeatedFailures.add(studentRows[0].student_id);
    }
    const averages = studentRows
      .map((row) => row.averageQuizScorePercent)
      .filter((percent): percent is number => percent !== null);
    if (averages.length > 0) {
      const mean =
        averages.reduce((sum, percent) => sum + percent, 0) / averages.length;
      if (mean < 50) {
        lowPerformance.add(studentRows[0].student_id);
      }
    }
  }

  const countable = rows.filter((row) => row.totalPublishedLessons > 0);
  return {
    studentsAtZero: countable.filter((row) => row.completionPercent === 0).length,
    studentsBelowHalf: countable.filter(
      (row) => row.completionPercent > 0 && row.completionPercent < 50
    ).length,
    incompleteActiveEnrollments: countable.filter(
      (row) => row.enrollment_status === "active" && !row.isComplete
    ).length,
    repeatedlyFailingStudents: repeatedFailures.size,
    lowQuizPerformanceStudents: lowPerformance.size,
    lessonsInProgressEnrollments: publishedLessonCount > 0 ? lessonsInProgressEnrollments.size : 0,
  };
}

// ----------------------------------------------------------------------------
// Quiz question performance (staff, quiz detail page)
// ----------------------------------------------------------------------------

export type QuizQuestionPerformance = {
  question_id: string;
  position: number;
  question: string;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number | null;
};

export function computeQuizQuestionPerformance(
  questions: QuizQuestionNode[],
  answers: { question_id: string; is_correct: boolean }[]
): QuizQuestionPerformance[] {
  const byQuestion = new Map<string, { attempts: number; correct: number }>();
  for (const answer of answers) {
    const aggregate = byQuestion.get(answer.question_id) ?? { attempts: 0, correct: 0 };
    aggregate.attempts += 1;
    if (answer.is_correct) {
      aggregate.correct += 1;
    }
    byQuestion.set(answer.question_id, aggregate);
  }
  return questions.map((question) => {
    const aggregate = byQuestion.get(question.question_id) ?? { attempts: 0, correct: 0 };
    return {
      question_id: question.question_id,
      position: question.position,
      question: question.question,
      attempts: aggregate.attempts,
      correct: aggregate.correct,
      incorrect: aggregate.attempts - aggregate.correct,
      accuracyPercent:
        aggregate.attempts > 0
          ? Math.round((aggregate.correct / aggregate.attempts) * 100)
          : null,
    };
  });
}

// ----------------------------------------------------------------------------
// Learning timeline (student detail page, staff)
// ----------------------------------------------------------------------------

export type LearningTimelineEvent = {
  kind:
    | "enrollment_created"
    | "lesson_started"
    | "lesson_completed"
    | "quiz_started"
    | "quiz_submitted"
    | "course_completed";
  occurredAt: string;
  courseId: string;
  courseTitle: string;
  label: string;
  detail?: string;
};

export function buildLearningTimeline(
  enrollments: {
    enrollment_id: string;
    course_id: string;
    course_title: string;
    created_at: string;
    courseCompletedAt: string | null;
  }[],
  lessonEvents: {
    enrollment_id: string;
    course_id: string;
    course_title: string;
    lesson_title: string;
    started_at: string | null;
    completed_at: string | null;
  }[],
  quizEvents: {
    course_id: string;
    course_title: string;
    quiz_title: string;
    started_at: string;
    submitted_at: string | null;
    submittedPercent: number | null;
    passed: boolean;
  }[]
): LearningTimelineEvent[] {
  const events: LearningTimelineEvent[] = [];

  for (const enrollment of enrollments) {
    events.push({
      kind: "enrollment_created",
      occurredAt: enrollment.created_at,
      courseId: enrollment.course_id,
      courseTitle: enrollment.course_title,
      label: `Enrolled in ${enrollment.course_title}`,
    });
    if (enrollment.courseCompletedAt !== null) {
      events.push({
        kind: "course_completed",
        occurredAt: enrollment.courseCompletedAt,
        courseId: enrollment.course_id,
        courseTitle: enrollment.course_title,
        label: `Completed ${enrollment.course_title}`,
      });
    }
  }

  for (const event of lessonEvents) {
    if (event.started_at !== null) {
      events.push({
        kind: "lesson_started",
        occurredAt: event.started_at,
        courseId: event.course_id,
        courseTitle: event.course_title,
        label: `Started lesson: ${event.lesson_title}`,
        detail: event.course_title,
      });
    }
    if (event.completed_at !== null) {
      events.push({
        kind: "lesson_completed",
        occurredAt: event.completed_at,
        courseId: event.course_id,
        courseTitle: event.course_title,
        label: `Completed lesson: ${event.lesson_title}`,
        detail: event.course_title,
      });
    }
  }

  for (const event of quizEvents) {
    events.push({
      kind: "quiz_started",
      occurredAt: event.started_at,
      courseId: event.course_id,
      courseTitle: event.course_title,
      label: `Started quiz: ${event.quiz_title}`,
      detail: event.course_title,
    });
    if (event.submitted_at !== null) {
      events.push({
        kind: "quiz_submitted",
        occurredAt: event.submitted_at,
        courseId: event.course_id,
        courseTitle: event.course_title,
        label: `Submitted quiz: ${event.quiz_title}`,
        detail:
          event.submittedPercent !== null
            ? `${event.submittedPercent}% — ${event.passed ? "passed" : "not passed"}`
            : undefined,
      });
    }
  }

  return events.sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0
  );
}
