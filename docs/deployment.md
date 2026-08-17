# Deployment Architecture

## Platforms
- **Frontend / Full-stack Hosting**: Vercel (Next.js Application)
- **Backend / Database Hosting**: Supabase (PostgreSQL, GoTrue Auth)
- **Source Control**: GitHub

## Required Environment Variables
The application requires the following environment variables to be configured in Vercel for production deployments:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> [!CAUTION]
> **Security Rule**: NEVER commit actual secret values, `.env`, or `.env.local` to source control.

## Deployment Flow
1. Code is merged into the `main` branch on GitHub.
2. Vercel automatically detects the push and triggers a build.
3. Vercel executes `npm run lint` and `npm run build`.
4. If successful, the build artifacts (Serverless functions and Edge assets) are deployed to the global CDN.
5. The application seamlessly interfaces with the live Supabase instance.

## Commands
- **Production Build Command**: `npm run build`
- **Lint Command**: `npm run lint`
