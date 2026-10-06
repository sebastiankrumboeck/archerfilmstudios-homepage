# Schnuppern Trial Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interested locals sign up for a trial meetup with name + email (no full membership), and the board gets notified and can track who was contacted.

**Architecture:** Public `POST /api/trial-signups` stores the lead *first*, then notifies the board via the existing Resend setup (mirrors the invoices pattern: record kept even if mail fails, result reported). Admin `GET` + `PATCH` endpoints manage the list. Public `/schnuppern/` page with the form (mirrors `/contact/` shell: `schnuppern/index.html`, `src/pages/schnuppern.js`, `src/views/schnuppern.js`, NAV entry, `vite.config.js` pages array). Admin list UI on the board page.

**Tech Stack:** Hono worker, D1, Resend (existing `RESEND_API_KEY`, notify to existing `CONTACT_TO`), vanilla JS frontend.

**Spec:** Conversation decision 2026-10-06 (no spec doc): fields name + email + optional note; honeypot spam guard (mirrors `/api/contact`); duplicate emails allowed (same person may retry — no 409); notify mail in German to the board with reply-to sender; admin marks contacted; page copy English with German title "Schnuppern" (site language precedent).

## Global Constraints

- TDD: failing test first, watched RED → GREEN, for every behavior.
- Workers tests run from `workers/` via `pnpm --dir workers vitest run`; root suite via `node ./node_modules/vitest/vitest.mjs run`.
- Follow existing worker idioms: `ok`/`fail` helpers, `uid`/`nowISO`, `requireAdmin` gate, `isEmail` validator, Resend `fetch` pattern with `Bearer ${env.RESEND_API_KEY}`.
- Frontend: `esc()` every user-controlled string; `api()` client; inline `[data-status]` messaging (contact-page pattern in `src/views/contact.js`).
- Exact SQL below is normative.

## Review Focus

- Resend is down at signup (lead must still be stored: 201 with `email: { sent: false }`, invoices precedent — pinned by Task 1 test).
- Spam bot fills the honeypot (silent 200, nothing stored, no mail — pinned by Task 1 test).
- Same email signs up twice (allowed, two rows, two notifications — pinned by Task 1 test).
- Non-admin reads or flips the trial list (403 on both endpoints — pinned by Task 1 tests).
- Note field with 5KB of HTML/JS (length-capped at 1000 chars, rendered only via `esc()`/`textContent` — pinned by Task 3 test).

---

### Task 1: Trial signup endpoints + board notification

**Files:**
- Modify: `workers/schema.sql` (append at end)
- Modify: `workers/src/index.js` (routes)
- Create: `workers/test/trial.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`, `requireAdmin`, `uid`, `nowISO`, `isEmail`, `CONTACT_TO` (all existing in `index.js`).
- Produces: `POST /api/trial-signups` (public; `{ name, email, note?, website? }` → honeypot silent 200; validate name ≤100, `isEmail`, note ≤1000 (optional); stores row; notifies board; 201 `{ signup: { id, name, email, note, created_at, contacted: 0 }, email: { sent: boolean, error? } }`), `GET /api/trial-signups` (requireAdmin; `{ signups }` newest first), `PATCH /api/trial-signups/:id` (requireAdmin; `{ contacted: 0|1 }`; 404 unknown).

Exact schema (normative):
```sql
CREATE TABLE trial_signups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  contacted INTEGER DEFAULT 0
);
```

Notify mail (normative, German): from existing `CONTACT_FROM`, to `CONTACT_TO`, `reply_to` = sender email, subject `[Schnuppern] {name}`, text lines `Name: {name}`, `Email: {email}`, ``, `Notiz: {note}` (or `Notiz: –` when empty).

- [ ] **Step 1: Write the failing test** in `workers/test/trial.test.js`:
```js
it('valid signup stores the lead and notifies the board'); // fetch stubbed → 201, signup shape above, Resend body to CONTACT_TO with reply_to sender
it('signup is kept when Resend fails'); // fetch 500 → still 201, email.sent === false
it('honeypot succeeds silently'); // website set → 200, no fetch, no INSERT (hook prepare to assert)
it('rejects bad input with 400'); // empty name, invalid email, 1001-char note
it('duplicate emails create two rows'); // same email twice → two different ids, 201 both times
it('list and contacted-toggle are admin-only'); // member session → 403 both; admin → 200; PATCH unknown id → 404
```
- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir workers vitest run test/trial.test.js`
Expected: FAIL (404s, no table/routes).

- [ ] **Step 3: Implement** schema + routes in the files above (store row before attempting mail; mail failure only affects the `email` field of the 201 response).
- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir workers vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/schema.sql workers/src/index.js workers/test/trial.test.js
git commit -m "Trial signup API with board notification"
```

**Post-deploy note for the human:** run the new `trial_signups` CREATE TABLE against prod D1 once.

---

