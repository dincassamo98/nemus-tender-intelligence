# Deployment

Target: Vercel (app) + a managed Postgres provider (Supabase or Neon) + a
scheduled GitHub Actions worker (Jornal Notícias, and any future
browser-automation source). See `docs/ARCHITECTURE.md` for why ingestion is
split this way.

## 1. Database

Create a Postgres instance on Supabase or Neon. You'll get two connection
strings:
- A **pooled** connection string → `DATABASE_URL` (used by the running app).
- A **direct** connection string → `DIRECT_URL` (used by Prisma Migrate).

Run migrations once against production:

```bash
DATABASE_URL="..." DIRECT_URL="..." npx prisma migrate deploy
```

Then seed the initial admin user and source registry (only needs to run
once; it's idempotent otherwise):

```bash
DATABASE_URL="..." DIRECT_URL="..." ADMIN_EMAIL="..." ADMIN_NAME="..." ADMIN_PASSWORD="..." npx tsx prisma/seed.ts
```

## 2. Vercel project

Import the repo, framework preset "Next.js". Set environment variables
(see `.env.example` for the full list and what each one does):

- `DATABASE_URL`, `DIRECT_URL`
- `AUTH_SECRET` (generate with `openssl rand -base64 32`), `NEXTAUTH_URL`
  (your production URL)
- `NOTICIAS_EMAIL` / `NOTICIAS_PASSWORD` — only needed if you want the
  Refresh button's dispatch path to succeed; the actual Jornal Notícias run
  happens in GitHub Actions, which needs its own copy of these as repo
  secrets (below)
- `GITHUB_DISPATCH_TOKEN` — a fine-grained GitHub PAT scoped to **this repo
  only**, with **Actions: write** permission, so the Refresh button can
  trigger the `ingest.yml` workflow
- `GITHUB_DISPATCH_REPO` — `owner/repo`
- `CRON_SECRET` — Vercel sets this automatically for you when you add a
  cron job; copy its value in if you want to test the cron route manually
- `STORAGE_DRIVER=local` is fine to start, understanding the ephemeral-
  storage caveat in `docs/ARCHITECTURE.md`

`vercel.json` already declares the lightweight-sources cron job — no extra
Vercel dashboard configuration needed for that.

## 3. GitHub Actions worker

`.github/workflows/ingest.yml` needs these **repository secrets** (Settings →
Secrets and variables → Actions):

- `DATABASE_URL`, `DIRECT_URL` — same database as the Vercel app
- `NOTICIAS_EMAIL`, `NOTICIAS_PASSWORD`

It runs on its own schedule (twice daily by default) and can also be
triggered manually (`workflow_dispatch`, with an optional `source` input) or
via the Refresh button's dispatch call.

## 4. Enabling real sources

Both `ufsa` and `jornal-noticias` are seeded with `enabled: false` — they
need to be validated against the live sites first (see
`docs/ADDING_A_SOURCE.md` step 4). Flip `enabled` to `true` in the database
(or via a future admin UI — not built yet, see `docs/ARCHITECTURE.md`
"deliberately out of scope") once you've confirmed extraction quality.

## Health checks

There isn't a dedicated `/health` endpoint yet — `GET /api/sources` (behind
auth) and the Sources page double as operational visibility: last successful
run, last error, reliability score. Add a proper health/readiness endpoint
before treating uptime monitoring as a requirement.
