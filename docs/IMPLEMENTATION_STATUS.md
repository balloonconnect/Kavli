# Implementation status

> **Front end:** the student flow (lessons, tutor, material, practice, tests, results, certificates, verify) and the shared sign-up are present. Parent, teacher, school-admin and platform-admin screens are not in the UI. Route smoke-tested against the real server and in UI-preview mode; the earlier responsive/axe audits predate the latest changes.

Legend: **Verified** = covered by automated tests or exercised in a real browser. **Implemented** = built but not independently verified. **Not done** = absent.

| Area | Status | Evidence / note |
|---|---|---|
| Auth, sessions, CSRF, RBAC, tenant isolation | Verified | flow.test.ts |
| Registration, profile, under-13 guardian consent | Verified | flow.test.ts, units.test.ts |
| Lessons (Tamil/English/both) | Verified | browser; sample content |
| AI tutor chat | Verified (dev tutor) | browser + tests; live LLM path **Implemented** only |
| Learn from Your Material (PDF, URL, typed text) | Verified | tests + browser; SSRF blocked |
| Photo OCR / scanned-PDF OCR | Not done without key / Not done | see limitations |
| Practice centre | Verified | browser |
| Weekly tests: timer, autosave, submit, retake, review | Verified | timing.test.ts, browser |
| Manual review of written answers | Verified | flow.test.ts |
| Certificates: PDF (Tamil), QR, verify, revoke, reissue, audit | Verified | tests + browser |
| Parent / teacher / school / admin screens | Verified | tests + browser |
| Responsive 320–1920 | Verified | 376 combos, 0 horizontal overflow |
| Accessibility | Partly verified | 50 views, 0 serious/critical axe; no manual AT testing |
| Email/SMS, password reset, Postgres, OCR for scans | Not done | |

Tests: 31 passing. No integration is claimed beyond the table above.

## Mind Map (Learn page)

Status: implemented and tested (7 API/unit tests; browser-checked at 1280 and 375 px in UI-preview mode).

- Lesson page now has tabs: Explanation · Mind Map · Examples · Practice questions · Quick revision (`?tab=` in the URL).
- `GET /api/lessons/:id/mindmap` builds the map **from the lesson's own content** (no AI text, nothing invented), validates it with a zod schema (single root, unique ids, no cycles, size cap), and caches it by content hash. `defaultMode` is Simple for Classes 1–5.
- `PUT /api/lessons/:id/mindmap/state` and `GET /api/mindmaps/recent` store each student's understood / revise-later marks and recently viewed maps in the existing `settings` table (no migration); shared lesson content is never modified.
- UI: SVG map with zoom, pan, pinch, Fit, Reset, expand/collapse, search, Simple/Detailed/Quick-revision modes, Tamil / English / both, keyboard-focusable nodes, a detail panel, and links into the existing tutor (explain simply / in Tamil / in English / example / step by step / practice question).
- Export: PNG download, and Print / Save as PDF (via the browser print dialog).

Limits: maps are only as rich as the (sample) lesson content; there is no AI-generated map yet; "practice this branch" opens the tutor's practice action and the subject practice page, not branch-specific server questions; "save to learning materials" and sharing links are not implemented; in UI-preview mode marks live only in the browser tab.
