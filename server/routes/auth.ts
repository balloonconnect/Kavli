import { Router } from 'express';
import { z } from 'zod';
import { DB, q, tx } from '../db';
import { COOKIE, audit, createSession, destroySession, hashPassword, parseCookies, rateLimit, requireAuth, uid, verifyPassword } from '../security';
import { iso } from '../clock';
import { parse, wrap } from '../http';
import { HttpError } from '../services/tests';
import { readableId, DEMO_USERNAMES } from '../seed';

const J = (v: string) => JSON.parse(v);
const pw = z.string().min(8, 'Use at least 8 characters').max(128).refine(s => /[A-Za-z]/.test(s) && /\d/.test(s), 'Use letters and at least one number');
const Subjects = z.array(z.string().trim().min(1).max(40)).max(12);
const Reg = z.object({
  displayName: z.string().trim().min(1, 'Enter your full name').max(60), email: z.string().trim().toLowerCase().email('Enter a valid email'), password: pw,
  role: z.enum(['student', 'parent', 'teacher', 'school_admin']).default('student'),
  consent: z.literal(true, { message: 'Please accept the terms and privacy notice' }),
  under13: z.boolean().default(false), guardianName: z.string().trim().max(60).optional(), guardianEmail: z.string().trim().toLowerCase().max(254).optional(),
  student: z.object({ classLevel: z.number().int().min(1).max(12), medium: z.enum(['Tamil', 'English']), aiLang: z.enum(['ta', 'en', 'both']), academicYear: z.string().regex(/^\d{4}[–-]\d{4}$/, 'Use a format like 2026–2027'), subjects: Subjects.min(1, 'Choose at least one subject'), schoolName: z.string().trim().max(120).optional() }).optional(),
  parent: z.object({ relationship: z.enum(['mother', 'father', 'guardian', 'other']).optional(), linkCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, 'Enter the 6-character code').optional().or(z.literal('')) }).optional(),
  staff: z.object({ schoolName: z.string().trim().min(2, 'Enter the school or institution name').max(120), subjects: Subjects.optional(), classes: z.array(z.number().int().min(1).max(12)).max(12).optional(), code: z.string().trim().max(40).optional(), institutionEmail: z.string().trim().toLowerCase().max(254).optional() }).optional(),
}).superRefine((b, c) => {
  const need = (ok: boolean, path: (string | number)[], message: string) => { if (!ok) c.addIssue({ code: 'custom', path, message }); };
  if (b.role === 'student') {
    if (b.under13) { need(!!b.guardianName && b.guardianName.length >= 2, ['guardianName'], 'Enter a parent or guardian name'); need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.guardianEmail ?? ''), ['guardianEmail'], 'Enter a valid guardian email'); }
  }
  if (b.role === 'teacher' || b.role === 'school_admin') need(!!b.staff, ['staff'], 'Enter your school details');
  if (b.role === 'teacher') { need((b.staff?.subjects?.length ?? 0) > 0, ['staff', 'subjects'], 'Choose at least one subject'); need((b.staff?.classes?.length ?? 0) > 0, ['staff', 'classes'], 'Choose at least one class'); }
  if (b.role === 'school_admin') need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.staff?.institutionEmail ?? ''), ['staff', 'institutionEmail'], 'Enter your institution email');
});
let _dummy: Promise<string> | null = null; const dummyHash = () => (_dummy ??= hashPassword('not-a-real-password'));
const Login = z.object({ email: z.string().trim().toLowerCase().min(1).max(254), password: z.string().min(1).max(128) });

