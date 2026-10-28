# Known limitations

- **Tutor** is a rule-based, clearly labelled "development tutor" unless `ANTHROPIC_API_KEY` is configured. The real-model path is implemented but was not exercised against the live API here.
- **OCR**: photo text reading needs a configured key; scanned-PDF OCR is not implemented. Students can type the text instead.
- **Curriculum**: sample content only (published for Class 8; placeholders elsewhere). Not official Samacheer Kalvi text; needs review by qualified educators.
- **Database**: SQLite via experimental `node:sqlite`; no Postgres, single instance.
- **No email/SMS**, password reset, or guardian identity verification beyond a consent record.
- **Test integrity** in a browser is limited (no proctoring); server timing and autosave are authoritative.
- **Voice** input/output depends on the browser's Speech APIs and is hidden when unsupported.
- **Draft question generator** is maths-only; all generated questions need human review before publishing.
- **Accessibility**: automated axe checks pass; no manual screen-reader audit yet.
- **Uploads**: type/size/magic-byte checks, but no antivirus scanning.
- No ESLint config; no CI pipeline.
- **Sign-up**: email verification and guardian-approval emails are not sent (no email service). Under-13 approval happens only through the student's guardian link code. Staff approval has an API but no admin screen yet. The UI uses `/app`, not the `/student/...` route names from the master prompt.
- **Existing dev databases** created before the `pending` role was added must be deleted (`data/kavli.db`) so the new schema is created.
- **UI-preview mode** (`.env.production`) fakes the API in the browser; sign-ups there are kept for the tab only.
- **UI-preview mode** replays one recorded run (sample student, canned passing test, canned practice set and material answers); it does not grade or persist anything. It exists only to review screens without a backend.

## Class 8 textbook import (English, Tamil, Mathematics)

- **English (imported, partial):** 6 lessons from the Class 8 English textbook (Unit 1 and Unit 2: prose, poem, supplementary) are in `server/curriculum/class8-english.json`. The text we received from the Drive connector stops partway through Unit 3, so the rest of the book (Units 3–7 and the play) is **not** imported. Each lesson is a short excerpt with its source and starting page, shown in English only. Run `scripts/import-textbook.ts` again with a fuller extraction to add the rest.
- **Tamil (not imported):** the extracted text is corrupted (the PDF's font mapping is broken, e.g. "தமிழ்நாடு" comes out as "தமிழ்்நநாடு"). It needs OCR of the original PDF with Tamil language data (`tam.traineddata`), which needs the PDF file itself.
- **Mathematics, Tamil medium (not imported):** the PDF has no text layer at all (scanned pages), so it also needs OCR of the original file.
- Files over 10 MB cannot be downloaded through the Drive connector and Drive is not reachable from the build environment, so the three PDFs (67 MB, 17 MB, 40 MB) must be attached to the chat or placed in the project folder.
- Textbook lessons are excerpts for learning and tutor grounding. They are not a replacement for the printed textbook. Check Tamil Nadu Textbook Corporation terms before publishing more than short excerpts.

- Slow/offline behaviour was tested with the browser offline switch only, not on real 2G/3G links; Tamil rendering was checked on desktop Chromium fonts, not on physical low-end Android devices.
- Side-by-side bilingual view relies on the existing "both languages" mode; no separate per-message toggle was added. The preview tutor remains canned.
- axe accessibility scan not run.

- Class books: scanned/image-only PDFs can be opened by students but the chatbot cannot answer from them (no OCR). One PDF is one "book"; no chapter splitting. Hosting official textbooks requires the right to share them. The UI-preview (Vercel) build has no backend, so the book screens show an empty list there. The Anthropic-API tutor path does not yet attach book page links (only the built-in tutor does).
