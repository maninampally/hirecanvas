# IMPLEMENTATION_GAPS.md

Last Updated: 2026-04-17
Owner: Engineering
Purpose: **Living execution board** — single delivery queue pulled top-down by sprint order.
Re-estimate: Weekly after each shipped slice.

## How to Use This File

```
Status markers:
  ⬜ todo        — not started
  🔨 in_progress — actively being worked on
  🚫 blocked     — waiting on something (reason noted inline)
  ✅ done        — completed with evidence

Execution model:
  Pull work top-down by sprint order.
  Ship in thin vertical slices, not full sprints.
  After completing each item, add evidence (files changed, test result, behavior verified).
  Re-estimate remaining effort weekly.
```

## Product Direction

- Billing/Stripe wiring is **blocked** until product team unblocks billing.
- AI provider runtime is the **highest-impact unblocked item** — start here.
- UI overhaul is **done** — all new features must use the premium design system.
- All new components must use: Button, Card, Input, Select, Badge, Checkbox, PageHeader, EmptyState.
- All new pages must use: `animate-slide-up` with stagger delays, `PageHeader` for titles.

---

## Sprint 1: AI Intelligence Engine

> **Goal:** Make the "AI-Powered" promise real.
> **Impact:** 🔴 Critical — Core product differentiator
> **Estimate:** 5-7 days | **Remaining:** 5-7 days

### Slice 1A: LLM Router Base (vertical slice — shippable alone)

#### 1.1 LLM Router + Failover Chain `⬜ todo`
- Implement `src/lib/ai/llmRouter.ts` — Gemini → Claude → OpenAI → regex fallback
- 6-hour cooldown per provider on quota errors
- Provider health tracking in Redis
- **Files:** `src/lib/ai/llmRouter.ts`, `gemini.ts`, `claude.ts`, `openai.ts`
- **Estimate:** 2 days
- **Prerequisites:**
  - `GEMINI_API_KEY` env var configured
  - `ANTHROPIC_API_KEY` env var configured
  - `OPENAI_API_KEY` env var configured
  - Redis running (Docker container via `docker-compose up redis`)
- **Evidence when done:**
  - [ ] Unit test: router calls Gemini, falls back to Claude on Gemini error
  - [ ] Redis stores provider cooldown state
  - [ ] `npx tsc --noEmit` passes

#### 1.2 PII Sanitizer `⬜ todo`
- Strip SSN, CC numbers, passwords, API keys from email text before AI
- Regex-based detection + replacement with `[REDACTED]`
- **Files:** `src/lib/ai/sanitizer.ts`
- **Estimate:** 0.5 day
- **Prerequisites:** None (standalone utility)
- **Evidence when done:**
  - [ ] Unit test: known PII patterns are stripped
  - [ ] No false positives on normal job email text

#### 1.3 Extraction Worker Wired to LLM Router `⬜ todo`
- Wire existing `extractionWorker.ts` to use LLM router (currently scaffold-only)
- Parse AI response into structured job data (company, role, salary, status)
- Auto-create/update job records from extraction results
- Pipe email text through PII sanitizer before sending to AI
- **Files:** `src/lib/queue/workers/extractionWorker.ts`
- **Estimate:** 1.5 days
- **Prerequisites:**
  - 1.1 LLM Router done
  - 1.2 PII Sanitizer done
  - Gmail OAuth tokens stored (already implemented)
  - BullMQ queue scaffolding running (already implemented)
  - Supabase `jobs` table + `processed_emails` table (migration exists)
- **Evidence when done:**
  - [ ] End-to-end test: enqueue fake email → worker processes → job row created in DB
  - [ ] AI usage row written to `ai_usage` table
  - [ ] Audit log entry written

> **🏁 Milestone after Slice 1A:** Core AI pipeline works end-to-end. Demo-able.

---

### Slice 1B: AI User Features (requires Slice 1A)

#### 1.4 AI Cover Letter Writer (Elite) `⬜ todo`
- Generate customized cover letters from job description + resume text
- Template selection + tone options (professional, conversational, creative)
- **Files:** `src/lib/ai/coverLetter.ts`, `src/app/(dashboard)/resumes/cover-letter/page.tsx`
- **Estimate:** 1.5 days
- **Prerequisites:**
  - 1.1 LLM Router done
  - Resume data accessible (already implemented via resume manager)
