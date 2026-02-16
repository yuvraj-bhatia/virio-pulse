# Pulse

Pulse is a production-style internal attribution console that connects executive-led content to GTM outcomes:

`Post/Theme -> Inbound -> Meetings -> Opportunities -> Revenue`

It is built as a Virio-aligned demo with deterministic attribution logic, user-entered workflow support, AI-or-heuristic insights, and weekly markdown report generation.

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
npm run verify:client-isolation # validates clear/reset only affect target client
npm run test:demo-flow # integration smoke flow (import -> inbound -> opportunity -> recompute)
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
  - `MEDIUM`: inbound `entryPointUrl` matched to imported `postUrl`
  - `UNATTRIBUTED`: no deterministic match
- URL-first content import:
  - paste LinkedIn URLs (works with URL-only)
  - optional details inline (hook/postedAt/theme/format/body)
  - `NEEDS_DETAILS` / `READY` status lifecycle
- Post detail editor:
  - update hook, postedAt, theme, format, URL, body, metrics, status
  - toast when post transitions to `READY`
- Inbound + opportunity operations:
  - add inbound signal modal
  - convert inbound to opportunity
  - create opportunity from Pipeline page
  - update opportunity stage inline in pipeline table
- Attribution recompute:
  - automatic after imports/inbound/opportunity/settings updates
  - manual recompute button on Attribution page with timestamp
- Guided demo UX:
  - first-run Overview walkthrough
  - persistent demo checklist panel across dashboard pages
  - `/demo` route with clickable script and completion checks
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
  - Clear workspace data (per client)
  - Reset to sample data (per client)
  - Sample vs Real data mode tracking per client

## 2-5 Minute Demo Flow

1. Login with `pulse`
2. Go to Content and click `Import URLs`
3. Paste URLs, import, then fill missing post details in post drawer
4. Add an inbound signal (Content)
5. Create an opportunity (Pipeline) and set stage
6. Open Attribution and click `Recompute attribution`
7. Verify Overview + Insights changed from your input data
8. Generate Weekly Report from top bar:
   - toggle Internal vs Client-safe
   - download markdown
   - open history list

## Notes

- Seed intentionally includes mixed patterns:
  - high-engagement posts with low revenue influence
  - lower-engagement posts with strong revenue influence
- Full implementation prompt lives in:
  - `docs/CODEX_PROMPT.md`
