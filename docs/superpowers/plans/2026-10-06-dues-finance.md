# Dues & Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members-only dues tracking with invoices and a Kassier-restricted finance page.

**Architecture:** Dues engine in the Hono worker (yearly periods, invoice states, `requireKassier` gate), one new MPA page reusing the existing card/table/form view patterns, bank details isolated in a single data module pending real values.

**Tech Stack:** Vanilla JS + Vite multi-page app, Hono on Cloudflare Workers, D1, vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-10-06-dues-finance-design.md`

## Global Constraints

- Finance endpoints deny everyone without `is_kassier`, admins included: 401 logged out, 403 `Kassier only.` otherwise.
- Due rule: member owes for year Y iff `Y > year(created_at)` (join year free); yearly default is 1200 cents with reason `Mitgliedsbeitrag {year}`.
- Invoice UI language is German; amounts format Euro de-AT (`12,00 €`).
- All user strings through existing `esc()`; API via existing `api()` client; 401 → `/login/`.
- Bank details live only in `src/data/club.js` (frontend) + one worker constant; until provided, a clearly-labeled `REPLACE_WITH_IBAN` placeholder is used.
- New MPA page goes in the `pages` array in `vite.config.js`.

## Review Focus

- Admin without the flag opening any finance endpoint gets 403, not data — pinned in Task 2 tests.
- Paying an already-paid invoice gives 409, never double-marks — pinned in Task 2 tests.
- Generate-year run twice creates 0 new invoices the second time — pinned in Task 2 tests.
- Logged-out visit to `/finanzen/` redirects to `/login/`, never renders numbers — pinned in Task 3 tests.
- An invoice for a deleted/unknown user is rejected at creation with 400 — pinned in Task 2 tests.

---

### Task 1: Database schema — flag plus invoices table

**Files:**
- Modify: `workers/schema.sql`
- Test: sqlite apply via the existing `C:/Users/User/AppData/Local/Temp/opencode/check-schema.py` pattern (or equivalent one-off script)

**Interfaces:**
- Consumes: nothing.
- Produces: `users.is_kassier INTEGER DEFAULT 0`; `invoices` table with the spec's exact columns; `idx_invoices_user`.

- [ ] **Step 1: Add the column and table to `workers/schema.sql`**

Append exactly:
```sql
ALTER TABLE users ADD COLUMN is_kassier INTEGER DEFAULT 0;
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  paid_method TEXT,
  marked_by TEXT
);
CREATE INDEX idx_invoices_user ON invoices(user_id);
```

- [ ] **Step 2: Validate schema + seed apply cleanly**

Run a sqlite `:memory:` script applying `workers/schema.sql` then `workers/seed.sql`.
Expected: success, `invoices` in table list, seed rows insert.

- [ ] **Step 3: Commit**

```bash
git add workers/schema.sql
git commit -m "DB: kassier flag and invoices table"
```

### Task 2: Worker — flag plumbing, gate, invoice endpoints

**Files:**
- Modify: `workers/src/index.js`, `workers/src/auth.js`
- Modify: `workers/test/dues.test.js` (new file; vitest run from `workers/`, per the ledgered ruling that root vitest only includes `tests/**`)

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: `requireKassier` middleware; `GET /api/invoices/me`, `GET /api/invoices[?status&?year]`, `POST /api/invoices`, `POST /api/invoices/generate`, `PATCH /api/invoices/:id/pay`, `PATCH /api/invoices/:id/cancel`, `PATCH /api/users/:id/kassier`; `publicUser` shape extended with `is_kassier`; invoice JSON `{ id, user_id, user_name, year, amount_cents, reason, status, created_at, paid_at, paid_method }`.

- [ ] **Step 1: Write the failing tests**

Create `workers/test/dues.test.js` with a `fakeDb` routing by SQL string (established pattern in `workers/test/api.test.js`) covering: anon 401 on every finance endpoint; member 403; **admin-without-flag 403 on every finance endpoint**; create defaults (current year, 1200, `Mitgliedsbeitrag {year}`); create validations (unknown user 400, amount < 1 400, year out of 2000–2100 400); pay-twice 409; cancel-then-pay 409; generate creates only owing members (skips join-year and already-invoiced) and second run creates 0; kassier grant as admin 200, as member 403.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --dir workers vitest run test/dues.test.js`
Expected: FAIL (no such routes/helpers).

- [ ] **Step 3: Implement in `workers/src/index.js` / `workers/src/auth.js`**

Extend the `getSessionUser` select with `u.is_kassier` and `publicUser` with `is_kassier: !!u.is_kassier`. Add exported `requireKassier` next to `requireAdmin` (401 logged out, 403 `Kassier only.`). Add the seven endpoints with the spec's exact shapes, messages, and status codes; amounts in cents; Euro formatting stays frontend-only. Owing check for generate: `year > CAST(strftime('%Y', created_at) AS INTEGER)` and no existing non-cancelled yearly-template invoice for that user/year (match `reason = 'Mitgliedsbeitrag {year}'`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir workers vitest run test/dues.test.js`, then full `pnpm --dir workers vitest run`.
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add workers/src/index.js workers/src/auth.js workers/test/dues.test.js
git commit -m "API: dues engine with kassier gate"
```

### Task 3: Frontend — Finanzen page, nav gating, club data

**Files:**
- Create: `finanzen/index.html`, `src/pages/finanzen.js`, `src/views/finanzen.js`, `src/data/club.js`
- Modify: `vite.config.js`, `src/layout.js`
- Test: `tests/finanzen.test.js` (new; jsdom)

**Interfaces:**
- Consumes: Task 2 endpoints and `is_kassier` on `/api/me`; `esc`, `api()`, `mountLayout` + 401-redirect pattern.
- Produces: `/finanzen/` route; `data-kassier-link` nav rule; `CLUB` bank-detail export consumed by the invoice view.

- [ ] **Step 1: Write the failing tests**

Create `tests/finanzen.test.js` covering `renderMyInvoices` (Euro `12,00 €`, status text, invoice link), `renderAllInvoices` (member names, filter selects for status/year), `renderInvoiceDetail` (club name, `REPLACE_WITH_IBAN` placeholder from `CLUB`, reference `{year}-{user_id}`), `renderInvoiceForm` (prefilled current year, 12.00, template reason), and the 403 view (`Kassier only.`). Also a nav test: `refreshAuthLink`-style rule shows `[data-kassier-link]` only when `me.is_kassier` is true.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node ./node_modules/vitest/vitest.mjs run tests/finanzen.test.js`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement the views, page, nav rule, club data**

`src/data/club.js` exports `CLUB = { name: 'Archer FilmStudios', iban: 'REPLACE_WITH_IBAN', holder: 'REPLACE_WITH_HOLDER', bank: '' }`. Views mirror the members/projects render style with German labels (`Offen`, `Bezahlt`, `Storniert`, `Als bezahlt markieren (bar/Überweisung)`, `Rechnung erstellen`, `Jahresrechnungen erzeugen`). Page: `mountLayout('finanzen')`; fetch me first — non-kassier members see only their invoices (via `/api/invoices/me`), kassier sees all + forms; any 401 → `/login/`; any 403 → the `Kassier only.` view. `vite.config.js` pages array gains `'finanzen'`; `NAV` gains `['/finanzen/', 'Finanzen', true]` plus the flag rule (hidden unless `is_kassier`, independent of the private-link rule).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node ./node_modules/vitest/vitest.mjs run tests/finanzen.test.js`, then full `pnpm vitest run` equivalent used in this repo (`node ./node_modules/vitest/vitest.mjs run`).
Expected: PASS, no regressions.

- [ ] **Step 5: Run build**

Run: `node ./node_modules/vite/bin/vite.js build`.
Expected: exit 0 with `dist/finanzen/index.html` in output.

- [ ] **Step 6: Commit**

```bash
git add finanzen/index.html src/pages/finanzen.js src/views/finanzen.js src/data/club.js tests/finanzen.test.js vite.config.js src/layout.js
git commit -m "Finanzen page with kassier gating"
```