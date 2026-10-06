# Dues & Finance (Kassier) — Design Spec

Date: 2026-10-06
Status: design approved, pending spec review
Approach: A — dues engine + invoice documents (no external payment provider)

## Goal

Track yearly membership dues (first year free, then 12 €/year), issue
invoices (yearly template + free manual invoices with variable amount
and reason), let members see/pay-by-transfer info, and let the Kassier
tick off incoming money (cash or transfer). The finance page is visible
only to finance-authorized users — admins without the flag get 403.

## Locked decisions

- Invoice-first, no online payment (Stripe rejected by vote).
- Manual invoices: any amount, any reason; yearly template defaults to
  current year, 1200 cents, reason `Mitgliedsbeitrag {year}`; date/year
  auto-filled, editable before creation.
- Due rule: calendar years; a member owes for year Y iff
  `Y > year(created_at)` (join year always free).
- Finance access is a grantable `users.is_kassier` flag (admins grant /
  revoke from the board UI). Initial holders: Sebastian Krumböck and
  Klemens Ruhrhofer, set via SQL. `requireKassier` denies everyone
  without the flag, admins included.
- Bank details (IBAN, holder, bank) arrive later and plug into one
  shared spot: `src/data/club.js` (frontend) + worker constant.
- Invoice UI language: German.

## Data model

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

Prod migration: the two statements above via `wrangler d1 execute`.
Fresh DBs via `schema.sql`. No backfill (history starts at deploy).

## API (`workers/src/index.js`)

- `requireKassier(c, next)`: 401 when logged out, 403
  `Kassier only.` when `!session.is_kassier`. (Session row must carry
  `is_kassier`; extend the `getSessionUser` join accordingly — it
  currently selects `u.is_admin` only.)
- `GET /api/invoices/me` (`requireUser`): own invoices, newest first.
- `GET /api/invoices` (`requireKassier`): all, optional
  `?status=` / `?year=` filters, with member names.
- `POST /api/invoices` (`requireKassier`): `{ user_id, year?,
  amount_cents?, reason? }`, defaults current year / 1200 /
  `Mitgliedsbeitrag {year}`; validates user exists, amount ≥ 1,
  year 2000–2100. Returns 201.
- `POST /api/invoices/generate` (`requireKassier`): body `{ year? }`
  (default current year); creates the 1200-cent yearly invoice for
  every member owing for that year (`year > year(created_at)`) that has
  no open/paid yearly invoice yet. Returns `{ created: n }`. Idempotent.
- `PATCH /api/invoices/:id/pay` (`requireKassier`): `{ method:
  cash|transfer }`; only from `open`; sets `paid_at`, `marked_by`.
  404 unknown id, 409 unless open.
- `PATCH /api/invoices/:id/cancel` (`requireKassier`): only from
  `open`. 404/409 as above.
- `PATCH /api/users/:id/kassier` (`requireAdmin`): `{ is_kassier:
  0|1 }`. Board UI toggle next to the admin toggle.
- Validation messages in the existing style (`Unknown member.`,
  `Invalid amount.`, `Already paid.`).

## Frontend

- New `finanzen/index.html` + `src/pages/finanzen.js` +
  `src/views/finanzen.js`; `vite.config.js` pages entry; private nav
  entry visible only with the flag (extend `refreshAuthLink` with a
  `data-kassier-link` rule driven by `me.is_kassier` from `/api/me` —
  which must therefore expose `is_kassier` in its public-user shape).
- Member view: my invoices table (year, reason, amount, status,
  invoice action) + invoice detail with club name, IBAN placeholder,
  amount, reason, year, payment reference (`{year}-{user_id}`), and a
  print stylesheet-friendly layout.
- Kassier view: all invoices with status/year filters, per-row Mark
  paid (cash/transfer) + Cancel, create form (member select, year,
  amount €, reason — prefilled with the yearly template), Generate-year
  button with result count.
- Amounts formatted as Euro (`12,00 €`, de-AT).
- All user strings through `esc()`; 401 → `/login/`; 403 shows
  `Kassier only.`

## Permissions matrix

| Action | Anonymous | Member | Admin (no flag) | Kassier |
|---|---|---|---|---|
| View own invoices | login redirect | yes | yes (own) | yes |
| View all / create / generate | — | 403 | 403 | yes |
| Mark paid / cancel | — | 403 | 403 | yes |
| Grant/revoke flag | — | 403 | yes (board UI) | no |

## Testing

- Worker `app.request` pins: anon 401s, member 403s, **admin-without-
  flag 403 on every finance endpoint** (the key regression test),
  validation 400s, pay-twice 409, generate idempotency (second run
  creates 0), yearly default reason/amount.
- Frontend vitest: invoice table rendering, Euro formatting, template
  prefill, flag-gated nav visibility.
- Full suites + build + dry-run + eslint; schema validated via sqlite.

## Rollout

1. Merge + push (builds `/finanzen/`).
2. Prod migration (ALTER + CREATE TABLE).
3. `UPDATE users SET is_kassier = 1 WHERE email IN
   ('sebastian.krumboeck@gmail.com', '<klemens-email>')` (Klemens's
   address confirmed at execution time).
4. Plug in IBAN details when provided (single spot, follow-up commit).

## Out of scope

Online/card payment, email delivery of invoices (in-app only; worker
has no mail service), payment reminders automation, German site-wide
translation (separate sub-project F), dunning/escalation workflows.
