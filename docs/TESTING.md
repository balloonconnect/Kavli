# Testing

## Coverage
`npm run coverage` (server code, SQLite): about 90% of statements, 81% of branches, 92% of functions. `npm run smoke` is the end-to-end check against a running server (real HTTP, real OCR, retrieval, tutor).

## CI and lint
`npm run lint` and `npm run typecheck` must pass. GitHub Actions runs lint, type-check, the live front-end build, the whole suite on SQLite, the whole suite on a PostgreSQL 16 service, and a Docker build that starts the image and calls `/api/health`.

## Automated (`npm test`, 238 tests; `voice.test.ts` covers the voice tutor — see `docs/VOICE_TUTOR.md`)
- `flow.test.ts` — registration, guardian consent, password hashing, CSRF, full register→lesson→test→result→certificate journey, duplicate/attempt limits, RBAC, parent isolation, manual review → finalise → reissue → revoke → verify.
- `units.test.ts` — grading, SSRF blocking, solver, Tamil PDF, tutor, under-13 limits, materials privacy, real PDF text extraction, scanned-PDF detection.
- `signup.test.ts` — shared sign-up: student profile in one request, under-13 guardian rules, no admin self-registration, pending teacher/school-admin and approval, parent link codes.
- `timing.test.ts` — deadline, idempotent submit, expiry settle, review visibility, draft-question publish rule.

- `ocr.test.ts`, `storage.test.ts`, `llm.test.ts`, `azure-tts.test.ts` — text-layer quality and background OCR, local and S3 storage (AWS SDK against a mock S3), the tutor-model engine with a mock model server (citations, fallbacks, timeouts, retries), Azure Speech request format.

### Running on PostgreSQL
`node scripts/test-pg.mjs` starts a throwaway embedded PostgreSQL and runs the whole suite with `TEST_PG_URL` set (each test gets its own database). To use your own server instead: `TEST_PG_URL=postgres://user:pw@host/postgres npx vitest run` (the user needs permission to create databases). Both SQLite (default) and PostgreSQL pass all tests.

## Browser audits
The responsive (376 combos, 0 overflow) and axe (50 views, 0 serious/critical) audits were run on the earlier, fuller UI. That UI has since been trimmed (see below), the audit scripts were removed with it, and the trimmed UI has only been checked manually at 375px (sign-in, dashboard, tutor). Re-run proper audits before relying on them.

Also run: `npm run typecheck`, `npm run build`.

## Retrieval quality

`npx tsx scripts/eval-retrieval.ts [questions.json]` scores how well the tutor finds the right book page (rank-1, top-3, mean reciprocal rank, and whether unanswerable questions return nothing). Run it against a database holding the imported book after any change to retrieval or OCR, and compare with the numbers in `docs/KNOWN_LIMITATIONS.md`. The question file holds only questions and page numbers (no book text). Baseline before the BM25 + n-gram retriever: ranked first 54%, top-3 79%, MRR 0.65, unanswerable 2/3.

## Tamil quality: automated and manual

Automated (`tests/tamil-quality.test.ts`): NFC and zero-width clean-up, the three reference sentences, OCR noise and print-footer detection (using the real page-37 noise), protected dates/amounts/names/phone numbers, speech chunking, the model-result checks, the `/api/tamil/*` endpoints (no model, no voice, failing voice, daily allowance, length limits), and the font set-up (self-hosted Noto Sans Tamil, no letter-spacing on Tamil text).

Manual checklist (needs a browser and, for the last rows, a model key and a Tamil voice). Tick each on Windows Chrome, Android Chrome and iPhone Safari:

1. Open a Tamil lesson: vowel signs, pulli and ligatures look right; no gaps inside words; no horizontal scroll at 360 px width.
2. Paste into "Edit Tamil text": a WhatsApp message, a PDF excerpt, a Word paragraph, a line with emojis, a line mixing English words, a phone number and an amount. Nothing is lost on Copy.
3. "Listen in Tamil": the voice is Tamil (not English reading Tamil letters); play, pause, resume and stop work; speed 0.75× to 1.5× changes the pace; a 3-paragraph passage plays to the end without a gap or cut-off.
4. Edit the text while audio is playing: playback stops; pressing Listen reads the new text. Nothing plays on page load.
5. Device with no Tamil voice and no server voice: the player says so; it does not read in English.
6. Turn the network off while the AI voice is selected: a clear error appears.
7. With a model key: Correct / Simplify / Formal / Conversational / Translate on the three reference sentences. Check by eye that meaning, names, dates and amounts are unchanged; "Restore original" returns the first text.
8. Empty text, and text over 4000 characters: clear message, nothing breaks.
