# Archer FilmStudios — Club Site Design

Date: 2026-10-05
Status: approved in chat (sections 1-5), approach A
Package manager: pnpm (required)

## 1. Intent

Rebrand existing `Frame & Motion` Vite static site to **Archer FilmStudios**,
cinematic film & photography club (Travel / People / Worldwide — per
@archerfilmstudios on Instagram, ~9.3K followers, 69 posts).

Add member accounts, projects with intensity color + calendar + join limits,
persistent admin role, Vorstand page, Contact (mailto-only), social links.
Backend on Cloudflare Workers + D1 + R2.

Success: member can register (name, function, avatar), login, join a project
until limit reached; admin can create projects and grant/revoke admin;
calendar shows when/how long events run; Vorstand + Contact + Instagram link visible.

## 2. Architecture

- Frontend: keep Vite + Tailwind v4 (`src/input.css` theme ink/paper/amber),
  `index.html` shell. Add hash-router SPA, no new framework.
  Routes: `#/` home, `#/members`, `#/projects`, `#/calendar`,
  `#/vorstand`, `#/contact`, `#/login`, `#/register`.
- Backend: `workers/` Hono app on Cloudflare Workers.
  - `POST /api/auth/register|login|logout`, `GET /api/me`
  - `GET /api/users`, `PATCH /api/users/:id`, `PATCH /api/users/:id/admin`
  - `POST /api/users/me/avatar` (R2 upload)
  - `GET/POST /api/projects`, `PATCH/DELETE /api/projects/:id`
  - `POST/DELETE /api/projects/:id/join`
  - `GET /api/calendar?month=YYYY-MM`
- Frontend API: `src/api/client.js` fetch wrapper with cookie session.
- Deploy: `wrangler.toml` (d1 database + r2 bucket `avatars`),
  `pnpm dev` frontend, `pnpm dlx wrangler dev` workers.

## 3. Data Model (D1 + R2)

```sql
users(id TEXT PK, email TEXT UNIQUE, pass_hash TEXT,
  name TEXT, function TEXT, avatar_r2_key TEXT,
  is_admin INTEGER DEFAULT 0, is_vorstand INTEGER DEFAULT 0,
  vorstand_title TEXT, created_at TEXT);
projects(id TEXT PK, title TEXT, description TEXT,
  intensity INTEGER CHECK(intensity BETWEEN 1 AND 5),
  location TEXT, start_at TEXT, end_at TEXT,
  max_members INTEGER, created_by TEXT, created_at TEXT);
memberships(project_id TEXT, user_id TEXT, joined_at TEXT,
  PRIMARY KEY(project_id, user_id));
sessions(id TEXT PK, user_id TEXT, expires_at TEXT);
```

- Join limit enforced in Worker transaction: `COUNT < max_members`, no double-join.
- R2 key: `avatars/{userId}-{ts}.jpg`, validated <2MB jpg/png/webp,
  client-side resize before upload.
- Seed: 1 owner admin, 3 sample projects (all intensities), 3 Vorstand placeholders.
- Intensity → color: 1 emerald `#10b981`, 2 lime `#a3e635`,
  3 amber `#dda85b`, 4 orange `#fb923c`, 5 red `#ef4444`.
  Card border/badge + calendar bar/dot.

## 4. Auth, Roles, Flows

- Register fields: name, function (free text, datalist:
  Kamera, Regie, Schnitt, Ton, Foto, Organisation, Schauspiel),
  email, password, optional avatar. Auto-login on success.
- Sessions: httpOnly cookie, `GET /api/me` drives header.
- Members: edit own profile, join/leave if not full, view all.
- Admins: all member abilities + create/edit/delete any project +
  grant/revoke `is_admin`. Guard in Worker middleware.
  Cannot revoke self if last admin. `is_admin` persists until revoked.
  Badge on cards.
- Join UI: `Beitreten (3/8)` → `Beigetreten ✓` / `Voll (8/8)` disabled.

## 5. Pages

- Home: rebrand hero “Make stillness move.” → Archer copy:
  “Cinematic Film & Photography — Travel / People / Worldwide.”
- Members: grid with avatar, name, function, admin badge.
- Projects: cards with color, intensity label, date range,
  `max_members`, member avatars, join button. Admin `+ Neues Projekt` form.
- Calendar: month grid, bars spanning start→end in intensity color,
  tooltip + list view for mobile/SR. UTC ISO stored, `de-DE` rendered.
- Vorstand: static `src/data/vorstand.js` (name, role, photo, bio).
- Contact: form → `mailto:hello@archerfilmstudios` subject/body.
  Direct link + socials. No backend send.
- Socials: `https://instagram.com/archerfilmstudios` verified.
  TikTok/YouTube as `@archerfilmstudios` placeholders until URLs confirmed.

## 6. Errors

Unified `{ok, data|error}`. 401 → login redirect, 403 “Nur Admins”,
404, 409 “Projekt voll / bereits dabei”, 413 “Bild zu groß”,
offline cached-read + retry banner.

## 7. Testing

Vitest (existing). Unit: intensity→color, join-limit, admin-guard,
calendar-span. API integration via Miniflare/D1-local.
Manual: register → avatar → admin creates project → join as 2nd user → full blocked.
Commands: `pnpm test`, `pnpm run lint`, `pnpm run build`.

## 8. Out of Scope

- No email sending (mailto-only), no password reset yet,
  no multi-date per project (single start/end), no R2-free fallback.
