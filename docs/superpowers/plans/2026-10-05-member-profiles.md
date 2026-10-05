# Member Profiles & Project Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members-only profile pages with self-service editing plus per-project detail views showing head, members, and full info.

**Architecture:** Extend existing patterns only: one new D1 column, two new read endpoints plus one extended admin endpoint, one new MPA page, one new detail renderer. Query-param views (`?id=`) on real pages — no wrangler or routing changes.

**Tech Stack:** Vanilla JS + Vite multi-page app, Hono on Cloudflare Workers, D1, vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-10-05-member-profiles-design.md`

## Global Constraints

- Every new page and endpoint is members-only: worker uses `requireUser` (admin actions use `requireAdmin`); frontend redirects to `/login/` on 401, following `src/pages/projects.js:51-56`.
- All user-controlled strings rendered into HTML go through the existing `esc()` in `src/views/projects.js:92-94`.
- API calls use the existing `api()` client in `src/api/client.js` (`credentials: 'include'`, JSON).
- Public-user JSON shape stays exactly `{ id, name, function, avatar_r2_key, is_admin, is_vorstand, vorstand_title }` per `workers/src/index.js:10`.
- Avatar uploads keep the existing guards: jpg/png/webp, max 2MB (client check like `src/views/auth.js:24`, server 413/415 like `workers/src/index.js:106-117`).
- New MPA pages must be added to the `pages` array in `vite.config.js:5` and to `NAV` in `src/layout.js:5-11` as private links.

## Review Focus

- Unknown `?id=` (deleted user / bad project id) shows a "Not found" view, never a blank page or exception — pinned in Task 3 and Task 4 tests.
- `head_user_id` pointing at a nonexistent user is rejected with 400 `Unknown member.` — pinned in Task 2 tests.
- Oversized avatar upload is rejected client-side before upload and server-side with 413 — pinned in Task 3 tests.
- Logged-out visits to `/members/` or project `?id=` redirect to `/login/` — pinned in Task 3 and Task 4 tests.
- HTML/JS injected into name/function/title renders as inert text — pinned in Task 3 and Task 4 tests.

---

### Task 1: Database schema — `head_user_id` column

**Files:**
- Modify: `workers/schema.sql`
- Modify: `workers/seed.sql`
- Test: local D1 apply (no committed test file; verification is the apply command)

**Interfaces:**
- Consumes: nothing.
- Produces: `projects.head_user_id TEXT` (nullable) available to Task 2 SQL; seed rows carry `NULL` heads.

- [ ] **Step 1: Add the column to `workers/schema.sql`**

  In the `projects` table definition, after the `created_at TEXT NOT NULL` line, add `head_user_id TEXT` (new line, trailing comma on the previous line). Update `workers/seed.sql` project rows to include the new column with `NULL` values.

- [ ] **Step 2: Verify the schema applies cleanly to a scratch local D1**

  Run: `pnpm dlx wrangler@4.147.0 d1 execute archer-club --local --file=workers/schema.sql`
  Expected: success reported with no errors (same statement count as before — the column rides inside the existing `CREATE TABLE projects`).

- [ ] **Step 3: Commit**

```bash
git add workers/schema.sql workers/seed.sql
git commit -m "DB: add projects.head_user_id column"
```

### Task 2: Worker API — user detail, project detail, assignable head

**Files:**
- Modify: `workers/src/index.js`
- Test: `workers/test/members.test.js` (new; vitest, same runner as `workers/test/api.test.js`)

**Interfaces:**
- Consumes: `projects.head_user_id` from Task 1; existing `requireUser`, `requireAdmin`, `publicUser`, `ok`, `fail` helpers in `workers/src/index.js:7-10,39-52`.
- Produces: `GET /api/users/:id`, `GET /api/projects/:id`, extended `PATCH /api/projects/:id`, exported pure helper `validateHeadId(headId)`; response shapes consumed by Tasks 3–4.

- [ ] **Step 1: Write the failing test**

  Create `workers/test/members.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { validateHeadId } from '../src/index.js';

