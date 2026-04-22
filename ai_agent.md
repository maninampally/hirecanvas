# HireCanvas — AI agent design note
# Extension: .d (design fragment; rename to .md if your tools prefer)
# Last updated: 2026-04-21

## 1. Did we build an AI agent?

No — not in the “autonomous agent” sense (plan → act → observe → repeat; tool use;
long-lived memory; open-ended business Q&A).

What exists today is **deterministic AI integration**:
- `src/lib/ai/llmRouter.ts` — provider order, health/cooldown, fallback (Gemini → Claude → OpenAI).
- Task modules: `interviewCoach.ts`, `coverLetter.ts`, `atsChecker.ts`, job email
  extraction via `src/lib/extraction/processExtractionJob.ts`, etc.
- Each flow is **fixed**: build prompt → call router once (or bounded retries) → parse JSON / apply rules.

That is “AI-assisted features,” not an agent runtime.

---

## 2. Why we might NOT build a full agent (yet)

- **Product scope:** HireCanvas is a job-search command center; shipped value is
  pipeline, Gmail sync, templates, billing — not a general copilot.
- **Safety & trust:** Agents that call tools (DB, email send, Stripe) need strict
  authz, auditing, and human confirmation; higher incident cost than one-shot LLM tasks.
- **Cost & latency:** Multi-turn loops and large context windows multiply tokens;
  extraction and coaching are already bounded workloads.
- **Reliability:** Single-purpose prompts + JSON contracts are easier to test
  (see `llmRouter.test.ts`, `sanitizer.test.ts`) than emergent agent behavior.
- **Compliance:** Email and PII-heavy data favor minimal retention and explicit
  flows over open-ended agent memory.

---

## 3. What changes if we DO build an agent?

**Upside**
- Natural-language “ask my search” across jobs, contacts, reminders, offers.
- Proactive suggestions (“you haven’t followed up on X”) using the same data
  the dashboard already has, but with richer reasoning chains.
- Fewer bespoke screens if one conversational surface can compose actions.

**Downside / requirements**
- Tool layer (read-only vs write tools), confirmation for destructive actions,
  rate limits, prompt injection hardening, tracing, and eval harness.
- Ongoing ops: model drift, regression tests on tool-calling, cost dashboards.

---

## 4. Suggested architecture (if we add an agent later)

Layered structure that reuses today’s router and sanitization:

```
src/lib/ai/
  llmRouter.ts              # existing — keep as single “completion” primitive
  sanitizer.ts              # existing — all user/agent-bound text passes through

src/lib/ai/agent/           # new package (only if product approves)
  types.ts                  # AgentMessage, ToolCall, ToolResult, AgentState
  contextBuilder.ts         # Assemble allowed facts: user id, tier, date range caps
  tools/
    index.ts                # register tools + JSON schemas for the model
    jobsRead.ts             # list/search jobs (RLS-aligned queries)
    contactsRead.ts
    remindersRead.ts
    offersRead.ts
    # writes gated: e.g. createReminder — require explicit user flag + idempotency key
  executor.ts               # loop: model → tool_calls → run tools → feed results (max N steps)
  policies.ts               # max steps, token budget, which tools per tier
  audit.ts                  # log tool name + args hash + outcome (no raw secrets)

src/app/api/ai/agent/       # optional HTTP surface
  route.ts                   # POST: messages[] → stream or JSON (SSE optional)

src/actions/aiAgent.ts      # optional server action wrapper with auth + rate limit
```

**Data flow (conceptual)**

1. Authenticated user sends question.
2. `contextBuilder` loads **scoped** summary (counts, recent entities), never full inbox.
3. Model may emit `tool_call` objects; `executor` runs only allowlisted tools with **same RLS
   rules** as the rest of the app (Supabase client as user).
4. Loop until answer or step/token cap; return final message + citations (job ids, etc.).

**Non-goals for v1 agent (recommended)**
- No autonomous outbound email send without explicit UI confirmation.
- No storing raw agent transcripts in public tables without retention policy.

---

## 5. With agent vs without (summary)

| Dimension              | Without agent (current)              | With agent                                      |
|------------------------|--------------------------------------|-------------------------------------------------|
| Interaction          | Forms, tables, fixed AI buttons      | Chat + optional tool use                        |
| Control flow          | App-defined steps                    | Model-proposed steps within guardrails          |
| Testing               | Prompt + JSON contract per feature   | Tool mocks, trajectory tests, eval sets         |
| Risk surface          | Smaller (bounded I/O)                | Larger (injection, tool abuse, over-sharing)    |
| Time to ship features | New UI + action per workflow         | New tool + policy; can reuse one shell          |
| Cost                  | Predictable per task                 | Variable (turns, context, tools)                |

---

## 6. Recommendation

Keep **task-specific AI** for high-stakes or structured outputs (extraction,
ATS, interview JSON). Add a **read-only “search my pipeline” agent** only if
product research shows demand; gate writes behind explicit user actions and
reuse `src/lib/security/rateLimit.ts` patterns for the new endpoint.

This file is documentation only; no runtime behavior depends on it.