### Task 2: Public Schnuppern page

**Files:**
- Create: `schnuppern/index.html` (copy `contact/index.html` shell, swap title/meta/heading/script to schnuppern)
- Create: `src/pages/schnuppern.js` (copy `src/pages/contact.js` wiring, call `renderTrialForm`)
- Create: `src/views/schnuppern.js`
- Create: `tests/schnuppern.test.js`
- Modify: `src/layout.js` (NAV: add `['/schnuppern/', 'Schnuppern', false]` next to the contact entry)
- Modify: `vite.config.js` (pages array gains `'schnuppern'`)

**Interfaces:**
- Consumes: Task 1 `POST /api/trial-signups`; `api`, `isValidEmail` (from `../lib/validators.js`), `esc` conventions.
- Produces: `renderTrialForm(el, { onSignup })` — fields Name (required, maxlength 100), Email (required, type email), Note (optional textarea, maxlength 1000, placeholder `Anything we should know? (optional)`), honeypot `website` (hidden, mirrors contact form); client-side validation message `Please fill in your name, a valid email address.`; success text `Thank you! We will invite you to the next Schnuppern meetup.` + `form.reset()`; server errors shown inline via `[data-status]`; `onSignup` called with the returned signup on success.

Page heading (normative): eyebrow `Try us out`, H1 `Schnuppern`, intro `Curious what Archer FilmStudios is like? Join a trial meetup — no membership, no commitment. Leave your name and email and we will invite you to the next one.`

- [ ] **Step 1: Write the failing test** in `tests/schnuppern.test.js` (mirror `tests/contact.test.js` structure):
```js
it('renders name, email and note fields');
it('submits to /api/trial-signups and shows the invite note'); // assert URL, method, JSON body { name, email, note, website: '' }, success text
it('blocks invalid email without sending');
it('shows server errors inline'); // stub 400 `Please enter a valid email address.` → [data-status] contains it
```
- [ ] **Step 2: Run test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run tests/schnuppern.test.js`
Expected: FAIL (no `renderTrialForm` export).

- [ ] **Step 3: Implement** view + page + shell + NAV + vite pages.
- [ ] **Step 4: Run tests to verify they pass**

Run: `node ./node_modules/vitest/vitest.mjs run tests/schnuppern.test.js tests/layout.test.js`
Expected: all PASS (layout suite covers the NAV count if it pins links — read it first; update pinned link lists if needed).

- [ ] **Step 5: Run build and lint**

Run: `node ./node_modules/vite/bin/vite.js build` (expect `dist/schnuppern/index.html` emitted), `node ./node_modules/eslint/bin/eslint.js src/views/schnuppern.js src/pages/schnuppern.js tests/schnuppern.test.js src/layout.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add schnuppern/index.html src/pages/schnuppern.js src/views/schnuppern.js tests/schnuppern.test.js src/layout.js vite.config.js
git commit -m "Public Schnuppern trial signup page"
```

---

### Task 3: Admin trial list on the board page

**Files:**
- Create: `src/views/trials.js`
- Create: `tests/trials.test.js`
- Modify: `src/pages/board.js` (add trial section to the admin management area; read the file first and follow its `load()` + render pattern)

**Interfaces:**
- Consumes: Task 1 `GET`/`PATCH /api/trial-signups`; `esc`, `api`.
- Produces: `renderTrialList(el, signups, { onContacted })` — each row shows name, email (`mailto:` link), note (if any), created date (`created_at` date part), and a toggle button (`Mark contacted` / `Mark new`) firing `onContacted(signup, { contacted: 1|0 })`; empty list shows `No trial signups yet.` Newest first (page passes API order through).

- [ ] **Step 1: Write the failing test** in `tests/trials.test.js`:
```js
it('rows show name, mailto email, note and date');
it('empty list states no trial signups');
it('contacted toggle fires onContacted with flipped flag'); // contacted: 0 row → onContacted(signup, { contacted: 1 }) and vice versa
it('escapes HTML in names and notes'); // `<img src=x onerror=…>` renders as text, no img element
```
- [ ] **Step 2: Run test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run tests/trials.test.js`
Expected: FAIL (no `renderTrialList` export).

- [ ] **Step 3: Implement** renderer + board page wiring (fetch list after users load; `onContacted` PATCHes then reloads the section; PATCH failure surfaces `err.message` inline following the page's existing error pattern).
- [ ] **Step 4: Run tests to verify they pass**

Run: `node ./node_modules/vitest/vitest.mjs run` then `pnpm --dir workers vitest run`
Expected: all PASS.

- [ ] **Step 5: Run build and lint**

Run: `node ./node_modules/vite/bin/vite.js build`, `node ./node_modules/eslint/bin/eslint.js src/views/trials.js src/pages/board.js tests/trials.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/views/trials.js tests/trials.test.js src/pages/board.js
git commit -m "Admin trial signup list with contacted toggle"
```