- **Evidence when done:**
  - [ ] Cover letter generated from sample job description
  - [ ] AI usage tracked in `ai_usage` table
  - [ ] Page uses PageHeader + Card + Button components (premium design)

#### 1.5 AI Interview Coach (Elite) `⬜ todo`
- AI asks mock interview questions based on job role
- Scores user answers and provides structured feedback
- **Files:** `src/lib/ai/interviewCoach.ts`, UI integration in `interview-prep/page.tsx`
- **Estimate:** 1 day
- **Prerequisites:**
  - 1.1 LLM Router done
  - Interview questions seeded in DB (already done, migration 022)
- **Evidence when done:**
  - [ ] AI generates follow-up questions based on user answers
  - [ ] Scoring displayed with Badge component
  - [ ] AI usage tracked

---

## Sprint 2: Automation & Nudges

> **Goal:** Make the app proactively helpful.
> **Impact:** 🔴 High — Proactive user value
> **Estimate:** 3-4 days | **Remaining:** 3-4 days
> **Hard dependency:** Sprint 1 Slice 1A must be done first (AI for email drafts).

### 2.1 Follow-Up Nudge Engine `⬜ todo`
- Auto-detect stale applications (7d, 14d, 21d since last contact)
- Generate contextual follow-up email drafts using AI
- BullMQ scheduled job to run daily checks
- AWS SES to deliver nudge notifications
- **Files:** `src/lib/queue/workers/nudgeWorker.ts`, nudge settings in Settings > Notifications
- **Estimate:** 2 days
- **Prerequisites:**
  - Sprint 1.1 LLM Router done (for AI email drafts)
  - `AWS_SES_ACCESS_KEY_ID` + `AWS_SES_SECRET_ACCESS_KEY` env vars configured
  - `SES_FROM_EMAIL` verified in AWS SES console
  - Redis + BullMQ running
  - User notification preferences accessible (Settings UI exists)
- **Evidence when done:**
  - [ ] BullMQ repeatable job runs on schedule
  - [ ] Stale jobs detected with correct thresholds
  - [ ] AI draft generated and logged
  - [ ] SES email sent (or dry-run logged in dev)

### 2.2 Smart Status Detection `⬜ todo`
- When new emails arrive during sync, detect status changes from email content
- Auto-update job status (e.g., "congratulations" → Offer, "regret" → Rejected)
- Confidence scoring on auto-status changes
- **Estimate:** 1 day
- **Prerequisites:**
  - Sprint 1.3 Extraction Worker done (parses emails into job data)
  - `job_status_timeline` table (migration exists)
- **Evidence when done:**
  - [ ] Status keywords trigger correct status changes
  - [ ] Timeline entry created with `ai_confidence_score`
  - [ ] Low-confidence changes flagged for user review

### 2.3 Daily Digest Email `⬜ todo`
- Morning email summary: new activity, upcoming interviews, pending follow-ups
- AWS SES HTML template with HireCanvas branding
- User preference toggle in Settings > Notifications (Checkbox component)
- **Estimate:** 1 day
- **Prerequisites:**
  - AWS SES configured (same as 2.1)
  - Jobs + reminders data accessible
  - BullMQ cron job infrastructure (same as 2.1)
- **Evidence when done:**
  - [ ] Daily digest HTML email renders correctly
  - [ ] Only sent to users with preference enabled
  - [ ] Unsubscribe link works

---

## Sprint 3: Application Depth

> **Goal:** Make job tracking world-class.
> **Impact:** 🟡 Medium — Power user features
> **Estimate:** 3-4 days | **Remaining:** 3-4 days

### 3.1 Job Detail Drawer `⬜ todo`
- Right-side panel showing full job details + status timeline
- Email thread from synced emails (if available)
- Actions: edit status, add note, archive
- **Files:** `src/components/jobs/JobDetailDrawer.tsx`, update `JobsTable.tsx`
- **Estimate:** 1.5 days
- **Prerequisites:** None (uses existing jobs data + UI components)
- **Evidence when done:**
  - [ ] Clicking a table row opens drawer
  - [ ] Status timeline renders from `job_status_timeline` table
  - [ ] Actions trigger server actions and toast confirmations

### 3.2 CSV Import/Export `⬜ todo`
- Import: upload CSV → map columns to job fields → bulk insert
- Export: current pipeline as downloadable CSV
- **Estimate:** 1 day
- **Prerequisites:** None (uses existing jobs server actions)
- **Evidence when done:**
  - [ ] Sample CSV imports correctly
  - [ ] Column mapping UI handles mismatched headers
  - [ ] Export downloads complete pipeline data

