# Testing

## Automated (`npm test`, 31 tests)
- `flow.test.ts` — registration, guardian consent, password hashing, CSRF, full register→lesson→test→result→certificate journey, duplicate/attempt limits, RBAC, parent isolation, manual review → finalise → reissue → revoke → verify.
- `units.test.ts` — grading, SSRF blocking, solver, Tamil PDF, tutor, under-13 limits, materials privacy, real PDF text extraction, scanned-PDF detection.
- `timing.test.ts` — deadline, idempotent submit, expiry settle, review visibility, draft-question publish rule.

## Browser audits (manual run; need Playwright + a running server)
```bash
BASE_URL=http://localhost:3001 node e2e/responsive.mjs   # 8 widths 320–1920, all roles, horizontal overflow
BASE_URL=http://localhost:3001 node e2e/a11y.mjs          # axe-core, serious/critical only
```
Last run: 376 page×width combinations with 0 overflow; 50 views with 0 serious/critical axe violations. Axe covers automated checks only — keyboard and screen-reader testing by people is still needed.

Also run: `npm run typecheck`, `npm run build`.
