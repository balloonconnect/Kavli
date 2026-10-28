// Accessibility audit with axe-core. Usage: BASE_URL=http://localhost:3001 node e2e/a11y.mjs   (requires `playwright` + a browser)
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE_URL ?? 'http://localhost:3001';
const PAGES = [['public', null, ['/', '/signin', '/signup', '/features', '/privacy', '/verify']],
  ['student', 'meena@demo.kavli.local', ['/app', '/app/learn', '/app/learn/c8-maths-linear', '/app/tutor', '/app/material', '/app/practice', '/app/tests', '/app/tests/test-maths-w6', '/app/progress', '/app/certificates', '/app/settings']],
  ['teacher', 'teacher@demo.kavli.local', ['/teacher', '/teacher/questions', '/teacher/tests', '/teacher/tests/new', '/teacher/reviews']], ['admin', 'admin@demo.kavli.local', ['/admin', '/admin/users', '/admin/audit']]];
const browser = await chromium.launch(); let bad = 0, n = 0;
for (const [role, email, routes] of PAGES) for (const w of [1280, 375]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 } }); const p = await ctx.newPage();
  if (email) { await p.goto(BASE + '/signin'); await p.getByLabel('Email').fill(email); await p.locator('#pw').fill('Demo@12345'); await p.getByRole('button', { name: 'Sign in', exact: true }).click(); await p.waitForURL(u => !u.pathname.startsWith('/signin')); }
  for (const r of routes) { await p.goto(BASE + r); await p.waitForSelector('h1', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300); await p.evaluate(axeSrc);
    const res = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes[0].target.join(' ') })));
    n++; for (const v of res) { bad++; console.log(`${role} ${w}px ${r}: ${v.id} (${v.impact}) x${v.n}  e.g. ${v.ex}`); } }
  await ctx.close(); }
await browser.close(); console.log(`\nAudited ${n} page views; ${bad} serious/critical violations.`); process.exit(bad ? 1 : 0);
