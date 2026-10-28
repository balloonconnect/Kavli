# Implementation status

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
