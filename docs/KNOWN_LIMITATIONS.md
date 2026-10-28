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
