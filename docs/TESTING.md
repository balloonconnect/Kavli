# Testing

## Automated (`npm test`, 163 tests; `voice.test.ts` covers the voice tutor — see `docs/VOICE_TUTOR.md`)
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
