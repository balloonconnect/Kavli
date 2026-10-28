# Testing

## Automated (`npm test`, 38 tests)
- `flow.test.ts` — registration, guardian consent, password hashing, CSRF, full register→lesson→test→result→certificate journey, duplicate/attempt limits, RBAC, parent isolation, manual review → finalise → reissue → revoke → verify.
- `units.test.ts` — grading, SSRF blocking, solver, Tamil PDF, tutor, under-13 limits, materials privacy, real PDF text extraction, scanned-PDF detection.
- `signup.test.ts` — shared sign-up: student profile in one request, under-13 guardian rules, no admin self-registration, pending teacher/school-admin and approval, parent link codes.
- `timing.test.ts` — deadline, idempotent submit, expiry settle, review visibility, draft-question publish rule.

## Browser audits
The responsive (376 combos, 0 overflow) and axe (50 views, 0 serious/critical) audits were run on the earlier, fuller UI. That UI has since been trimmed (see below), the audit scripts were removed with it, and the trimmed UI has only been checked manually at 375px (sign-in, dashboard, tutor). Re-run proper audits before relying on them.

Also run: `npm run typecheck`, `npm run build`.
