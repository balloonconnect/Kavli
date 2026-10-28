import { Router } from 'express';
import { z } from 'zod';
import { DB, q, tx } from '../db';
import { COOKIE, audit, createSession, destroySession, hashPassword, parseCookies, rateLimit, requireAuth, uid, verifyPassword } from '../security';
import { iso } from '../clock';
import { parse, wrap } from '../http';
import { HttpError } from '../services/tests';
import { readableId } from '../seed';

const pw = z.string().min(8, 'Use at least 8 characters').max(128).refine(s => /[A-Za-z]/.test(s) && /\d/.test(s), 'Use letters and at least one number');
const Reg = z.object({ displayName: z.string().trim().min(1, 'Enter a name').max(60), email: z.string().trim().toLowerCase().email('Enter a valid email'), password: pw, role: z.enum(['student', 'parent']).default('student'),
  consent: z.literal(true, { message: 'Please accept the terms and privacy notice' }), under13: z.boolean().default(false) });
const Login = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

export function authRoutes(db: DB) {
  const r = Router(); const secure = process.env.NODE_ENV === 'production';
  const setCookie = (res: any, token: string) => res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, maxAge: 7 * 864e5, path: '/' });
  r.post('/register', rateLimit(10, 600000), wrap(async (req, res) => {
    const b = parse(Reg, req.body);
    if (q.get(db, 'SELECT 1 FROM users WHERE email=?', b.email)) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
    const id = uid(); const hash = await hashPassword(b.password);
    tx(db, () => {
      q.run(db, 'INSERT INTO users(id,email,display_name,password_hash,role,consent_at,created_at) VALUES (?,?,?,?,?,?,?)', id, b.email, b.displayName, hash, b.role, iso(), iso());
      audit(db, id, 'user.register', 'user', id, { role: b.role });
      if (b.role === 'student') q.run(db, 'INSERT INTO settings VALUES (?,?)', `under13:${id}`, b.under13 ? '1' : '0');
    });
    const s = createSession(db, id); setCookie(res, s.token);
    res.status(201).json({ user: { id, email: b.email, display_name: b.displayName, role: b.role }, csrf: s.csrf, needsProfile: b.role === 'student' });
  }));
  r.post('/login', rateLimit(15, 600000, req => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`), wrap(async (req, res) => {
    const b = parse(Login, req.body);
    const u = q.get<any>(db, 'SELECT * FROM users WHERE email=?', b.email);
    const ok = u && !u.disabled && await verifyPassword(b.password, u.password_hash);
    if (!ok) { audit(db, u?.id ?? null, 'auth.login_failed', 'user', u?.id); throw new HttpError(401, 'Email or password is incorrect.'); }
    const s = createSession(db, u.id); setCookie(res, s.token); audit(db, u.id, 'auth.login', 'user', u.id);
    res.json({ user: { id: u.id, email: u.email, display_name: u.display_name, role: u.role }, csrf: s.csrf });
  }));
  r.post('/logout', wrap(async (req, res) => { const t = parseCookies(req.headers.cookie)[COOKIE]; if (t) destroySession(db, t); res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); }));
  r.get('/me', requireAuth, wrap(async (req, res) => {
    const u = req.user!; const p = u.role === 'student' ? q.get<any>(db, 'SELECT * FROM student_profiles WHERE user_id=?', u.id) : null;
    res.json({ user: u, csrf: req.csrf, profile: p ? shapeProfile(p) : null, needsProfile: u.role === 'student' && !p?.completed_at });
  }));
  return r;
}
export function shapeProfile(p: any) { return { ...p, subjects: JSON.parse(p.subjects), goals: JSON.parse(p.goals), voice_prefs: JSON.parse(p.voice_prefs) }; }
export { readableId };