### 3.3 ATS Resume Checker `⬜ todo`
- Upload resume + paste job description
- AI compares keywords, formatting, ATS compatibility score
- Actionable suggestions for improvement
- **Files:** `src/lib/ai/atsChecker.ts`, `src/components/resumes/ATSChecker.tsx`
- **Estimate:** 1.5 days
- **Prerequisites:**
  - **Sprint 1.1 LLM Router done** (AI dependency)
  - Resume manager working (already implemented)
- **Evidence when done:**
  - [ ] ATS score displayed (0-100) with Badge component
  - [ ] Keyword match breakdown shown
  - [ ] AI usage tracked in `ai_usage` table

---

## Sprint 4: Analytics & Insights

> **Goal:** Help users optimize their job search with data.
> **Impact:** 🟡 Medium — Data-driven differentiation
> **Estimate:** 3 days | **Remaining:** 3 days

### 4.1 Pipeline Conversion Funnel `⬜ todo`
- Visual funnel: Applied → Screening → Interview → Offer
- Conversion rates between stages
- **Files:** `src/components/dashboard/PipelineFunnel.tsx`
- **Estimate:** 1 day
- **Prerequisites:** None (reads from existing `jobs` table)
- **Evidence when done:**
  - [ ] Funnel SVG/Recharts renders with live data
  - [ ] Conversion percentages are accurate

### 4.2 Response Rate Analytics `⬜ todo`
- Track which companies/roles respond fastest
- Average days per pipeline stage
- **Estimate:** 0.5 day
- **Prerequisites:** None (reads from `jobs` + `job_status_timeline`)
- **Evidence when done:**
  - [ ] Average response time calculated per company
  - [ ] Sorted by fastest→slowest

### 4.3 Activity Heatmap Calendar `⬜ todo`
- GitHub-style contribution heatmap showing application activity
- **Files:** `src/components/dashboard/ActivityHeatmap.tsx`
- **Estimate:** 1 day
- **Prerequisites:** None (reads from `jobs.created_at`)
- **Evidence when done:**
  - [ ] Heatmap renders last 52 weeks
  - [ ] Color intensity reflects daily count

### 4.4 Weekly Strategy Report (Elite) `⬜ todo`
- AI analyzes pipeline data and generates insights
- "Apply more to startups — your response rate is 3x higher"
- **Estimate:** 0.5 day
- **Prerequisites:**
  - **Sprint 1.1 LLM Router done** (AI dependency)
  - Sprint 4.1-4.2 done (needs analytics data to reason about)
- **Evidence when done:**
  - [ ] AI generates 3-5 actionable insights
  - [ ] Displayed in Card component with slide-up animation

---

## Sprint 5: Settings & Security Hardening

> **Goal:** Production-ready account management.
> **Impact:** 🟡 Medium — Production readiness
> **Estimate:** 2-3 days | **Remaining:** 2-3 days
> **Note:** Can be worked on in parallel with Sprint 3-4 (no AI dependency).

### 5.1 Account Update `⬜ todo`
- True name/email/avatar update via Supabase Auth admin API
- **Estimate:** 0.5 day
- **Prerequisites:** Supabase service role key configured
- **Evidence when done:**
  - [ ] Name change persists across sessions
  - [ ] Topbar avatar/name updates immediately

### 5.2 Password Reset Flow `⬜ todo`
- Forgot password → Supabase sends reset email → reset page
- **Estimate:** 0.5 day
- **Prerequisites:** Supabase email templates configured
- **Evidence when done:**
  - [ ] Reset email received
  - [ ] New password works on login

### 5.3 MFA (TOTP) Wiring `⬜ todo`
- Supabase MFA enrollment + verification
- QR code display, backup codes
- **Estimate:** 1 day
- **Prerequisites:** Supabase MFA enabled in project settings
- **Evidence when done:**
  - [ ] QR code displays in Settings > Security
  - [ ] TOTP code required on next login
  - [ ] Backup codes downloadable

### 5.4 Session Management `⬜ todo`
- List active sessions with device/location info
- Revoke individual sessions
- **Estimate:** 0.5 day
- **Prerequisites:** Supabase session API access
- **Evidence when done:**
  - [ ] Active sessions listed with browser/OS info
  - [ ] Revoke logs out that session

