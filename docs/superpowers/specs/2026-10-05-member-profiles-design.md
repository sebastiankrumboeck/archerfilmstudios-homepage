# Member Profiles & Project Detail Pages — Design Spec

Date: 2026-10-05
Status: approved for implementation planning
Approach: A — reuse existing patterns, minimal schema

## Goal

Members-only member profiles (self-service name/function/avatar editing,
one page per member) and per-project detail views showing the project
head, the signed-up members, and all project information.

## Locked decisions

- Visibility: members only (login required), reusing the existing
  `requireUser` middleware and 401 → `/login/` frontend pattern.
- Project head: an assignable person, independent of the creator.
  Stored as nullable `projects.head_user_id`; `NULL` falls back to
  displaying the creator, labeled "Organized by".
- Page shape: new `/members/` MPA page (list + `?id=` detail + own edit
  form); project detail as a `?id=` view on the existing `/projects/`
  page. (Static pre-built HTML cannot have per-id files; query-param
  views on real pages are linkable and need no wrangler changes.)

## Data model

```sql
ALTER TABLE projects ADD COLUMN head_user_id TEXT;
```

- Nullable; when set it must reference an existing `users.id`.
- No `users` table changes (`name`, `function`, `avatar_r2_key` exist).
- `workers/seed.sql` gains the column (NULL for seed projects).
- Prod migration: run the single `ALTER TABLE` above via
  `wrangler d1 execute archer-club --remote`. No backfill needed.

## API (`workers/src/index.js`)

- `GET /api/users/:id` (`requireUser`) → `{ user: publicUser,
  projects: { joined: [...], headed: [...] } }` (id + title pairs).
  404 `Not found.` for unknown ids.
- `GET /api/projects/:id` (`requireUser`) → `{ project, head,
  members, creator, member_count, isMember, canEdit }` where head /
  members / creator are public-user shapes (`id, name, function,
  avatar_r2_key, is_admin, is_vorstand, vorstand_title`).
- `PATCH /api/projects/:id` (`requireAdmin`) additionally accepts
  `head_user_id`: `null` clears it; otherwise must be an existing user
  id, else 400 `Unknown member.`
- Reused unchanged: `GET /api/users`, `PATCH /api/users/:id`
  (self-or-admin name/function edit), `POST /api/users/me/avatar`.

## Frontend

New files:

- `members/index.html` — MPA shell (`#app-view`, `mountLayout('members')`).
- `src/pages/members.js` — list view; `?id=` (or `?id=me`) detail view;
  own-profile edit form (name, function, avatar ≤ 2MB via existing
  endpoints); 401 → `/login/`.
- `src/views/members.js` — `renderMemberList`, `renderMemberDetail`,
  `renderOwnProfileForm` (all `esc()`-escaped, existing style).
- Tests for the new renderers (existing `tests/views.test.js` pattern).

Extended files:

- `src/views/projects.js` — `renderProjectDetail` (full info, head,
  member list linking to `/members/?id=`, join/leave, admin head
  dropdown reusing the member list).
- `src/pages/projects.js` — `?id=` renders detail, else the list.
- `src/layout.js` — `Members` nav entry (private).
- `vite.config.js` — add `'members'` to the pages array.

## Permissions matrix

| Action | Anonymous | Member | Admin |
|---|---|---|---|
| View members / project details | redirect login | yes | yes |
| Edit own name/function/avatar | — | yes (self only) | yes |
| Assign project head / edit / delete project | — | no | yes |
| Board management | — | no | yes (unchanged) |

## Testing

- `vitest run` (frontend): new view tests + existing 49 tests stay green.
- Worker tests follow the repo's existing contract-test style; pure
  helpers (head-id validation) get direct unit tests.
- Manual: `wrangler dev` + local D1 — register → edit profile →
  create project → assign head → join as second user → detail shows
  head + member list.

## Rollout

1. Merge + push (Cloudflare builds `dist/` incl. `/members/`).
2. Run the one-line prod D1 migration.
3. Admin assigns project heads via the new dropdown.

## Out of scope (explicitly not this spec)

Bio/about-me fields, cover photos, public (logged-out) visibility,
notifications, project comments, head-request workflow. The schema
stays open for these without rework.
