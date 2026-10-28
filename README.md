# Kavli — Tamil Nadu State Board AI Teaching Bot (Classes 1–12)

A full-stack web app: Express + SQLite API and a Vite/React/TypeScript front end.
Students learn in Tamil / English / both, ask an AI tutor, learn from their own material,
practise, take weekly tests, and earn verifiable PDF certificates. Parents, teachers,
school admins and platform admins have their own screens.

> **Status:** honest status is in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md);
> gaps in [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md). This is not an official
> Tamil Nadu Government product; bundled curriculum content is sample content.

## Quick start
Requires Node 22+ (uses built-in `node:sqlite`).
```bash
npm install
cp .env.example .env     # optional; defaults work for local dev
npm run dev              # API :3001 + web :5173 (proxied /api)
```
Open http://localhost:5173.

## Scripts
| Script | Purpose |
|---|---|
| `npm run dev` | API (tsx watch) + Vite together |
| `npm run build` | type-check + production front-end build to `dist/` |
| `npm start` | production server (serves `dist/` + API) |
| `npm run typecheck` | front-end + server type-check |
| `npm test` | vitest (API, grading, timing, certificates, SSRF, materials) |

## Demo accounts (development only, password `Demo@12345`)
`meena@`, `parent@`, `teacher@`, `school@`, `admin@` `…demo.kavli.local` (also `arun`, `divya`, `karthik`).
Set `SEED_DEMO=0` in production so none of these are created.

## Architecture
- `server/` — Express app (`app.ts`), SQLite (`db.ts`), auth/CSRF/rate limit (`security.ts`),
  routes per role, services (`grading`, `tests`, `certificatePdf`, `ssrf`, `retrieval`, `solver`, `tutor`).
- `src/` — React app, route guards (UI only; the server re-authorises every request), pages per role,
  bilingual `Bi` component, responsive shell with bottom nav on mobile.
- `tests/` — vitest + supertest. `e2e/` — Playwright scripts for responsive overflow and axe a11y.

## Key behaviours
- Server-side auth (scrypt hashes, httpOnly session cookie, CSRF token), RBAC, tenant isolation.
- Under-13 registration requires guardian consent.
- Tests: server-authoritative timer, idempotent start/submit, immutable attempts, answer keys never sent before submit, manual review of written answers.
- Certificates: A4 landscape PDF with Tamil text, QR + public verify page (minimal data), revoke/reissue with reasons and audit trail.
- Learn from Your Material: private storage, magic-byte checks, SSRF-safe URL fetch, material treated as untrusted text.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/TESTING.md](docs/TESTING.md).
