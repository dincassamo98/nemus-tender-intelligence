# Nemus África — Tender Intelligence Platform

A platform that continuously discovers, scores, and tracks public procurement
opportunities relevant to Nemus África's environmental and sustainability
consulting work in Mozambique — so nobody has to manually read newspapers and
government portals every day to find them.

This is not a scraper. It is a source-adapter architecture, an ingestion
pipeline with deduplication and change detection, a relevance classifier
grounded in Nemus África's actual service areas, and a review workflow —
built so more sources and smarter classification can be added over time
without a rewrite. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
full reasoning and current scope (what's built vs. what's deliberately
deferred).

## Quick start (local development)

Requirements: Node 22+, pnpm, PostgreSQL (or Docker).

```bash
pnpm install

# Start Postgres (or point DATABASE_URL at your own instance)
docker compose up -d db

cp .env.example .env
# Edit .env: set ADMIN_PASSWORD at minimum. Leave NOTICIAS_EMAIL/PASSWORD
# blank for now — the app works fully on demo data without them.

pnpm db:migrate
pnpm db:seed   # creates the admin user, registers sources, loads demo tenders

pnpm dev       # http://localhost:3000
```

Log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`.

## Running ingestion manually

```bash
pnpm ingest                    # all enabled, non-demo sources
pnpm ingest --source ufsa       # a single source by key
```

The in-app **Refresh** button does the same for lightweight sources; the
Jornal Notícias adapter (browser automation) only runs via this CLI or the
scheduled GitHub Actions worker — see `docs/ARCHITECTURE.md`.

## Tests

```bash
pnpm test
```

Covers the classifier, deduplication engine, deadline urgency logic, change
detection, and text-extraction helpers — the parts of the system where a
silent bug would mean a missed or miscategorized tender.

## Project layout

```
src/lib/adapters/       Source adapters (Jornal Notícias, UFSA, demo) + registry
src/lib/pipeline/       Ingestion pipeline: dedupe, change detection, document
                         processing, extraction helpers, orchestrator
src/lib/intelligence/   Nemus África profile, relevance classifier, executive
                         summary generator, email draft generator
src/lib/deadline.ts     Deadline urgency calculation
prisma/schema.prisma    Canonical data model
scripts/ingest.ts       CLI ingestion entrypoint (local + CI)
src/app/(dashboard)/    Authenticated UI: dashboard, feed, detail, watchlist,
                         sources, settings
src/app/api/            REST API routes backing the UI
docs/                   Architecture, adding a source, deployment
.github/workflows/      Scheduled ingestion worker (Playwright)
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, key
  decisions, known gaps, and what's deliberately out of scope for the MVP.
- [`docs/ADDING_A_SOURCE.md`](docs/ADDING_A_SOURCE.md) — how to add a new
  procurement source without touching the rest of the app.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploying to Vercel + a
  managed Postgres provider, plus the GitHub Actions worker setup.
