# Deployment checklist

Kavli has two ways to run. Know which one you are looking at.

| | What it is | Backend | Use for |
|---|---|---|---|
| **UI preview** (Vercel today) | The front end with a recorded, in-browser fake API (`VITE_UI_PREVIEW=1`, set in `.env.production`) | none | Reviewing screens. Nothing is saved, graded or sent to a model. |
| **Live app** (this document) | One Node server: API + built front end | PostgreSQL, a file bucket, optional tutor model and voice | Real students |

The live app is **one container**. Vercel's serverless functions are not a good fit (long voice streams, background OCR, in-memory rate limiter), so keep Vercel for the preview and run the container on Render, Railway, Fly.io, Azure Container Apps, AWS App Runner/ECS, or any VM with Docker.

---

## 1. Accounts and keys to get

| Need | Why | Notes |
|---|---|---|
| **PostgreSQL** database | All app data | Managed is easiest: Neon, Supabase, Azure Database, AWS RDS. Version 14+. Region close to students (India). |
| **S3-compatible bucket** | Textbook PDFs and student uploads | AWS S3 (ap-south-1), Cloudflare R2, or Supabase Storage. Keep it **private**; the server streams files after checking the student's class. |
| **Tutor model key** | Real lessons written from the textbook | Anthropic (`ANTHROPIC_API_KEY`) or any OpenAI-compatible service (`LLM_BASE_URL`). Optional: without it the labelled rule-based tutor runs. |
| **Azure AI Speech** key + region | AI voice (Tamil + English) | Resource in `centralindia` keeps latency low. Optional: without it the student's browser voice is used. |
| **Domain + HTTPS** | Sign-in cookies, microphone access | Browsers only allow the microphone on HTTPS. Most hosts give TLS for free. |
| **Textbook rights** | Hosting official books | Confirm with Tamil Nadu Textbook and Educational Services Corporation (TNTESCOP) that you may store and serve each book. Platform-admin uploads are your responsibility. |

## 2. Provision, in this order

1. **Database.** Create an empty database and a user. Copy the connection string → `DATABASE_URL`. Managed providers usually need `DATABASE_SSL=1`. The app creates its own tables on first start.
2. **Bucket.** Create a private bucket and an access key limited to it (read, write, delete). Set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; for R2/MinIO also `S3_ENDPOINT`. No bucket → files go to a local folder on a persistent disk (fine for one server, lost if the disk is).
3. **Voice.** `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`. Defaults: `ta-IN-PallaviNeural`, `en-IN-NeerjaNeural`; change with `AZURE_SPEECH_VOICE_TA/_EN` after listening to the voices available in your region.
4. **Model.** `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`), or `LLM_PROVIDER=openai` with `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
5. **App settings:** `NODE_ENV=production`, `PUBLIC_URL=https://your-domain` (used in certificate QR links), `SEED_DEMO=0`. See `.env.example` for every variable.

## 3. Build and run

```bash
docker build -t kavli .
docker run -p 3001:3001 --env-file .env kavli
```

The image includes Tesseract (English + Tamil) and poppler for scanned-book OCR. The `Dockerfile` builds the front end with `VITE_UI_PREVIEW=0`; if you build without Docker, build with that variable set or you will ship the fake-API preview.

Health check: `GET /api/health` → `{"ok":true}`. The start-up log line states the tutor in use (`tutor: rule-based` or the model name).

## 4. First-run steps

1. **Create the first admin** (production starts with no demo accounts):
   `ADMIN_EMAIL=you@org.in ADMIN_NAME="Your Name" npx tsx scripts/create-admin.ts` (run with the same `DATABASE_URL`). It prints a one-time password if you do not set `ADMIN_PASSWORD`. Sign in and change it.
2. **Upload the books** (Admin → Class books). A Tamil-medium or scanned book opens at once and shows *"Reading N pages with OCR"*; the tutor can use pages as they finish. Measured on the Class 8 Tamil book (192 pages): about 2.4 s per page, 4–8 minutes in total, depending on CPU. Leave the server running; if it restarts, unfinished books resume.
3. **Check one book by hand**: open a few pages in the reader and ask the tutor a question that book answers. OCR is good but not perfect (spot-checking is the only quality control).
4. **Create the school, teachers and classes**, or let staff register and approve them.
5. **Load practice questions.** A fresh production database has none, so Practice and Revise modes will say so until a teacher adds questions.

