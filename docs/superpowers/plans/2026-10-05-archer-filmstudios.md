# Archer FilmStudios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand to Archer FilmStudios and ship member accounts, projects with intensity calendar and join limits, admin roles, Vorstand, Contact, socials, on Workers + D1 + R2.

**Architecture:** Keep Vite SPA with hash-router; add Hono Worker in `workers/` backed by D1 + R2 avatars. Shared pure helpers in `src/lib/` reused by frontend rendering and tested with Vitest.

**Tech Stack:** Vite 8 + Tailwind v4, Vitest + jsdom, Hono on Cloudflare Workers, D1, R2, pnpm only.

**Spec:** `docs/superpowers/specs/2026-10-05-archer-filmstudios-design.md`

## Global Constraints

- Package manager is pnpm — all commands use `pnpm` (`pnpm test`, `pnpm run lint`, `pnpm run build`, `pnpm dev`, `pnpm dlx wrangler dev`).
- Keep Tailwind v4 theme in `src/input.css` (ink `#151412`, ink-soft `#211e1a`, paper `#f3eadc`, muted `#b7a99a`, amber `#dda85b`).
- Frontend routing is hash-router, no new framework.
- Intensity 1-5 maps to 1 emerald `#10b981`, 2 lime `#a3e635`, 3 amber `#dda85b`, 4 orange `#fb923c`, 5 red `#ef4444`.
- Contact is mailto-only to `hello@archerfilmstudios` — no backend send.
- Vorstand is static `src/data/vorstand.js` editable in code.
- Instagram canonical is `https://instagram.com/archerfilmstudios`; TikTok/YouTube are `@archerfilmstudios` placeholders.
- API envelope is `{ok, data|error}`; join limit enforced transactionally; `is_admin` persists until revoked; cannot revoke last admin self.

## Review Focus

- Register with duplicate email expects 409 "E-Mail bereits registriert", not 500 or silent overwrite.
- Joining a full project expects 409 "Projekt voll" with button showing `Voll (8/8)` disabled, not over-count.
- Revoking the last admin expects blocked with error, admin retained.
- Avatar upload >2MB or non-image expects 413 "Bild zu groß" / 415, not stored.
- Calendar project spanning month boundary expects bar clipped to visible month with correct day span, not dropped or overflowing.

---

### Task 1: Shared domain helpers (intensity, validation, calendar span)

**Files:**
- Create: `src/lib/intensity.js`
- Create: `src/lib/validators.js`
- Create: `src/lib/calendar.js`
- Test: `tests/domain.test.js`

**Interfaces:**
- Consumes: spec color map and date rules.
- Produces: `intensityColor(n: number) -> string`, `intensityLabel(n: number) -> string`, `canJoin(count: number, max: number|null, memberIds: string[], userId: string) -> {ok: boolean, reason: string|null}`, `isLastAdmin(admins: {id:string}[], userId: string) -> boolean`, `monthSpan(startISO: string, endISO: string, year: number, month1: number) -> {startDay: number, span: number}|null`, `buildMailto({to, subject, body}: object) -> string`.

- [ ] **Step 1: Write the failing test**

```js
// tests/domain.test.js
import { describe, expect, it } from 'vitest';
import { intensityColor } from '../src/lib/intensity.js';
// + validators canJoin, calendar monthSpan, buildMailto
describe('intensity', () => {
  it('maps 1-5 to spec hex colors', () => {
    expect(intensityColor(1)).toBe('#10b981');
    expect(intensityColor(5)).toBe('#ef4444');
  });
});
```

Expand to cover: `canJoin` full/duplicate/open, `isLastAdmin`, `monthSpan` spanning + outside-month null, `buildMailto` encodes subject/body.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/domain.test.js`
Expected: FAIL with "Failed to resolve import" / "not defined".

- [ ] **Step 3: Implement `intensityColor`, `intensityLabel` in `src/lib/intensity.js`**

Exact map: 1 `#10b981`, 2 `#a3e635`, 3 `#dda85b`, 4 orange `#fb923c`, 5 `#ef4444`; out-of-range throws `RangeError`.

- [ ] **Step 4: Implement validators in `src/lib/validators.js`**

Signatures above. `canJoin`: duplicate → `{ok:false, reason:'already'}`; `max!=null && count>=max` → `{ok:false, reason:'full'}`; else ok. `isLastAdmin`: true when admins length 1 and id matches.

- [ ] **Step 5: Implement calendar + mailto in `src/lib/calendar.js`**

