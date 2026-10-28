// Responsive/overflow audit. Usage: BASE_URL=http://localhost:3001 node e2e/responsive.mjs   (requires `playwright` + a browser)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:3001';
const WIDTHS = [320, 375, 430, 768, 1024, 1280, 1440, 1920];
const ROLES = {
  public: { email: null, routes: ['/', '/features', '/how-it-works', '/privacy', '/terms', '/child-safety', '/help', '/signin', '/signup', '/verify', '/verify/notarealtoken1234567'] },
  student: { email: 'meena@demo.kavli.local', routes: ['/app', '/app/learn', '/app/learn/c8-maths-linear', '/app/tutor', '/app/material', '/app/practice', '/app/tests', '/app/tests/test-maths-w6', '/app/progress', '/app/certificates', '/app/homework', '/app/bookmarks', '/app/settings'] },
  parent: { email: 'parent@demo.kavli.local', routes: ['/parent', '/parent/child/u-student', '/parent/settings'] },
  teacher: { email: 'teacher@demo.kavli.local', routes: ['/teacher', '/teacher/classes', '/teacher/classes/cls-8a', '/teacher/questions', '/teacher/tests', '/teacher/tests/new', '/teacher/tests/test-maths-w6', '/teacher/reviews', '/teacher/homework', '/teacher/certificates'] },
  school_admin: { email: 'school@demo.kavli.local', routes: ['/school', '/school/people', '/school/classes'] },
  admin: { email: 'admin@demo.kavli.local', routes: ['/admin', '/admin/users', '/admin/schools', '/admin/curriculum', '/admin/ai', '/admin/audit', '/admin/settings'] },
};
const browser = await chromium.launch(); let bad = 0, checked = 0;
for (const [role, cfg] of Object.entries(ROLES)) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } }); const p = await ctx.newPage();
    if (cfg.email) { await p.goto(BASE + '/signin'); await p.getByLabel('Email').fill(cfg.email); await p.locator('#pw').fill('demo@12345'); await p.getByRole('button', { name: 'Sign in', exact: true }).click(); await p.waitForURL(u => !u.pathname.startsWith('/signin')); }
    for (const r of cfg.routes) {
      await p.goto(BASE + r); await p.waitForSelector('h1, h2', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(250);
      const res = await p.evaluate(() => { const de = document.documentElement; const over = de.scrollWidth - de.clientWidth; const offenders = [];
        if (over > 0) document.querySelectorAll('body *').forEach(el => { const b = el.getBoundingClientRect(); if (b.right > de.clientWidth + 1 && b.width > 0 && !el.closest('.tablewrap,.bars,.sheet,.pop,.toasts,.msgs')) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`); });
        return { over, offenders: [...new Set(offenders)].slice(0, 4) }; });
      checked++; if (res.over > 0) { bad++; console.log(`OVERFLOW ${role} ${w}px ${r}: +${res.over}px  ${res.offenders.join(', ')}`); }
    }
    await ctx.close();
  }
}
await browser.close(); console.log(`\nChecked ${checked} page×width combinations; ${bad} with horizontal overflow.`); process.exit(bad ? 1 : 0);