## 5. Go-live checklist

**Security**
- [ ] HTTPS only; `PUBLIC_URL` is the https address.
- [ ] `SEED_DEMO=0`; no `*@demo.kavli.local` users exist (`select email from users where is_demo=1` is empty).
- [ ] Secrets are in the host's secret store, not in the repo or image. `.env` is not committed.
- [ ] Bucket is private; database is not reachable from the internet except from the app.
- [ ] Rate limiting is in memory → **run one instance** (or add a shared limiter before scaling out).
- [ ] Decide the privacy position and tell families: with a tutor model on, each question and the textbook passages used to answer it are sent to that provider; no names, emails or ids are sent. With Azure voice on, the tutor's reply text is sent to Azure to be spoken. Student speech is recognised by the browser's own speech service (Chrome sends audio to Google). Update the privacy notice to match.
- [ ] Under-13 students: guardian approval is a recorded consent only (no email verification yet). Decide if that is enough for your school.

**Data**
- [ ] Automated daily database backups switched on, and a restore tried once.
- [ ] Bucket versioning or backup for the textbook files.
- [ ] Cost alerts on the model and speech accounts. The app limits voice synthesis per student per day (`VOICE_TTS_DAILY_CHARS`, default 20 000 characters) and concurrent requests (`VOICE_MAX_CONCURRENCY`).

**Quality before real students**
- [ ] A teacher reviews the Class 8 diagrams and the maths solver explanations. Diagrams are original drawings, not yet reviewed by a teacher.
- [ ] Listen to the Tamil voice on real sentences (numbers, equations, mixed English words) and pick the voice you prefer.
- [ ] Try the tutor with 10–20 real questions per subject. Look for answers that drift from the book. The tutor is built to show only cited steps and to say *"I could not find this in your books"* otherwise, but that has only been tested against a simulated model.
- [ ] Test on a real low-end Android phone on 4G: sign-in, a voice turn, replay, the diagram.
- [ ] Microphone permission flow on iOS Safari and Android Chrome. Browser speech recognition for Tamil varies by device.

**Operations**
- [ ] Log shipping and an uptime check on `/api/health`.
- [ ] A named person owns: the model/voice budget, textbook uploads, and student data-deletion requests (the student's *Delete my data* action removes their account, results and uploaded files).
- [ ] Rollback: keep the previous image tag. Database changes are additive (`CREATE TABLE IF NOT EXISTS`); there are no destructive migrations yet.

## 6. What has and has not been verified

Verified in this repository's test suite (154 tests, run on **SQLite and on real PostgreSQL 18**):
sign-in and roles, tests/results/certificates, voice tutor flow, instant replay, diagrams, textbook upload/OCR flow, retrieval, the tutor-model engine and its fallbacks, storage drivers, voice provider request format.

Verified on real data: the Class 8 Tamil PDF (192 pages) was imported end to end with real Tesseract OCR; its embedded text layer was found to be corrupted on essentially every page and was replaced by OCR output (see `KNOWN_LIMITATIONS.md`).

**Not verified, because it needs your accounts or network:**
- Calls to the real Anthropic / OpenAI-compatible API (tested against a mock server that follows their documented request and response shapes).
- Calls to real Azure AI Speech (mock server; voice names are Azure's published defaults and must be confirmed in your region).
- A real S3/R2 bucket (tested with the AWS SDK against a mock S3 server).
- The Docker image build (no Docker daemon was available); its two risky parts, the production-only install and the non-preview front-end build, were run separately and work.
- Managed Postgres with TLS (`DATABASE_SSL`), and load beyond the in-process tests.

Run these once on a staging copy before announcing.

## 7. Scaling notes

- One instance handles a classroom comfortably; the limits that bite first are the model/voice providers, not the database.
- To run several instances you need: a shared rate limiter, one OCR worker (set `OCR_ENGINE=off` on the others), and `STORAGE_DRIVER=s3` (not local disk).
- Retrieval reads each class's book pages from the database for every question (about 60–100 ms for a 192-page book). For many books, add Postgres full-text search or embeddings; the `topPassages` call site is the only place to change.
