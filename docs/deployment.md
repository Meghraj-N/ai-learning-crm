# Deployment

Deployment is intended to use GitHub, Vercel, and Supabase. This workspace does not expose their project metadata or production URL, so their live connection, branch, deployment status, and environment values are **not verified**.

Vercel needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Add `SUPABASE_SERVICE_ROLE_KEY` only when server-side admin operations are intentionally enabled; never prefix it with `NEXT_PUBLIC_`. `.env.example` contains names only.

Before release, compare the checked-out commit with the production branch and Vercel deployment SHA, run `npm run lint`, `npm run build`, and `git diff --check`, then verify Supabase Auth redirect allow-lists for local and production origins. Test the production login, Google OAuth, password reset, logout, protected routes, CRM, LMS, and course media separately; a successful GitHub push alone is not deployment verification.
