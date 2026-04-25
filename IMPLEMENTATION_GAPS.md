# HireCanvas — Pending Tasks

**Last updated:** 2026-04-24

---

## 1. P1 — Revenue & growth

### 1.1 Replace fake trust signals
`MARKETING_TRUST_CHIPS` = "Secure authentication / Gmail OAuth / Pipeline-first workflow" — not trust signals. Replace after beta with real testimonial or real user count. Needs real content.

---

## 2. Manual actions required

- [ ] **Rotate all secrets** — Supabase service role, Anthropic, OpenAI, Gemini, Google OAuth client secret, Stripe secret, `TOKEN_ENCRYPTION_KEY`, `SYNC_CRON_SECRET`. Delete commented `DB_PASS` from `.env.local`.
- [ ] **Stripe live-mode test** — Create Pro/Elite products in Stripe, point webhook to production URL, test real card charge end-to-end, confirm `app_users.tier` flips.
- [ ] **Google OAuth verification** — Submit `gmail.readonly` scope for Google brand verification + CASA Tier 2 audit (~$2–4k, 3 weeks elapsed). Cap new users at 100 until approved.
- [ ] **ProductHunt launch** — After P0s ship.

---

---

## 4. P3 — Scale / future

- **Mobile PWA pass** — `manifest.json`, audit core views for mobile overflow.
- **Extraction corrections table** — `extraction_corrections(original_json, user_corrected_json)`. After 500 rows → prompt eval set.
- **Company canonicalization** — "Meta" ≠ "Meta Platforms". Add `company_canonical` column or `companies` table.
- **Scale prep** (at ~5k users) — Upstash/ElastiCache Redis, separate EC2 for workers, read replica.

---

## Architecture decisions

- Stay on Next.js. Don't rewrite in Python.
- Gemini 2.x Flash as primary. Claude Haiku for Elite rescue.
- Teal only — no indigo, violet, or purple anywhere.
- Annual plans live from day 1.
- India is the first market. Pricing in USD.
- All AI calls via BullMQ — never synchronous in API routes.
- Tier limits always read from `tier_config` table — no hardcoding.

---

## Anti-patterns to avoid

1. `(window as any)` — use proper type interfaces.
2. `catch(e: any)` — use `catch(e)` + `instanceof Error` narrowing.
3. `setState` calls mid-effect without `eslint-disable` comment.
4. Single-word Gmail subject queries — quoted phrases only.
5. Synchronous AI calls in API routes.
6. Hardcoded tier checks — use `tier_config`.