`monthSpan` parses UTC ISO, computes overlap with month grid (1-based days); returns null when no overlap. `buildMailto` returns `mailto:hello@archerfilmstudios?subject=..&body=..` with `encodeURIComponent`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test tests/domain.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib tests/domain.test.js
git commit -m "feat: add shared domain helpers"
```

### Task 2: Workers backend — schema, seed, auth + users + avatar

**Files:**
- Create: `workers/package.json`
- Create: `workers/wrangler.toml`
- Create: `workers/src/index.js`
- Create: `workers/src/auth.js`
- Create: `workers/schema.sql`
- Create: `workers/seed.sql`

**Interfaces:**
- Consumes: `src/lib/validators.js` (`canJoin`, `isLastAdmin` logic mirrored in SQL checks).
- Produces: `POST /api/auth/register|login|logout`, `GET /api/me`, `GET /api/users`, `PATCH /api/users/:id`, `PATCH /api/users/:id/admin`, `POST /api/users/me/avatar`; D1 tables users/sessions; R2 `avatars/`.

- [ ] **Step 1: Write the failing API contract test**

Create `workers/test/api.test.js` (vitest, miniflare-or-mock D1) asserting: register validates email/password, duplicate → 409; login wrong → 401; `PATCH /:id/admin` by non-admin → 403; last-admin revoke blocked.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir workers test` (or `pnpm test workers/test/api.test.js`)
Expected: FAIL — app/routes missing.

- [ ] **Step 3: Implement `workers/schema.sql` + `seed.sql`**

Exact tables from spec (users, projects, memberships, sessions). Seed: 1 owner admin, 3 Vorstand placeholder users (`is_vorstand=1`), 3 sample projects covering intensities 1/3/5.

- [ ] **Step 4: Implement Hono app in `workers/src/index.js` + `auth.js`**

