# HireCanvas — Job Search Command Center

A production-grade SaaS application for tracking job applications, syncing Gmail emails with AI extraction, and managing your entire job search pipeline.

**Status:** Active development — core platform and billing flows implemented  
**Version:** 0.6.0

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.4 |
| UI | React | 19.2.4 |
| Language | TypeScript | 5.x (strict) |
| Styling | Tailwind CSS | 4.x |
| Database & Auth | Supabase (PostgreSQL + Auth + Storage + Realtime) | — |
| State (Client) | Zustand | 5.x |
| State (Server) | TanStack React Query | 5.x |
| Forms | react-hook-form + Zod | Latest |
| Charts | Recharts | 3.x |
| Queue | BullMQ + ioredis | 5.x |
| Optional NLP Service | FastAPI (Python) | 0.116.x |
| Icons | react-icons | 5.x |
| Font | Plus Jakarta Sans | Google Fonts |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Supabase account ([supabase.com](https://supabase.com) — free tier works)
- Docker (optional, for Redis / local deployment)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create Supabase project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Copy your project URL, anon key, and service role key

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in at minimum:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   See `.env.example` for the full list (Gmail OAuth, AI keys, Stripe, AWS SES, etc.).

4. **Run database migrations**
   In the Supabase SQL Editor, execute each migration file in order:
   ```
   supabase/migrations/001_app_users.sql
   supabase/migrations/002_user_plans.sql
   ...
   supabase/migrations/036_billing_events.sql
   ```
   There are **36 migration files** numbered 001–036. Run them sequentially.

5. **Start development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

### With Docker

```bash
docker compose up
```

### Optional Python NLP Service

For faster ATS keyword extraction, you can run an optional Python microservice and let the app call it with timeout-based fallback.

Set:

```env
PYTHON_NLP_SERVICE_URL=http://localhost:8001
```

If this variable is unset or the service is unavailable, HireCanvas automatically uses the built-in TypeScript keyword logic.

---

## Project Structure

```
hirecanvas/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Public: login, register
│   │   ├── (dashboard)/              # Protected: all dashboard pages
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── jobs/                 # Job tracker
│   │   │   ├── contacts/            # Contact management
│   │   │   ├── outreach/            # Outreach tracking
│   │   │   ├── reminders/           # Reminders
│   │   │   ├── templates/           # Email/LinkedIn templates
│   │   │   ├── interview-prep/      # Interview Q&A
│   │   │   ├── resumes/             # Resume manager
│   │   │   ├── settings/            # Account settings
│   │   │   ├── billing/             # Subscription plans
│   │   │   └── admin/               # Admin panel
│   │   ├── api/                      # API routes (health, auth, admin, sync)
│   │   ├── terms/ & privacy/         # Legal pages
│   │   └── page.tsx                  # Landing page
│   ├── components/                   # React components
│   │   ├── ui/                       # Base: Button, Input, Card, Label, StatusBadge, TierGate, etc.
│   │   ├── layout/                   # DashboardLayout, CommandPalette, UpgradeModal
│   │   ├── dashboard/                # KPI cards, charts, extraction feed
│   │   ├── jobs/                     # JobsTable, JobForm, JobDetailDrawer
│   │   └── auth/                     # Login/Register forms
│   ├── actions/                      # Server actions: jobs, contacts, outreach, reminders, templates, resumes, interviewPrep
│   ├── lib/
│   │   ├── supabase/                 # Client, server, middleware setup
│   │   ├── gmail/                    # OAuth connect/callback
│   │   ├── queue/                    # BullMQ queues + workers
│   │   ├── security/                 # Rate limiting, sync lock, encryption, audit
│   │   ├── validations/              # Zod schemas
│   │   ├── redis.ts                  # ioredis client
│   │   ├── utils.ts                  # Shared utilities (cn, formatDate, etc.)
│   │   └── constants.ts              # App-wide constants
│   ├── hooks/                        # useSyncStatus
│   ├── stores/                       # Zustand: authStore
│   └── types/                        # Shared TypeScript types
├── supabase/migrations/              # 36 SQL migration files (001–036)
├── nginx/hirecanvas.conf             # Nginx reverse proxy config
├── docker-compose.yml                # Docker dev setup
└── Dockerfile                        # Container image
```

---

## Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run worker:sync      # Start Gmail sync worker (BullMQ)
npm run worker:extract   # Start AI extraction worker (BullMQ)
npm run worker:nudge     # Start follow-up nudge worker (BullMQ)
npm run worker:digest    # Start daily digest worker (BullMQ)
```

---

## What's Implemented

### ✅ Working Now
- **Authentication** — Supabase email/password login & register, protected routes, middleware
- **Dashboard** — KPI cards, activity chart (Recharts), AI extraction feed, pipeline table
- **Job Tracker** — Full CRUD, sortable table, status filters, detail drawer with 5 tabs
- **Contacts** — CRUD with relationship badges (Recruiter, Hiring Manager, Employee, Other)
- **Outreach** — CRUD with method/status tracking
- **Reminders** — CRUD with type badges and overdue highlighting
- **Templates** — CRUD for email/LinkedIn/WhatsApp templates
- **Interview Prep** — Question bank with persistent progress tracking
- **Resume Manager** — Supabase Storage upload/download/default/delete
- **Settings** — 4-tab layout (Account, Security, Notifications, Connections)
- **Admin** — Overview metrics, user management, tier config
- **Billing** — Live plan + invoice history with Stripe checkout and portal
- **Landing Page** — Hero, features, pricing sections
- **Legal** — Terms of Service, Privacy Policy
- **Gmail OAuth** — Connect/callback routes with encrypted token storage
- **Stripe Billing** — Checkout session API, customer portal API, signed webhook handling
- **Queue Infrastructure** — BullMQ sync, extraction, nudge, and digest workers bootstrapped
- **Realtime** — Sync status subscription hook
- **Database** — 36 migrations, RLS on all tables
- **Deployment Config** — Docker, Nginx, CI/CD template

### ⏳ Not Yet Implemented
- Production infra validation (live EC2 smoke test + CloudWatch alarm trigger verification)
- Full mobile responsiveness pass across core views
- Auth-gated e2e execution in CI (`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`)

See [IMPLEMENTATION_GAPS.md](IMPLEMENTATION_GAPS.md) for the prioritized backlog.

---

## Key Documentation

| File | Purpose |
|------|---------|
| **[PROJECT_STATE.md](PROJECT_STATE.md)** | Architecture blueprint & single source of truth |
| **[IMPLEMENTATION_GAPS.md](IMPLEMENTATION_GAPS.md)** | Notes on shipped vs optional follow-ups |

---

## Design

- Light mint background (`#f0fdfb`), teal accents (`#14b8a6`)
- Plus Jakarta Sans font
- Light teal sidebar — never dark
- Table-based views — no Kanban
- Status badges with semantic colors

---

## Contributing

Read `PROJECT_STATE.md` before writing any code — it contains architecture decisions, conventions, and explicit do/don't rules for development.

## License

Proprietary — HireCanvas 2026
