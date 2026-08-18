import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ModuleRow = {
  module_id: string;
  course_id: string;
};

type LessonRow = {
  lesson_id: string;
  module_id: string;
};

export type CourseLesson = {
  lesson_id: string;
  module_id: string;
  title: string;
  position: number;
  video_url: string | null;
  image_url: string | null;
  resources: unknown[] | null;
  is_published: boolean;
};

export type CourseModuleNode = {
  module_id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: CourseLesson[];
};

export async function getCourseContent(
  supabase: ServerClient,
  courseId: string
): Promise<CourseModuleNode[]> {
  const { data: modules } = await supabase
    .from("course_modules")
    .select("module_id, course_id, title, description, position")
    .eq("course_id", courseId)
    .order("position", { ascending: true })
    .returns<Omit<CourseModuleNode, "lessons">[]>();

  const moduleRows = modules ?? [];
  const nodes: CourseModuleNode[] = moduleRows.map((module) => ({
    ...module,
    lessons: [],
  }));

  const moduleIds = nodes.map((node) => node.module_id);
  if (moduleIds.length === 0) {
    return nodes;
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("lesson_id, module_id, title, position, video_url, image_url, resources, is_published")
    .in("module_id", moduleIds)
    .order("position", { ascending: true })
    .returns<CourseLesson[]>();

  const byModule = new Map<string, CourseLesson[]>();
  for (const lesson of lessons ?? []) {
    const list = byModule.get(lesson.module_id) ?? [];
    list.push(lesson);
    byModule.set(lesson.module_id, list);
  }

  for (const node of nodes) {
    node.lessons = byModule.get(node.module_id) ?? [];
  }

  return nodes;
}

export async function getCourseContents(
  supabase: ServerClient,
  courseIds: string[]
): Promise<Map<string, CourseModuleNode[]>> {
  const contents = new Map<string, CourseModuleNode[]>();
  if (courseIds.length === 0) {
    return contents;
  }

  const { data: modules } = await supabase
    .from("course_modules")
    .select("module_id, course_id, title, description, position")
    .in("course_id", courseIds)
    .order("position", { ascending: true })
    .returns<Omit<CourseModuleNode, "lessons">[]>();

  const moduleRows = modules ?? [];
  const byCourse = new Map<string, CourseModuleNode[]>();
  for (const mod of moduleRows) {
    const list = byCourse.get(mod.course_id) ?? [];
    list.push({ ...mod, lessons: [] });
    byCourse.set(mod.course_id, list);
  }

  const moduleIds = moduleRows.map((mod) => mod.module_id);
  if (moduleIds.length === 0) {
    for (const [courseId, nodes] of byCourse) {
      contents.set(courseId, nodes);
    }
    return contents;
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("lesson_id, module_id, title, position, video_url, image_url, resources, is_published")
    .in("module_id", moduleIds)
    .order("position", { ascending: true })
    .returns<CourseLesson[]>();

  const byModule = new Map<string, CourseLesson[]>();
  for (const lesson of lessons ?? []) {
    const list = byModule.get(lesson.module_id) ?? [];
    list.push(lesson);
    byModule.set(lesson.module_id, list);
  }

  for (const [courseId, nodes] of byCourse) {
    for (const node of nodes) {
      node.lessons = byModule.get(node.module_id) ?? [];
    }
    contents.set(courseId, nodes);
  }

  return contents;
}

export async function getPublishedLessonCountsByCourse(
  supabase: ServerClient,
  courseIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (courseIds.length === 0) {
    return counts;
  }

  const { data: modules } = await supabase
    .from("course_modules")
    .select("module_id, course_id")
    .in("course_id", courseIds);

  const moduleRows = (modules ?? []) as ModuleRow[];
  const moduleIds = moduleRows.map((mod) => mod.module_id);
  if (moduleIds.length === 0) {
    return counts;
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("lesson_id, module_id, is_published")
    .in("module_id", moduleIds)
    .eq("is_published", true);

  const byModule = new Map<string, number>();
  for (const lesson of (lessons ?? []) as (LessonRow & { is_published: boolean })[]) {
    byModule.set(
      lesson.module_id,
      (byModule.get(lesson.module_id) ?? 0) + 1
    );
  }

  for (const mod of moduleRows) {
    counts.set(
      mod.course_id,
      (counts.get(mod.course_id) ?? 0) + (byModule.get(mod.module_id) ?? 0)
    );
  }

  return counts;
}

export async function getLessonCountsByCourse(
  supabase: ServerClient,
  courseIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (courseIds.length === 0) {
    return counts;
  }

  const { data: modules } = await supabase
    .from("course_modules")
    .select("module_id, course_id")
    .in("course_id", courseIds);

  const moduleRows = (modules ?? []) as ModuleRow[];
  const moduleIds = moduleRows.map((module) => module.module_id);
  if (moduleIds.length === 0) {
    return counts;
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("lesson_id, module_id")
    .in("module_id", moduleIds);

  const byModule = new Map<string, number>();
  for (const lesson of (lessons ?? []) as LessonRow[]) {
    byModule.set(
      lesson.module_id,
      (byModule.get(lesson.module_id) ?? 0) + 1
    );
  }

  for (const mod of moduleRows) {
    counts.set(
      mod.course_id,
      (counts.get(mod.course_id) ?? 0) + (byModule.get(mod.module_id) ?? 0)
    );
  }

  return counts;
}
