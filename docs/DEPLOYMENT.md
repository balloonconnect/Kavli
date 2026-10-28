# Deployment

1. Node 22+. `npm ci && npm run build`.
2. Set environment (see `.env.example`): `NODE_ENV=production`, `PORT`, `PUBLIC_URL` (https URL used in certificate QR codes), `DATABASE_PATH`, `UPLOAD_DIR` on a persistent volume, `SEED_DEMO=0`.
3. Optional AI: set `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL`) as a server-side secret. Without it the labelled development tutor is used.
4. `npm start` serves the API and the built front end.
5. Put it behind HTTPS (TLS terminating proxy). Session cookies should only travel over HTTPS in production.
6. Back up `DATABASE_PATH` and `UPLOAD_DIR`. Run a single instance: SQLite is single-writer and the rate limiter is in-memory.

Not provided: email/SMS delivery, password reset, Postgres, horizontal scaling, malware scanning of uploads. See KNOWN_LIMITATIONS.
