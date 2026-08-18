-- Course media is private. Object names carry organization and course scope:
-- org/{organization_id}/courses/{course_id}/...
-- The previous policy authorized every student for the entire bucket, which
-- could not safely enforce tenant isolation for private objects.

drop policy if exists "Staff and enrolled students can view course media" on storage.objects;
drop policy if exists "Instructors and admins can upload course media" on storage.objects;
drop policy if exists "Instructors and admins can update course media" on storage.objects;
drop policy if exists "Instructors and admins can delete course media" on storage.objects;

create policy "Organization members can view scoped course media"
on storage.objects for select to authenticated
using (
  bucket_id = 'course-media'
  and (storage.foldername(name))[1] = 'org'
  and (storage.foldername(name))[2] = public.current_org_id()::text
  and (
    public.has_role(array['admin', 'sales', 'counselor', 'instructor'])
    or (
      public.has_role(array['student'])
      and (storage.foldername(name))[3] = 'courses'
      and exists (
        select 1
        from public.students student
        join public.enrollments enrollment on enrollment.student_id = student.student_id
        join public.courses course on course.course_id = enrollment.course_id
        where student.profile_id = auth.uid()
          and student.organization_id = public.current_org_id()
          and enrollment.organization_id = public.current_org_id()
          and enrollment.status = 'active'
          and course.status = 'published'
          and course.course_id::text = (storage.foldername(name))[4]
      )
    )
  )
);

create policy "Instructors and admins can manage scoped course media"
on storage.objects for all to authenticated
using (
  bucket_id = 'course-media'
  and (storage.foldername(name))[1] = 'org'
  and (storage.foldername(name))[2] = public.current_org_id()::text
  and public.has_role(array['admin', 'instructor'])
)
with check (
  bucket_id = 'course-media'
  and (storage.foldername(name))[1] = 'org'
  and (storage.foldername(name))[2] = public.current_org_id()::text
  and public.has_role(array['admin', 'instructor'])
);
