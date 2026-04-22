# IMPLEMENTATION_GAPS.md

Last updated: 2026-04-21

The previous multi-sprint execution board lived here. **It has been retired** so this repo stays easy to maintain. Use GitHub issues or your product roadmap for new work.

## What is already implemented (high level)

- **Stripe:** Checkout (`src/app/api/checkout/route.ts`), customer portal (`src/app/api/portal/route.ts`), signed webhooks (`src/app/api/webhooks/stripe/route.ts`), helpers (`src/lib/stripe/client.ts`, `src/lib/stripe/webhooks.ts`).
- **Billing UI:** Live plan and history from Supabase (`src/app/(dashboard)/billing/page.tsx`, `src/actions/billing.ts`).
- **Ledger:** `billing_events` migration `supabase/migrations/036_billing_events.sql`.
- **Admin metrics:** Revenue snapshot from billing + AI usage (`src/app/api/admin/overview/route.ts`, `src/app/(dashboard)/admin/page.tsx`).

## What you still do outside the repo

- **Production validation:** Deployed host, SSL, env on the server, smoke test (register → Gmail → sync → jobs). CI/CD and health checks are in code; execution needs your infrastructure.
- **Stripe Dashboard:** Products/prices, webhook URL to `/api/webhooks/stripe`, and live or test keys in env (see `.env.example`).

## Optional follow-ups (not tracked in this file)

Examples: Google Calendar sync, Chrome extension, PWA, university tier, outbound Zapier-style webhooks, public stats profile, deeper mobile polish, auth-gated E2E in CI (`E2E_USER_EMAIL` / `E2E_USER_PASSWORD`). Track these wherever you plan sprints.
