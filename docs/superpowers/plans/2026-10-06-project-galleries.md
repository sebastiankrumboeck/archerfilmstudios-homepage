# Project Galleries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a shoot or trip, joined members upload result photos into a shared album on the project detail page.

**Architecture:** New `project_photos` table + R2 objects under `galleries/` in the existing `AVATARS` bucket (third reuse of the avatar/poster pattern: same `ALLOWED_TYPES`, same 2MB cap). Separate photo endpoints (not folded into project detail) so the album loads independently. Album UI extends the project detail page.

**Tech Stack:** Hono worker, D1, R2 (`AVATARS` binding, no new buckets), vanilla JS frontend matching the avatar-upload call style in `src/pages/board.js` (read it first).

**Spec:** Conversation decision 2026-10-06 (no spec doc): upload = joined members + admins; view = any logged-in user (login-gated site); delete = uploader or admin; 30-photo cap per project; serving route mirrors `/avatars/:key` (unguessable keys, no auth); English UI copy (site language).

## Global Constraints

- TDD: failing test first, watched RED → GREEN, for every behavior.
- Workers tests run from `workers/` via `pnpm --dir workers vitest run`; root suite via `node ./node_modules/vitest/vitest.mjs run`.
- Follow existing worker idioms: `ok`/`fail` helpers, `uid`/`nowISO`, `requireUser` gate, `ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']`, 2MB limit, R2 key patterns.
- Frontend: `esc()` every user-controlled string; `api()` client for JSON; raw `fetch` with `Content-Type` + file body for uploads (mirror the avatar upload in `src/pages/board.js`).
- Exact SQL below is normative.

## Review Focus

- Non-member (logged in, not joined, not admin) uploads (must be 403 — pinned by Task 1 test; viewing stays allowed).
- Non-image content type or >2MB file (415 / 413, mirroring `storeAvatar` — pinned by Task 1 tests).
- 31st photo on a project (400 `Album is full.` — pinned by Task 1 test).
- Deleting another member's photo as non-admin (403; uploader or admin only — pinned by Task 1 test).
- Deleting a project leaves orphaned R2 objects (accepted: photo *rows* are deleted with the project; orphaned objects match existing avatar behavior and cost nothing at club scale).

---

### Task 1: Photo storage endpoints

**Files:**
- Modify: `workers/schema.sql` (append at end)
- Modify: `workers/src/index.js` (routes; extend `DELETE /api/projects/:id` to also delete photo rows)
- Create: `workers/test/project-photos.test.js`

**Interfaces:**
- Consumes: `requireUser`, `ok`, `fail`, `uid`, `nowISO`, `ALLOWED_TYPES` (existing in `index.js`).
- Produces: `GET /api/projects/:id/photos` (requireUser; 404 unknown project; `{ photos: [{ id, r2_key, uploaded_by, created_at }] }` ordered by `created_at`), `POST /api/projects/:id/photos` (requireUser + joined-or-admin else 403; 415/413 validation; R2 key `galleries/${pid}-${Date.now()}.jpg`; 201 `{ photo }`), `DELETE /api/photos/:id` (requireUser + uploader-or-admin else 403; 404 unknown), `GET /gallery/:key` (public, mirrors `/avatars/:key`, serves `galleries/${key}` with `Cache-Control: public, max-age=86400`).

Exact schema (normative):
```sql
CREATE TABLE project_photos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_photos_project ON project_photos(project_id);
```

- [ ] **Step 1: Write the failing test** in `workers/test/project-photos.test.js`:
```js
it('member lists photos of a project'); // requireUser, 200, photo JSON shape above
it('non-member upload gives 403, joined member gets 201, admin gets 201'); // three sessions, same image body
it('rejects non-images with 415 and oversize with 413'); // content-type text/plain; 3MB body
it('31st photo gives 400'); // 30 existing rows via fakeDb count
it('delete by stranger gives 403, by uploader gives 200, unknown gives 404');
it('deleting a project deletes its photo rows'); // capture DELETE statements via runLog-style hook
```
Fake-DB/R2 convention: follow `workers/test/dues.test.js` (canned `prepare` router); R2 via `{ put: vi.fn(), get: vi.fn() }` on `env.AVATARS`. Upload body: pass a small `Uint8Array` with `Content-Type: image/jpeg` header through `app.request`.
- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir workers vitest run test/project-photos.test.js`
Expected: FAIL (404s, no routes/table).

- [ ] **Step 3: Implement** routes + schema + project-delete extension in the files above.
- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir workers vitest run`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/schema.sql workers/src/index.js workers/test/project-photos.test.js
git commit -m "Project photo albums API with R2 storage"
```

**Post-deploy note for the human:** run the new `project_photos` CREATE TABLE + index against prod D1 once.

---

### Task 2: Album UI on the project detail page

**Files:**
- Modify: `src/views/projects.js` (add gallery renderer; read current `renderProjectDetail` signature first)
- Modify: `src/pages/projects.js` (wire album into the detail loader)
- Create: `tests/project-gallery.test.js`

**Interfaces:**
- Consumes: Task 1 endpoints; `esc`, `api` (existing); avatar-upload call style from `src/pages/board.js`.
- Produces: `renderProjectGallery(el, photos, { canUpload, canDeleteFor, onUpload, onDelete })` where `canDeleteFor` is `(photo) => boolean` (uploader-or-admin rule evaluated by the page, which knows the session). `onUpload(file)` and `onDelete(photo)` are async callbacks supplied by the page.

Behavior (normative): empty album shows `No photos yet — be the first to upload!`; upload is `<input type="file" accept="image/jpeg,image/png,image/webp">` + button, only when `canUpload`; each photo renders `<img src="/gallery/${r2_key-suffix}" loading="lazy">` (strip the `galleries/` prefix for the URL, mirroring how avatar URLs are built — read the avatar rendering first); delete button only where `canDeleteFor(photo)`; upload/delete failures surface `err.message` inline (same pattern as finanzen send-status).

- [ ] **Step 1: Write the failing test** in `tests/project-gallery.test.js`:
```js
it('empty album invites the first upload');
it('photos render with gallery URLs and no delete buttons for strangers'); // canDeleteFor: () => false → no [data-delete]
it('delete button fires onDelete with the photo'); // canDeleteFor: () => true
it('upload input calls onUpload with the chosen file'); // set input.files via DataTransfer or Object.defineProperty, submit, expect onUpload called with the File
it('escapes HTML in r2 keys and uploader-derived labels'); // key with `"><script` renders as text, no script element
```
- [ ] **Step 2: Run test to verify it fails**

Run: `node ./node_modules/vitest/vitest.mjs run tests/project-gallery.test.js`
Expected: FAIL (no `renderProjectGallery` export).

- [ ] **Step 3: Implement** renderer + page wiring (page passes `canUpload = isMember || isAdmin`-equivalent — read how the detail loader names these flags first — and `canDeleteFor = (p) => isAdmin || p.uploaded_by === me.id`).
- [ ] **Step 4: Run tests to verify they pass**

Run: `node ./node_modules/vitest/vitest.mjs run` then `pnpm --dir workers vitest run`
Expected: all PASS.

- [ ] **Step 5: Run build and lint**

Run: `node ./node_modules/vite/bin/vite.js build`, `node ./node_modules/eslint/bin/eslint.js src/views/projects.js src/pages/projects.js tests/project-gallery.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/views/projects.js src/pages/projects.js tests/project-gallery.test.js
git commit -m "Project gallery album UI with upload and delete"
```
