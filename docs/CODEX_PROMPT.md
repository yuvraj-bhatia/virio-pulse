# Codex Implementation Prompt: Pulse

Build a production-quality demo called **Pulse**.

## Goal

Create an internal tool that connects executive content to revenue outcomes:
`Post/Theme -> Inbound -> Meetings -> Opportunities -> Revenue`.

The app should feel like a Virio internal ops product that multiplies the content team.

## Constraints

- Ship fast, with clean structure and real data flows.
- Dark, sleek B2B aesthetic with high polish and smooth transitions.
- DB-backed seeded data only; avoid hardcoded metrics.
- Demo-ready in 2-5 minutes.

## Tech Stack

- Next.js 14 + TypeScript + App Router
- Tailwind CSS
- shadcn-style component architecture
- Recharts
- Prisma + SQLite (Postgres-switchable)
- Demo login guard via localStorage (no NextAuth)
- Optional OpenAI-compatible insights integration with robust fallback

## App Layout

- Sidebar navigation:
  1. Overview
  2. Content
  3. Attribution
  4. Pipeline
  5. Insights
  6. Settings
- Top bar:
  - Client selector
  - Date range selector (7/30/90)
  - Generate Weekly Report button

## Core Prisma Model

- `Client(id, name, domain, vertical, createdAt, updatedAt)`
- `Executive(id, clientId, name, role, linkedinHandle, createdAt, updatedAt)`
- `ContentPost(id, clientId, executiveId, postedAt, format, theme, hook, body, impressions, likes, comments, shares, ctaType, status, createdAt, updatedAt)`
- `InboundSignal(id, clientId, postId?, executiveId?, source, personName, company, title, entryPointUrl?, createdAt, updatedAt)`
- `Meeting(id, clientId, inboundId?, scheduledAt, outcome, meetingType, notes, createdAt, updatedAt)`
- `Opportunity(id, clientId, meetingId?, stage, amount, createdAt, closedAt?, updatedAt)`
- `Report(id, clientId, rangePreset, startDate, endDate, viewMode, markdown, createdAt)`
- `AppSetting(id, clientId, attributionWindowDays, useSoftAttribution, createdAt, updatedAt)`

## Seed Data Requirements

- 3 clients
- 2 executives/client
- 40-80 posts over last 90 days
- Inbounds, meetings, and opportunities linked realistically
- Mixed signal quality:
  - some high engagement with low revenue impact
  - some lower engagement with high revenue impact
- Theme coverage:
  - pricing, security, ROI, case study, hiring, product launches

## Attribution Rules (Deterministic)

- `HIGH`: inbound has `postId`
- `MEDIUM`: inbound has no `postId`, has `executiveId`, and matches most recent post by same executive within attribution window
- `LOW`: inbound has no `postId` and no `executiveId` (unattributed; never force-match)
- Meeting inherits from inbound attribution
- Opportunity inherits from meeting attribution

## Required Metrics

- Meetings influenced
- Pipeline created
- Revenue won
- Content-to-meeting conversion rate
- Meeting-to-win conversion rate
- Revenue per post
- Meetings per post
- Theme performance (meetings/revenue)
- Top hooks by meetings influenced

## Page Requirements

### 1. Overview

- KPI cards
- Weekly revenue and meetings charts
- Top posts by revenue influenced table
- “What changed this week” heuristic callout

### 2. Content

- Filterable list (executive/theme/format/status/search)
- Post detail drill-down with inbounds, meetings, opportunities
- “Create new draft” flow with zod validation and DB write

### 3. Attribution

- Per-post attribution table with ROI score
- Confidence badges (High/Medium/Low)
- CSV export

### 4. Pipeline

- Funnel: inbound -> meetings held -> opportunities created -> closed won
- Opportunity list with stage chips and source-post link context
- Stage distribution chart + dollar totals

### 5. Insights

- Auto-run on page load
- If `INSIGHTS_AI_KEY` exists, call OpenAI-compatible endpoint
- If key missing or AI fails, show `Using heuristics` and return heuristic insights
- Keep output concise and action-oriented

### 6. Settings

- Read-only client list
- Attribution window toggle (7/14)
- Soft attribution toggle on/off

## Weekly Reports

- Generate markdown report from current client/date context
- Include:
  - KPI snapshot
  - top posts
  - theme winners/losers
  - next-week recommendations
- Save report to DB
- Download `.md`
- Show history modal
- Support two modes:
  - Internal view
  - Client-safe view

## Testing

Implement 8+ Vitest tests for attribution logic:

1. direct attribution (HIGH)
2. soft attribution within window (MEDIUM)
3. soft attribution outside window
4. soft attribution disabled
5. unattributed inbound (LOW)
6. meeting inheritance
7. opportunity inheritance
8. aggregation correctness
9. tie-breaker determinism

## Deliverables

- Fully working app with seeded DB and full navigation
- All pages functional and responsive
- Attribution logic tested and deterministic
- Weekly report generation with history + download
- README with setup/seed/run/test/demo

## Models

- Default AI model: `gpt-4o-mini`
- Override model with: `INSIGHTS_AI_MODEL`
- OpenAI-compatible base URL: `INSIGHTS_AI_BASE_URL` (default `https://api.openai.com/v1`)
- API key env: `INSIGHTS_AI_KEY`
- Behavior:
  - when key exists: auto-run AI insights on page load
  - on AI error or missing key: fallback to heuristic insights and explicitly show `Using heuristics`