`auth.js` exports `hashPassword(pw: string) -> Promise<string>`, `verifyPassword(pw, hash) -> Promise<boolean>`, `requireUser(c)`, `requireAdmin(c)`. Cookie session `__Host-session`, httpOnly, 30d expiry. Envelope `{ok:true,data}` / `{ok:false,error}`. Avatar: accept jpg/png/webp <2MB, key `avatars/{userId}-{ts}.jpg`, store to R2 binding `AVATARS`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --dir workers test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add workers/
git commit -m "feat: add workers auth, users and avatar backend"
```

### Task 3: Workers backend — projects, join, calendar

**Files:**
- Modify: `workers/src/index.js`
- Test: `workers/test/projects.test.js`

**Interfaces:**
- Consumes: Task 2 `requireUser`, `requireAdmin`, D1 `projects`/`memberships`.
- Produces: `GET/POST /api/projects`, `PATCH/DELETE /api/projects/:id`, `POST/DELETE /api/projects/:id/join`, `GET /api/calendar?month=YYYY-MM`.

- [ ] **Step 1: Write the failing test**

```js
// workers/test/projects.test.js
it('blocks join when full and on duplicate', async () => {
  // seed project max_members=1, join as u1 → ok; join as u2 → 409 'Projekt voll'; re-join u1 → 409 'bereits dabei'
});
it('rejects project create by non-admin with 403', ...);
it('calendar filters by month overlap', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir workers test workers/test/projects.test.js`
Expected: FAIL — routes missing.

- [ ] **Step 3: Implement project CRUD + join in `workers/src/index.js`**

Validate `intensity` 1-5, `start_at<end_at`, `max_members>=1`. Create requires admin. Join: check existing membership → 409 `bereits dabei`; `SELECT COUNT(*) < max_members` in transaction → else 409 `Projekt voll`; insert membership. Leave: delete row, 404 if absent.

- [ ] **Step 4: Implement `GET /api/calendar?month=`**

Parse `YYYY-MM`, query `start_at <= monthEnd AND end_at >= monthStart`, return projects with member counts. 400 on bad month.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --dir workers test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add workers/src/index.js workers/test/projects.test.js
git commit -m "feat: add projects, join limits and calendar api"
```

### Task 4: Frontend shell — rebrand, router, API client, static data

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Create: `src/api/client.js`
- Create: `src/router.js`
- Create: `src/data/vorstand.js`
- Create: `src/data/socials.js`
- Test: `tests/router.test.js`

**Interfaces:**
- Consumes: Task 1 `buildMailto`, `intensityColor`.
- Produces: `api(path: string, opts?: object) -> Promise<any>` (cookie fetch, throws `ApiError{status, message}`), `parseRoute(hash: string) -> {name, params}`, `VORSTAND: {name, role, photo, bio}[]`, `SOCIALS: {instagram, tiktok, youtube}`.

- [ ] **Step 1: Write the failing router test**

```js
it('parses #/projects and #/calendar', () => {
  expect(parseRoute('#/projects').name).toBe('projects');
  expect(parseRoute('').name).toBe('home');
});
it('unknown route falls back to home', ...);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/router.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Rebrand `index.html` shell**

Replace title/meta/brand `Frame & Motion` → `Archer FilmStudios`; hero copy to `Cinematic Film & Photography — Travel / People / Worldwide`; contact mailto `hello@archerfilmstudios`; Instagram `https://instagram.com/archerfilmstudios`; nav links to `#/`, `#/members`, `#/projects`, `#/calendar`, `#/vorstand`, `#/contact`, `#/login`; add `<div id="app">` mount + offline retry banner slot. Keep existing Tailwind classes and menu bindings.

- [ ] **Step 4: Implement `src/api/client.js`, `src/router.js`, `src/data/*`**

`api()` uses `fetch` same-origin with `credentials:'include'`, parses `{ok,data,error}`, throws on `!ok`. `SOCIALS` exact: instagram verified URL, tiktok/youtube `@archerfilmstudios` placeholders. `VORSTAND` 3 placeholders with editable photo/bio.

- [ ] **Step 5: Wire router in `src/main.js`**

Keep `bindMenu`/`bindImageFallbacks`; add hashchange render dispatch to page views (views land in Task 5 — stub with home/members/projects/calendar/vorstand/contact/login/register sections for now, 401 → `#/login`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test tests/router.test.js`
Expected: PASS. Also `pnpm run lint`.

- [ ] **Step 7: Commit**

```bash
git add index.html src/main.js src/api src/router.js src/data tests/router.test.js
git commit -m "feat: rebrand shell with hash router and api client"
```

### Task 5: Frontend pages — members, projects, calendar, auth, vorstand, contact

**Files:**
- Create: `src/views/members.js`
- Create: `src/views/projects.js`
- Create: `src/views/calendar.js`
- Create: `src/views/auth.js`
- Create: `src/views/vorstand.js`
- Create: `src/views/contact.js`
- Modify: `src/main.js`
- Test: `tests/views.test.js`

**Interfaces:**
- Consumes: Task 4 `api`, router; Task 1 helpers (`intensityColor`, `monthSpan`, `buildMailto`).
- Produces: `renderMembers(el, state)`, `renderProjects(el, state)`, `renderCalendar(el, year, month)`, `renderAuth(el, mode)`, `renderVorstand(el)`, `renderContact(el)` — each `(HTMLElement, data) -> void`.

- [ ] **Step 1: Write the failing view tests**

```js
it('project card uses intensity color and join label Beitreten (3/8)', ...);
it('full project disables join with Voll (8/8)', ...);
it('admin sees + Neues Projekt form', ...);
it('contact form builds mailto to hello@archerfilmstudios', ...);
it('calendar bar spans start→end days', ...);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/views.test.js`
Expected: FAIL — views missing.

- [ ] **Step 3: Implement members + projects views**

Members grid: avatar, name, function, admin badge. Projects: card border/badge in `intensityColor`, intensity label, date range `de-DE`, `max_members`, member avatars, join button states `Beitreten (n/max)` / `Beigetreten ✓` / `Voll (max/max)` disabled; admin create/edit/delete form (title, description, intensity 1-5, location, start/end datetime-local, max_members); admin grant/revoke buttons on members (guard last-admin message).

- [ ] **Step 4: Implement calendar + auth + vorstand + contact views**

Calendar: month grid + bars spanning `monthSpan` in intensity color, tooltip, list view fallback for mobile/SR; month prev/next updates `?month=`. Auth: register fields name/function(datalist Kamera, Regie, Schnitt, Ton, Foto, Organisation, Schauspiel)/email/password/avatar, auto-login → `#/`; login form. Vorstand renders static data. Contact form → `buildMailto` + `window.location.href`, plus direct link and socials.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test tests/views.test.js`
Expected: PASS.

- [ ] **Step 6: Verify build and lint**

Run: `pnpm run lint` and `pnpm run build`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/views src/main.js tests/views.test.js
git commit -m "feat: add club pages with projects calendar and auth"
```

### Task 6: E2E verification + docs

**Files:**
- Modify: `README.md` (or create if missing)
- Test: manual script below, no new code unless fixes needed.

- [ ] **Step 1: Run full suite**

Run: `pnpm test`
Expected: PASS (existing `main.test.js`, `page.test.js` + new domain/router/views; workers tests via `pnpm --dir workers test`).

- [ ] **Step 2: Manual smoke (frontend + workers local)**

Run: `pnpm dev` and `pnpm dlx wrangler dev --local`. Verify: register → avatar upload → admin creates project (intensity 4) → login as 2nd user → join → limit blocked at max → calendar shows bar → Vorstand/Contact/Instagram visible.

- [ ] **Step 3: Document dev commands in README**

Add: `pnpm dev`, `pnpm dlx wrangler dev`, `pnpm test`, D1/R2 setup (`wrangler d1 create`, `wrangler r2 bucket create avatars`), seed via `schema.sql`/`seed.sql`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add archer filmstudios dev and deploy notes"
```