export function authRoutes(db: DB) {
  const r = Router(); const secure = process.env.NODE_ENV === 'production';
  const setCookie = (res: any, token: string) => res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, maxAge: 7 * 864e5, path: '/' });
  r.post('/register', rateLimit(10, 600000), wrap(async (req, res) => {
    const b = parse(Reg, req.body);
    if (q.get(db, 'SELECT 1 FROM users WHERE email=?', b.email)) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
    // Privileged roles are never self-assigned: teacher and school-admin sign-ups start as "pending" until a platform admin approves them.
    const privileged = b.role === 'teacher' || b.role === 'school_admin'; const dbRole = privileged ? 'pending' : b.role;
    const link = b.role === 'parent' && b.parent?.linkCode ? J(q.get<any>(db, 'SELECT value FROM settings WHERE key=?', `gcode:${b.parent.linkCode}`)?.value ?? 'null') : null;
    if (b.role === 'parent' && b.parent?.linkCode && (!link || link.exp < Date.now())) throw new HttpError(422, 'That student link code is invalid or has expired. Check it, or leave it blank and link later.');
    const id = uid(); const hash = await hashPassword(b.password); const t = iso();
    tx(db, () => {
      q.run(db, 'INSERT INTO users(id,email,display_name,password_hash,role,consent_at,created_at) VALUES (?,?,?,?,?,?,?)', id, b.email, b.displayName, hash, dbRole, t, t);
      audit(db, id, 'user.register', 'user', id, { role: dbRole, requested: b.role });
      if (b.role === 'student') q.run(db, 'INSERT INTO settings VALUES (?,?)', `under13:${id}`, b.under13 ? '1' : '0');
      if (b.role === 'student' && b.under13) q.run(db, 'INSERT INTO settings VALUES (?,?)', `guardian:${id}`, JSON.stringify({ name: b.guardianName, email: b.guardianEmail }));
      if (b.role === 'student' && b.student) {
        const st = b.student;
        q.run(db, 'INSERT INTO student_profiles(user_id,ref_no,full_name,full_name_ta,preferred_name,class_level,medium,ai_lang,academic_year,school_name,school_ref,subjects,goals,avatar,voice_prefs,guardian_approved,completed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          id, readableId('KM'), b.displayName, null, null, st.classLevel, st.medium, st.aiLang, st.academicYear, st.schoolName || null, null, JSON.stringify(st.subjects), '[]', null, JSON.stringify({ readAloud: false, rate: 1 }), b.under13 ? 0 : 1, t, t);
      }
      if (b.role === 'parent') {
        if (b.parent?.relationship) q.run(db, 'INSERT INTO settings VALUES (?,?)', `relationship:${id}`, b.parent.relationship);
        if (link) { q.run(db, 'INSERT INTO guardian_links(parent_id,student_id) VALUES (?,?) ON CONFLICT DO NOTHING', id, link.studentId); q.run(db, 'UPDATE student_profiles SET guardian_approved=1 WHERE user_id=?', link.studentId); q.run(db, 'DELETE FROM settings WHERE key=?', `gcode:${b.parent!.linkCode}`); audit(db, id, 'guardian.link', 'user', link.studentId); }
      }
      if (privileged) q.run(db, 'INSERT INTO settings VALUES (?,?)', `rolereq:${id}`, JSON.stringify({ requested: b.role, ...b.staff, status: 'pending', at: t }));
    });
    const s = createSession(db, id); setCookie(res, s.token);
    res.status(201).json({ user: { id, email: b.email, display_name: b.displayName, role: dbRole }, csrf: s.csrf, needsProfile: b.role === 'student' && !b.student, requestedRole: b.role, pendingApproval: privileged });
  }));
  r.post('/login', rateLimit(15, 600000, req => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`), wrap(async (req, res) => {
    const b = parse(Login, req.body);
    const ident = process.env.SEED_DEMO === '0' ? b.email : (DEMO_USERNAMES[b.email] ?? b.email);
    const u = q.get<any>(db, 'SELECT * FROM users WHERE email=?', ident);
    // always run one password hash, even for unknown accounts, so response time does not reveal which emails exist
    const ok = u ? !u.disabled && await verifyPassword(b.password, u.password_hash) : (await verifyPassword(b.password, await dummyHash()), false);
    if (!ok) { audit(db, u?.id ?? null, 'auth.login_failed', 'user', u?.id); throw new HttpError(401, 'Email or password is incorrect.'); }
    const s = createSession(db, u.id); setCookie(res, s.token); audit(db, u.id, 'auth.login', 'user', u.id);
    res.json({ user: { id: u.id, email: u.email, display_name: u.display_name, role: u.role }, csrf: s.csrf });
  }));
  r.post('/logout', wrap(async (req, res) => { const t = parseCookies(req.headers.cookie)[COOKIE]; if (t) destroySession(db, t); res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); }));
  r.get('/me', wrap(async (req, res) => {
    if (!req.user) return void res.json({ user: null });
    const u = req.user; const p = u.role === 'student' ? q.get<any>(db, 'SELECT * FROM student_profiles WHERE user_id=?', u.id) : null;
    res.json({ user: u, csrf: req.csrf, profile: p ? shapeProfile(p) : null, needsProfile: u.role === 'student' && !p?.completed_at });
  }));
  return r;
}
export function shapeProfile(p: any) { return { ...p, subjects: JSON.parse(p.subjects), goals: JSON.parse(p.goals), voice_prefs: JSON.parse(p.voice_prefs) }; }
export { readableId };
