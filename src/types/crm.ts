export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "note",
  "whatsapp",
  "status_change",
  "assignment",
  "converted",
] as const;

export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];

export const FOLLOWUP_STATUSES = [
  "pending",
  "completed",
  "cancelled",
] as const;

export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const FOLLOWUP_PRIORITIES = ["low", "medium", "high"] as const;

export type FollowupPriority = (typeof FOLLOWUP_PRIORITIES)[number];

export type Lead = {
  lead_id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  score: number;
  assigned_to: string | null;
  student_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LeadActivity = {
  activity_id: string;
  organization_id: string;
  lead_id: string;
  performed_by: string | null;
  activity_type: LeadActivityType;
  occurred_at: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type Followup = {
  followup_id: string;
  organization_id: string;
  lead_id: string;
  assigned_to: string | null;
  title: string;
  notes: string | null;
  due_at: string;
  priority: FollowupPriority;
  status: FollowupStatus;
  completed_at: string | null;
  completed_by: string | null;
  reminder_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgMember = {
  user_id: string;
  full_name: string;
  role: string | null;
  email: string;
  is_active: boolean;
};

export type Student = {
  student_id: string;
  organization_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const COURSE_STATUSES = ["draft", "published", "archived"] as const;

export type CourseStatus = (typeof COURSE_STATUSES)[number];

export type Course = {
  course_id: string;
  organization_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: CourseStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseModule = {
  module_id: string;
  organization_id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  lesson_id: string;
  organization_id: string;
  module_id: string;
  title: string;
  content: string;
  video_url: string | null;
  image_url: string | null;
  resources: any[] | null;
  position: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export const ENROLLMENT_STATUSES = [
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ENROLLMENT_TRANSITIONS: Record<
  EnrollmentStatus,
  readonly EnrollmentStatus[]
> = {
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export type Enrollment = {
  enrollment_id: string;
  organization_id: string;
  student_id: string;
  course_id: string;
  status: EnrollmentStatus;
  ended_at: string | null;
  enrolled_by: string | null;
  created_at: string;
  updated_at: string;
};

export function isCourseStatus(value: string): value is CourseStatus {
  return (COURSE_STATUSES as readonly string[]).includes(value);
}

export function isEnrollmentStatus(value: string): value is EnrollmentStatus {
  return (ENROLLMENT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionEnrollment(
  from: EnrollmentStatus,
  to: EnrollmentStatus
): boolean {
  return (ENROLLMENT_TRANSITIONS[from] as readonly string[]).includes(to);
}

export const QUIZ_QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
] as const;

export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export type Quiz = {
  quiz_id: string;
  organization_id: string;
  course_id: string;
  title: string;
  description: string | null;
  pass_threshold: number;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuizQuestion = {
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

export type QuizAttempt = {
  attempt_id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  created_at: string;
  updated_at: string;
};

export type QuizAttemptAnswer = {
  attempt_id: string;
  question_id: string;
  selected_answer: number[];
  is_correct: boolean;
  points_earned: number;
  created_at: string;
};

export function isQuizQuestionType(
  value: string
): value is QuizQuestionType {
  return (QUIZ_QUESTION_TYPES as readonly string[]).includes(value);
}

export const LESSON_PROGRESS_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;

export type LessonProgressStatus = (typeof LESSON_PROGRESS_STATUSES)[number];

export type LessonProgress = {
  enrollment_id: string;
  lesson_id: string;
  status: LessonProgressStatus;
  started_at: string | null;
  last_accessed_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export function isLessonProgressStatus(
  value: string
): value is LessonProgressStatus {
  return (LESSON_PROGRESS_STATUSES as readonly string[]).includes(value);
}

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function isLeadActivityType(value: string): value is LeadActivityType {
  return (LEAD_ACTIVITY_TYPES as readonly string[]).includes(value);
}

export function isFollowupStatus(value: string): value is FollowupStatus {
  return (FOLLOWUP_STATUSES as readonly string[]).includes(value);
}

export function isFollowupPriority(value: string): value is FollowupPriority {
  return (FOLLOWUP_PRIORITIES as readonly string[]).includes(value);
}