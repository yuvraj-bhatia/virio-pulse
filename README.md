# Pulse

Pulse is a production-style internal attribution console that connects executive-led content to GTM outcomes:

`Post/Theme -> Inbound -> Meetings -> Opportunities -> Revenue`

It is built as a Virio-aligned demo with deterministic attribution logic, seeded relational data, AI-or-heuristic insights, and weekly markdown report generation.

## Stack

- Next.js 14 + TypeScript + App Router
- Tailwind CSS + shadcn-style UI components + Recharts
- Prisma + SQLite (Postgres-switchable schema)
- Zod validation
- Vitest (attribution logic tests)

## Setup

```bash
npm install
cp .env.example .env
npm run db:setup
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Login

- Route: `/login`
- Demo code: `pulse`

## Scripts

```bash
npm run db:setup   # prisma generate + db push
npm run db:seed    # seed 3 clients + full demo data
npm run test       # attribution unit tests
npm run dev        # local dev server
npm run build      # production build validation
```

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
INSIGHTS_AI_KEY=""
INSIGHTS_AI_BASE_URL="https://api.openai.com/v1"
INSIGHTS_AI_MODEL="gpt-4o-mini"
```

## What Is Implemented

- Full dashboard nav: Overview, Content, Attribution, Pipeline, Insights, Settings
- Topbar with client selector, date range selector, report generation
- Deterministic attribution with confidence levels:
  - `HIGH`: direct `postId`
  - `MEDIUM`: soft match by `executiveId` within attribution window
  - `LOW`: no `postId` and no `executiveId` (unattributed)
- Weekly report generation:
  - Internal view
  - Client-safe view
  - DB persistence + modal history + markdown download
- Insights:
  - Auto AI on page load when `INSIGHTS_AI_KEY` exists
  - Heuristic fallback with explicit `Using heuristics` label
- Settings:
  - Attribution window (7/14)
  - Soft attribution toggle

## 2-5 Minute Demo Flow

1. Login with `pulse`
2. Overview: show KPI cards + weekly trends + top posts
3. Attribution: show confidence badges + CSV export
4. Pipeline: show funnel and stage distribution
5. Insights: show auto-generated recommendations and fallback labeling
6. Generate Weekly Report from top bar:
   - toggle Internal vs Client-safe
   - download markdown
   - open history list

## Notes

- Seed intentionally includes mixed patterns:
  - high-engagement posts with low revenue influence
  - lower-engagement posts with strong revenue influence
- Full implementation prompt lives in:
  - `docs/CODEX_PROMPT.md`