### 5.5 Gmail Connection Status `⬜ todo`
- Show connected Gmail account in Settings > Connections
- Disconnect option (delete `oauth_tokens` row), token refresh status
- **Estimate:** 0.5 day
- **Prerequisites:** Gmail OAuth already implemented
- **Evidence when done:**
  - [ ] Connected email displayed
  - [ ] Disconnect button removes tokens and updates UI

---

## Sprint 6: Billing & Revenue `🚫 blocked`

> **Blocked:** Waiting on product team to unblock Stripe integration.
> **Impact:** 🔴 Critical — Revenue unlock
> **Estimate:** 3-4 days | **Remaining:** 3-4 days

### 6.1 Stripe Integration `🚫 blocked — needs product approval + STRIPE_SECRET_KEY env var`
- Checkout sessions for Pro/Elite
- Customer portal for plan changes
- Webhook handler for subscription lifecycle events
- **Files:** `src/lib/stripe/*`, `src/app/api/webhooks/stripe/route.ts`
- **Estimate:** 2 days
- **Prerequisites:**
  - Product team approves billing launch
  - Stripe account created and keys obtained
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ELITE_PRICE_ID` configured
  - Webhook endpoint accessible from Stripe (requires deployed URL or Stripe CLI for local)
- **Evidence when done:**
  - [ ] Checkout redirects to Stripe and returns to `/billing?success=true`
  - [ ] Webhook updates `app_users.tier` on successful subscription
  - [ ] Portal allows plan change and cancellation

### 6.2 Billing Page `🚫 blocked — depends on 6.1`
- Current plan display, upgrade/downgrade buttons
- Billing history from Stripe events in `billing_events` table
- **Estimate:** 1 day
- **Prerequisites:** Sprint 6.1 done
- **Evidence when done:**
  - [ ] Current plan displayed with Badge
  - [ ] Upgrade button redirects to Stripe Checkout
  - [ ] Invoice history populated from `billing_events`

### 6.3 Admin Revenue Dashboard `🚫 blocked — depends on 6.1`
- MRR, active sub counts, churn rate, LTV
- AI cost tracking from `ai_usage` table
- Net margin calculation
- **Estimate:** 1 day
- **Prerequisites:** Sprint 6.1 done + `billing_events` populated
- **Evidence when done:**
  - [ ] MRR calculated from active subscriptions
  - [ ] AI costs aggregated from `ai_usage`
  - [ ] Net margin = revenue - AI costs - infra estimate

---

## Sprint 7: Polish & Launch Readiness

> **Goal:** Final mile to production.
> **Impact:** 🟢 Launch readiness
> **Estimate:** 3-4 days | **Remaining:** 3-4 days

### 7.1 React Query Adoption `⬜ todo`
- Replace direct fetches with React Query on all list views (jobs, contacts, outreach, reminders)
- Optimistic updates for CRUD operations
- **Estimate:** 1.5 days
- **Prerequisites:** None (refactoring existing code)
- **Evidence when done:**
  - [ ] All list views use `useQuery` / `useMutation`
  - [ ] Deleting an item removes it instantly (optimistic) then confirms server-side

### 7.2 Mobile Responsive Pass `⬜ todo`
- Test and fix all pages at 375px, 768px, 1024px breakpoints
- Mobile navigation (hamburger menu or bottom nav)
- Sidebar collapses to overlay on mobile
- **Estimate:** 1 day
- **Prerequisites:** None
- **Evidence when done:**
  - [ ] All pages tested at 3 breakpoints
  - [ ] No horizontal scroll on mobile
  - [ ] Navigation accessible on all sizes

### 7.3 SEO Optimization `⬜ todo`
- Meta tags + OG images for landing, login, register
- Sitemap generation (`next-sitemap`)
- Performance audit (Core Web Vitals via Lighthouse)
- **Estimate:** 0.5 day
- **Prerequisites:** None
- **Evidence when done:**
  - [ ] Lighthouse score > 90 for landing page
  - [ ] OG image renders in social previews
  - [ ] Sitemap accessible at `/sitemap.xml`

### 7.4 Template Enhancements `⬜ todo`
- Placeholder insertion UX ({company}, {role}, {name})
- Copy-to-clipboard with Sonner toast confirmation
- **Estimate:** 0.5 day
- **Prerequisites:** None (enhancing existing templates CRUD)
- **Evidence when done:**
  - [ ] Clicking placeholder inserts it at cursor
  - [ ] Copy button copies rendered template + shows toast

### 7.5 Production Deployment Validation `⬜ todo`
- End-to-end smoke test on EC2
- CI/CD pipeline verified (push to main → deploy)
- CloudWatch monitoring configured (CPU > 80%, disk > 85% alerts)
- SSL certificates confirmed (auto-renewal via Certbot)
- **Estimate:** 1 day
- **Prerequisites:**
  - EC2 instance provisioned
  - Docker Compose file validated
  - Nginx config deployed
  - All env vars set on server
- **Evidence when done:**
  - [ ] `https://hirecanvas.in` loads landing page
  - [ ] `/api/health` returns `{ status: 'ok', db: true, redis: true }`
  - [ ] GitHub Actions deploy succeeds end-to-end
  - [ ] CloudWatch alarm fires on test threshold

