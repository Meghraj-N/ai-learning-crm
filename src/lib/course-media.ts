import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export function isCourseMediaPath(value: string): boolean {
  return value.startsWith("org/");
}

export async function getCourseMediaUrl(
  supabase: ServerSupabaseClient,
  value: string | null | undefined
): Promise<string | null> {
  if (!value) return null;
  if (!isCourseMediaPath(value)) return value;

  const { data, error } = await supabase.storage
    .from("course-media")
    .createSignedUrl(value, 60 * 60);

  if (error) {
    console.error("Course media signing failed", error.message);
    return null;
  }

  return data.signedUrl;
}
