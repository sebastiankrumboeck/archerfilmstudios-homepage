# Shoot Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members who joined a project get one German email reminder ~48h before it starts, via a daily Cloudflare Cron Trigger.

**Architecture:** New `reminder_log` table dedupes sends per (project, start_at). Exported pure-ish core `sendShootReminders(env, now)` does all logic and is unit-tested; a thin `app.scheduled` attachment (keeps `export default app` so no test imports change) wires the cron; a manual `POST /api/projects/:id/remind` (admin) reuses the core for testing/resends.

**Tech Stack:** Hono worker, D1, Resend (existing `RESEND_API_KEY` secret, no new secrets), `[triggers] crons` in `workers/wrangler.toml`.

**Spec:** Conversation decision 2026-10-06 (no spec doc): daily 06:00 UTC run, 48h window, German member-facing copy, dedupe per (project, start_at), per-email failure isolation.

## Global Constraints

- TDD: failing test first, watched RED → GREEN, for every behavior.
- Workers tests run from `workers/` via `pnpm --dir workers vitest run`; root suite via `node ./node_modules/vitest/vitest.mjs run`.
- Follow existing worker idioms: `ok`/`fail` helpers, `uid`/`nowISO` from `auth.js`, `requireAdmin` gate, raw `fetch` to `https://api.resend.com/emails` with `Bearer ${env.RESEND_API_KEY}`.
- Member-facing email copy is German (invoices precedent).
- `esc()`-equivalent: email text is plain-text; never interpolate unescaped HTML (no HTML mail here).
- Never commit secrets; no new secrets needed.
- Exact SQL below is normative for the fake-DB contract style used in `workers/test/`.

## Review Focus

- Member joins AFTER the reminder run gets no mail (accepted by design; log key is per project+start, not per member — pinned by Task 1 late-joiner test).
- Project start time is edited after a reminder was sent (new `start_at` = new log key = reminder resends; accepted, avoids stale-time mail).
- Resend fails for one recipient mid-run (must not abort the run; failure counted, others still sent — pinned by Task 1 test).
- Cron fires twice concurrently (check-then-insert race can double-send; accepted at club scale — `reminder_log` PK at least prevents silent triple-sends on sequential reruns).
- `start_at` in the past but `end_at` in the future, i.e. multi-day shoot already running (window is start-based only, so no reminder; accepted — reminder is a "get ready" mail, not a "still running" mail).

---

### Task 1: Reminder core, cron wiring, manual endpoint

**Files:**
- Modify: `workers/schema.sql` (append tables at end)
- Modify: `workers/src/index.js` (constants + core + routes + scheduled attachment)
- Modify: `workers/wrangler.toml` (append `[triggers]`)
- Create: `workers/test/reminders.test.js`

**Interfaces:**
- Consumes: `uid`, `nowISO` from `./auth.js`; `ok`, `fail`, `requireAdmin` (existing in `index.js`).
- Produces: `export async function sendShootReminders(env, now)` where `env` is `{ DB, RESEND_API_KEY }`, `now` is an ISO datetime string; returns `{ projects: number, emails: number, failed: number }`. `app.scheduled` attached function (thin wrapper calling the core with `new Date().toISOString()`).

Exact SQL (normative):
- Upcoming: `SELECT * FROM projects WHERE start_at > ? AND start_at <= ?` bound `(now, nowPlus48hISO)`.
- Dedupe check: `SELECT * FROM reminder_log WHERE project_id = ? AND start_at = ?`.
- Recipients: `SELECT u.email, u.name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.project_id = ?`.
- Log write: `INSERT INTO reminder_log (project_id, start_at, sent_at) VALUES (?, ?, ?)` bound `(project.id, project.start_at, nowISO())`.

Exact copy (normative, German):
- Subject: `Erinnerung: {title} – Archer FilmStudios`
- Body lines: `Hallo {name},`, ``, `am {start} findet {title} statt ({location}).`, ``, `Wir freuen uns auf dich!`, ``, `Archer FilmStudios`. `{start}` is the raw `start_at` ISO date part (`YYYY-MM-DD`) plus time (`HH:MM`) — no locale formatting (avoids timezone bugs).
- From: reuse existing `CONTACT_FROM` constant (`website@archerfilmstudios.com`).

Manual endpoint: `POST /api/projects/:id/remind`, `requireAdmin`; 404 unknown project; runs the core logic for that single project only (ignores the 48h window, still writes the log row); returns `ok(c, { projects, emails, failed })`.

Cron: append to `workers/wrangler.toml`:
```toml
[triggers]
crons = ["0 6 * * *"]
```

- [ ] **Step 1: Write the failing test** in `workers/test/reminders.test.js`:
```js
import { describe, expect, it, vi } from 'vitest';
import app, { sendShootReminders } from '../src/index.js';
// fakeDb routes the four normative SQL shapes above to canned rows;
// fetch stubbed per-test. Tests:
it('reminds joined members of shoots starting within 48h'); // two members → 2 fetch calls, subjects contain title, log INSERT ran
it('skips shoots outside the window and already-logged shoots'); // far-future + logged projects → { projects: 0, emails: 0 }
it('a member joining after the run gets no mail on rerun'); // log row present → second call sends 0 even with a new member row
it('an edited start time counts as a new shoot'); // log row for old start_at → new start_at still sends
it('one failing recipient does not abort the run'); // fetch rejects once → { emails: 1, failed: 1 }
it('manual remind endpoint is admin-only and writes the log'); // member session → 403; admin → 200 + INSERT seen
it('app exposes a scheduled handler'); // expect(typeof app.scheduled).toBe('function')
```
- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir workers vitest run test/reminders.test.js`
Expected: FAIL (no `reminder_log` table, no `sendShootReminders`, no `/remind` route, no `app.scheduled`).

- [ ] **Step 3: Implement** — append schema SQL, add core + routes + `app.scheduled = (event, env, ctx) => ctx.waitUntil(sendShootReminders(env, new Date().toISOString()))` in `workers/src/index.js`, append `[triggers]`, per-email try/catch inside the send loop (count `failed`, continue).
- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir workers vitest run` (full workers suite, no regressions)
Expected: all PASS.

- [ ] **Step 5: Run root suite, build, lint**

Run: `node ./node_modules/vitest/vitest.mjs run`, `node ./node_modules/vite/bin/vite.js build`, `node ./node_modules/eslint/bin/eslint.js workers/src/index.js workers/test/reminders.test.js`
Expected: all PASS / exit 0.

- [ ] **Step 6: Commit**

```bash
git add workers/schema.sql workers/src/index.js workers/wrangler.toml workers/test/reminders.test.js
git commit -m "Shoot reminders via daily cron with resend endpoint"
```

**Post-deploy note for the human:** run the new `reminder_log` CREATE TABLE + index against prod D1 once; cron activates on next deploy.