---

## Dependency Graph

```
Sprint 1A (LLM Router + Sanitizer + Extraction Worker)
  ├── Sprint 1B (Cover Letter, Interview Coach)
  ├── Sprint 2 (Nudges, Status Detection, Digest)
  ├── Sprint 3.3 (ATS Checker)
  └── Sprint 4.4 (Weekly Strategy Report)

Sprint 3.1, 3.2 — No dependencies (can start anytime)
Sprint 4.1, 4.2, 4.3 — No dependencies (can start anytime)
Sprint 5 — No dependencies (can run in parallel with Sprint 3-4)
Sprint 6 — Blocked on product decision
Sprint 7 — No hard dependencies (polish/refactor)
```

**Parallelizable work while Sprint 1A is in progress:**
- Sprint 3.1 Job Detail Drawer (pure UI, no AI needed)
- Sprint 3.2 CSV Import/Export (pure data, no AI needed)
- Sprint 4.1-4.3 Analytics (pure SQL aggregation, no AI needed)
- Sprint 5.x Settings hardening (pure auth/settings, no AI needed)

---

## Summary — Estimated Effort

| Sprint | Focus | Days | Status | Impact |
|--------|-------|------|--------|--------|
| 1A | AI Core (Router + Sanitizer + Extraction) | 4 | ⬜ todo | 🔴 Critical |
| 1B | AI Features (Cover Letter + Coach) | 2.5 | ⬜ todo | 🟡 Medium |
| 2 | Automation & Nudges | 3-4 | ⬜ todo | 🔴 High |
| 3 | Application Depth | 3-4 | ⬜ todo | 🟡 Medium |
| 4 | Analytics & Insights | 3 | ⬜ todo | 🟡 Medium |
| 5 | Settings & Security | 2-3 | ⬜ todo | 🟡 Medium |
| 6 | Billing & Revenue | 3-4 | 🚫 blocked | 🔴 Critical |
| 7 | Polish & Launch | 3-4 | ⬜ todo | 🟢 Launch |
| **Total** | | **24-29 days** | | **Complete premium SaaS** |

---

## Definition of Done — Measurable Checks

| # | Check | How to verify | Sprint |
|---|-------|---------------|--------|
| 1 | All routes in PROJECT_STATE.md exist | `find src/app -name 'page.tsx'` lists all claimed routes | 7 |
| 2 | No placeholder-only pages remain | Manual review: every page fetches real data from Supabase | 7 |
| 3 | Health endpoint checks DB + Redis + queue | `curl /api/health` returns `{ db: true, redis: true, queue: { depth: N } }` | 7.5 |
| 4 | LLM failover chain works end-to-end | Test: disable Gemini key → Claude handles request → verify in `ai_usage` | 1A |
| 5 | At least one AI feature works in production | Cover letter or extraction produces correct output with real API key | 1A/1B |
| 6 | Mobile responsive at all breakpoints | Lighthouse mobile score > 85, no horizontal scroll at 375px | 7.2 |
| 7 | TypeScript compiles with zero errors | `npx tsc --noEmit` exits 0 | Every sprint |
| 8 | PROJECT_STATE.md matches code reality | Session-end audit: Section 14 reflects actual state, no false claims | Every sprint |
| 9 | IMPLEMENTATION_GAPS.md is current | All ✅ items have evidence, all ⬜ items have accurate estimates | Every sprint |
