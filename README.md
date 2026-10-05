# Archer FilmStudios

Cinematic film & photography club site (Vite multi-page + Cloudflare Workers).

## Dev

- `pnpm dev` — frontend (`/`, `/projects/`, `/calendar/`, `/board/`, `/contact/`, `/login/`, `/register/`, `/impressum/`; `/api` + `/avatars` proxied to the Worker)
- `pnpm dlx wrangler dev --local` — workers (local, D1-local + R2-local) on `http://127.0.0.1:8787`
- `pnpm test` — frontend unit tests (Vitest)
- `pnpm --dir workers test` — workers contract tests
- `pnpm run lint`, `pnpm run build`

## Backend setup

1. `pnpm dlx wrangler d1 create archer-club`
2. Put the returned id into `workers/wrangler.toml` (`database_id`).
3. `pnpm dlx wrangler d1 execute archer-club --file workers/schema.sql --local`
4. Seed: replace `REPLACE_WITH_HASH` in `workers/seed.sql`, then execute it.
5. `pnpm dlx wrangler r2 bucket create avatars`

Contact is mailto-only (`hello@archerfilmstudios`) — no email backend needed.
Vorstand is static in `src/data/vorstand.js`.