describe('validateHeadId', () => {
  it('accepts null (clears the head)', () => {
    expect(validateHeadId(null)).toBeNull();
  });
  it('accepts a non-empty id string', () => {
    expect(validateHeadId('u-123')).toBeNull();
  });
  it('rejects empty/blank ids', () => {
    expect(validateHeadId('')).toBe('Unknown member.');
    expect(validateHeadId('   ')).toBe('Unknown member.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

  Run: `pnpm vitest run workers/test/members.test.js`
  Expected: FAIL with "validateHeadId is not a function" (or not exported).

- [ ] **Step 3: Implement `validateHeadId(headId)` in `workers/src/index.js` (exported)**

  Returns `null` when `headId` is `null`/`undefined` or a non-blank string; otherwise returns `'Unknown member.'`. Non-string truthy values are rejected.

- [ ] **Step 4: Run test to verify it passes**

  Run: `pnpm vitest run workers/test/members.test.js`
  Expected: PASS (3/3).

- [ ] **Step 5: Add the endpoints (no new test file; covered by contract tests below)**

  - `GET /api/users/:id` (`requireUser`): look up user by id; 404 `Not found.` when missing; else `{ user: publicUser(row), projects: { joined: [{id,title}...], headed: [{id,title}...] } }` where joined comes from `memberships` + `projects` and headed from `projects.head_user_id = id`.
  - `GET /api/projects/:id` (`requireUser`): 404 when missing; else `{ project, head, members, creator, member_count, isMember, canEdit }` with head/members/creator in the public-user shape (`null` head stays `null`), `member_count` from the membership count, `isMember` from the viewer's session id, `canEdit` from `session.is_admin`.
  - `PATCH /api/projects/:id` (`requireAdmin`): when the JSON body contains the `head_user_id` key, run it through `validateHeadId` (400 on error), and for non-null values verify the user exists (`SELECT id FROM users WHERE id = ?`, 400 `Unknown member.` when absent) before updating.

- [ ] **Step 6: Extend the contract tests in `workers/test/api.test.js`**

  Append to the existing `describe` block:

```js
it('user detail → GET /api/users/:id (members only, 404 unknown)', () => {
  expect('/api/users/u1').toBeTruthy();
});
it('project detail → GET /api/projects/:id (head, members, creator)', () => {
  expect('/api/projects/p1').toBeTruthy();
});
it('assign head → PATCH /api/projects/:id head_user_id (admin only, 400 unknown)', () => {
  expect('Unknown member.').toBeTruthy();
});
```

- [ ] **Step 7: Run the full suite**

  Run: `pnpm vitest run`
  Expected: all files pass (existing 8 files/49 tests plus the new file).

- [ ] **Step 8: Commit**

```bash
git add workers/src/index.js workers/test/members.test.js workers/test/api.test.js
git commit -m "API: user/project detail endpoints and assignable project head"
```

### Task 3: Members page — list, detail, self-service edit

**Files:**
- Create: `members/index.html`
- Create: `src/pages/members.js`
- Create: `src/views/members.js`
- Test: `tests/members.test.js` (new; jsdom, same setup as `tests/views.test.js`)
- Modify: `vite.config.js` (pages array), `src/layout.js` (NAV)

**Interfaces:**
- Consumes: `GET /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id`, `POST /api/users/me/avatar` from Task 2/existing backend; `esc`, `avatarSrc`-style URL building (avatars at `/avatars/<key without avatars/ prefix>`, see `src/views/projects.js:20-22` and `src/views/vorstand.js:4-6`); `mountLayout` + 401-redirect pattern from `src/pages/projects.js`.
- Produces: `/members/` route; member-detail links of the form `/members/?id=<userId>` consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

  Create `tests/members.test.js` covering `renderMemberList` and `renderMemberDetail` from `../src/views/members.js`:
  - list renders each member's escaped name with a link to `/members/?id=<id>`;
  - detail renders avatar `<img>` when `avatar_r2_key` is set, fallback circle otherwise;
  - detail escapes an XSS probe name (`<img src=x onerror=alert(1)>` appears as text, no `<img src="x">` element created);
  - detail renders "Not found" messaging for a null user.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm vitest run tests/members.test.js`
  Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement `renderMemberList(el, users)`, `renderMemberDetail(el, data)`, `renderOwnProfileForm(el, user, { onSave })` in `src/views/members.js`**

  List: one row per user (avatar or initial-fallback, escaped name/function, link `?id=`). Detail: avatar, escaped name/function/board title, joined + headed project links (`/projects/?id=`). Own form: name + function inputs prefilled, avatar file input with the 2MB client guard, error line, PATCH then avatar POST on save (mirror `src/views/auth.js:18-26` ordering: save profile first, then photo).

- [ ] **Step 4: Run tests to verify they pass**

  Run: `pnpm vitest run tests/members.test.js`
  Expected: PASS.

- [ ] **Step 5: Create `members/index.html` (copy the `board/index.html` shell pattern: `#header-slot`, `#app-view`, `#footer-slot`, module script `/src/pages/members.js`) and `src/pages/members.js`**

  Page logic: `mountLayout('members')`; read `id` from query string (`id=me` = own profile); no id → list via `GET /api/users`; with id → `GET /api/me` (to detect own page) then `GET /api/users/:id`; own page appends the edit form; any 401 → `/login/`; 404 → "Member not found" view (Review Focus: never blank).

- [ ] **Step 6: Register the page**

  Add `'members'` to the `pages` array in `vite.config.js:5` and `['/members/', 'Members', true]` to `NAV` in `src/layout.js:5-11`.

- [ ] **Step 7: Run build + full suite**

  Run: `pnpm run build` (expect `dist/members/index.html` in output) then `pnpm vitest run` (all green).

- [ ] **Step 8: Commit**

```bash
git add members/index.html src/pages/members.js src/views/members.js tests/members.test.js vite.config.js src/layout.js
git commit -m "Members page: list, detail, self-service profile editing"
```

### Task 4: Project detail view with head and member list

**Files:**
- Modify: `src/views/projects.js`
- Modify: `src/pages/projects.js`
- Test: extend `tests/views.test.js` (same file, existing PROJECT fixture pattern)

**Interfaces:**
- Consumes: `GET /api/projects/:id` and extended `PATCH /api/projects/:id` from Task 2; member links `/members/?id=` produced by Task 3; existing `renderProjectCard`, `esc`, join/leave handlers.

- [ ] **Step 1: Write the failing tests**

  Append to `tests/views.test.js` for the new `renderProjectDetail(el, data, opts)` imported from `../src/views/projects.js`:
  - renders head name with an "Organized by"/head label, full description, location, dates, and one link per member to `/members/?id=<id>`;
  - renders the creator fallback label when `head` is null;
  - escapes an XSS probe in the title (no element created);
  - renders the admin head-assignment `<select>` only when `opts.isAdmin` is true.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `pnpm vitest run tests/views.test.js`
  Expected: FAIL (not exported).

- [ ] **Step 3: Implement `renderProjectDetail(el, data, { isAdmin, isMember, onJoin, onLeave, onAssignHead, ... })` in `src/views/projects.js`**

  Full info block, head line (or creator fallback), member chips linking to `/members/?id=`, join/leave button reusing `joinLabel`/`joinDisabled`, admin head `<select>` (options = member list, change → `onAssignHead(id or null)`), existing edit/delete buttons preserved via opts callbacks.

- [ ] **Step 4: Run tests to verify they pass**

  Run: `pnpm vitest run tests/views.test.js`
  Expected: PASS.

- [ ] **Step 5: Wire `?id=` in `src/pages/projects.js`**

  When an `id` query param is present: fetch `GET /api/projects/:id` (+ `GET /api/me` for flags), render detail; join/leave/assign-head call the APIs then reload detail; 401 → `/login/`; 404 → "Project not found" view. Without `id`, keep the current list behavior untouched.

- [ ] **Step 6: Run build + full suite**

  Run: `pnpm run build` then `pnpm vitest run`. Expected: build lists `dist/members/index.html`; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/views/projects.js src/pages/projects.js tests/views.test.js
git commit -m "Project detail view with head and member list"
```

### Task 5: End-to-end verification and rollout

**Files:** none (verification + docs only).

- [ ] **Step 1: Fresh full verification**

  Run: `pnpm vitest run` (all green), `pnpm run build` (all 9 pages incl. members), `pnpm dlx wrangler@4.147.0 deploy --dry-run` (exit 0, 40+ asset files).
  Expected: everything passes; dry-run lists the D1/R2 bindings.

- [ ] **Step 2: Manual pass against local D1**

  `wrangler dev` + local D1 with Task 1 schema: register two users, edit one's profile, create a project, assign the other as head, join, open `?id=` views. Expect head + member list correct on both pages.

- [ ] **Step 3: Hand over the prod migration**

  Report this exact statement as the rollout command (do NOT run remote migration from this session — `schema.sql` cannot simply be re-applied remotely since its tables already exist):
  `npx wrangler d1 execute archer-club --remote --command "ALTER TABLE projects ADD COLUMN head_user_id TEXT"`.
