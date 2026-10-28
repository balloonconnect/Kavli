# Voice tutor (Kalvi AI → interactive tutor)

## 1. Audit of the repository (before this change)
- **Framework:** Vite + React 18 + TypeScript front end; Express + `node:sqlite` back end (`server/`); Vitest + supertest tests; deployed on Vercel in browser-only UI-preview mode, or as a Node server (`npm start`) serving `dist/`.
- **Existing AI:** `server/services/tutor.ts` — a labelled, rule-based development tutor (equation solver, lesson/textbook retrieval, check questions) behind a `TutorProvider` interface, with an optional Anthropic provider (`ANTHROPIC_API_KEY`). Chat is request/response (`POST /api/tutor/conversations/:id/messages`), no streaming.
- **Existing voice:** `src/components/voice.ts` — one-shot read-aloud and one-shot dictation using the browser's Web Speech API. No conversation loop.
- **Reusable:** auth + CSRF + rate limiting (`server/security.ts`), `ai_usage` + daily limits, under-13 guardian check, lesson/textbook retrieval (`retrieval.ts`, `textbookHits`), solver, grading, practice question bank, `useLoad/Card/Badge` UI kit, language context.
- **Missing (now added):** a voice session, one-step-at-a-time teaching state, streaming turns, interruption, per-session persistence/resume, latency metrics, request gate/queue.

## 2. Architecture implemented
```
Browser (Web Speech API: mic → text, text → speech)          Server
  Voice page ──POST /api/voice/sessions/:id/turn (SSE)──────► voiceRoutes  ──► TeachEngine (ruleEngine)
  highlight + speak each chunk as it arrives                    │  gate (max concurrency, queue, 503 when busy)
  abort fetch + cancel speech on interrupt                      │  per-session in-flight lock (409), rate limit, daily limit
  metrics: stt / first_text / first_audio / full ───────────────► voice_metrics (no conversation text)
                                                                 └─ voice_sessions (state), voice_turns (transcript if allowed), voice_quiz
```
- **Hybrid/local-first seam:** `TeachEngine` (`server/services/teach.ts`) yields `ack → chunk* → done`. The default `ruleEngine` needs no model. To use an LLM or a local GPU stack, implement `TeachEngine` (stream chunks of `{kind, en, ta, say, step}`), and pass it as `voiceEngine` to `createApp`. Provider code never reaches the browser; API keys stay server-side.
- **Speech runs in the browser** (SpeechRecognition + speechSynthesis). No audio is sent to our servers. A real-time voice provider (WebRTC) is **not implemented**: `POST /api/voice/realtime-token` returns 501. It would need a provider choice, server-minted short-lived credentials, and a CSP `connect-src` change.
- **Local-first (A) — not implemented:** would mean running Whisper-class STT, an LLM server (e.g. vLLM/llama.cpp) and a Tamil-capable TTS on a GPU box behind an authenticated internal endpoint, wrapped in a `TeachEngine`; the existing `Gate` already provides the concurrency limit and queue.

### Teaching engine (rule-based)
Modes: **Teach me** (one step, then a check question; yes/no, fill-the-blank or "what is x?"; wrong → hint → answer), **Explain fully** (all steps + summary), **Give me a hint** (progressive hints; the answer only at the end), **Practice with me** (question bank, hint after first miss, answer after second), **Revise this topic** (key points + 3-question quiz). Sources are labelled: class lesson, class textbook page (own class only, with "Open book, page N"), or "worked out by the equation solver (not from a textbook)". With no verified source it says so and cites nothing. Equations stay on screen; the spoken form is converted ("3x + 5 = 20" → "3 x plus 5 equals 20").

## 3. Files
- Server: `server/services/teach.ts` (engine), `server/routes/voice.ts` (API, gate, metrics), `server/db.ts` (+4 tables), `server/app.ts` (mount, injectable engine), `server/services/tutor.ts` (exports reused helpers).
- Client: `src/pages/voice.tsx`, `src/components/speech.ts`, `src/styles/global.css` (`.vt-*`), `src/App.tsx` (`/app/voice`), `src/components/Shell.tsx` (nav), `src/api.ts` (`getCsrf`).
- Tests: `tests/voice.test.ts` (17), browser run `docs/` notes below.

## 4. Install, configure, deploy
```
npm install
cp .env.example .env            # SEED_DEMO=1 only for local demos
npm run build                   # NOTE: .env.production sets VITE_UI_PREVIEW=1 (Vercel preview).
VITE_UI_PREVIEW=0 npx vite build   # real-backend build served by Express
npm start                       # NODE_ENV=production tsx server/index.ts
```
Optional env: `VOICE_MAX_CONCURRENCY` (default 8), `VOICE_QUEUE_MS` (default 8000). The per-student daily limit is the `voice_daily_limit` row in `settings` (default 150 turns). The Vercel deployment is browser-only UI preview: the voice page there shows an explanation instead of a lesson, because there is no engine or database. The voice tutor needs the Node server (and persistent disk or a managed database for SQLite).

## 5. Testing performed
- `npm test`: 91 tests pass (17 new in `tests/voice.test.ts`): Tamil/English/bilingual teaching, step-by-step + check, wrong answer → hint → answer, simpler explanation, progressive hints, practice, revise, honest no-source reply, class-scoped sources, voice→text switching + resume after refresh, transcript opt-out + delete, SSE streaming + client disconnect (state not advanced), duplicate request 409, queue 503, daily limit, student isolation, concurrent students, metrics without conversation content, realtime provider 501.
- Browser run (Playwright, real built app + real server, **speech APIs stubbed** because the headless test browser has no microphone or voices): bilingual step display, spoken text incl. equation wording, mic start, voice answer advancing a step, **interrupt cancels speech**, pause/resume/mute/slower/replay, wrong→hint→right answer, refresh restores transcript, offline → retry banner → automatic resend on reconnect, honest no-source, 375 px layout without overflow, text-only fallback with no speech APIs, no console errors. Not tested: real microphones, real Tamil voices, iOS Safari, real network latency, many real devices.
- **Latency (local rule engine, localhost, stubbed TTS): first text ≈ 13–18 ms, first audio event ≈ 40–50 ms, full answer ≈ 15–20 ms.** These do not predict LLM or real-TTS latency; with a hosted model expect first text to be dominated by model time-to-first-token.

## 6. Known limits
- Rule-based, not a language model: it cannot teach arbitrary questions; it only uses your lessons, class textbook pages and the equation solver.
- Tamil speech depends on the device having a Tamil voice/recognizer; otherwise Tamil is shown as text only (the page says so). iOS Safari support for speech recognition is limited.
- Voice interruption relies on the browser hearing the student over the tutor's own voice; headphones recommended.
- No diagrams/tables/KaTeX: equations are shown as plain Unicode text in a monospace chip.
- Voice transcripts are stored as plain text in SQLite when the student allows it; delete from the page.
