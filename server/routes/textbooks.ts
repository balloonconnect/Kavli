import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { storage } from '../services/storage';
import { join } from 'node:path';
import { DB, q } from '../db';
import { rateLimit, requireAuth, requireRole, uid } from '../security';
import { iso } from '../clock';
import { parse, wrap } from '../http';
import { HttpError } from '../services/tests';
import { textbookHits } from '../services/tutor';
import { extractAll, ocrQueue, putPages, runOcr, triage } from '../services/textbookIngest';
import { getOcrEngine } from '../services/ocr';

const MAX = 60 * 1024 * 1024;
const STAFF = ['teacher', 'school_admin', 'admin'];
/** Class books. The platform admin uploads a PDF with its class; students only ever see, open and are answered from books of their own class. */
export function textbookRoutes(db: DB) {
  const r = Router(); const admin = requireRole('admin' as any); // only the platform admin can add or remove books; teachers read only
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX, files: 1 } });
  const studentClass = async (userId: string) => (await q.get<any>(db, 'SELECT class_level FROM student_profiles WHERE user_id=?', userId))?.class_level as number | undefined;
  const allowed = async (req: any, b: any) => { if (STAFF.includes(req.user.role)) return true; if (req.user.role === 'student') return (await studentClass(req.user.id)) === b.class_level; return false; };
  const view = (b: any) => ({ id: b.id, title: b.title, class_level: b.class_level, subject_id: b.subject_id, medium: b.medium, page_count: b.page_count, status: b.status, note: b.note, created_at: b.created_at });
  const get = async (id: string) => { const b = (await q.get<any>(db, 'SELECT * FROM textbooks WHERE id=?', id)); if (!b) throw new HttpError(404, 'Book not found.'); return b; };

  r.get('/', requireAuth, wrap(async (req, res) => {
    const u = req.user!; let rows: any[];
    if (STAFF.includes(u.role)) rows = (await q.all<any>(db, 'SELECT * FROM textbooks ORDER BY class_level, subject_id, title'));
    else if (u.role === 'student') { const c = await studentClass(u.id); rows = c ? (await q.all<any>(db, "SELECT * FROM textbooks WHERE class_level=? AND status IN ('ready','needs_ocr','processing') ORDER BY subject_id, title", c)) : []; }
    else rows = [];
    res.json({ textbooks: rows.map(view) });
  }));

  r.post('/', admin, rateLimit(10, 600000, req => req.user!.id), upload.single('file'), wrap(async (req, res) => {
    const b = parse(z.object({ title: z.string().trim().min(2).max(120), classLevel: z.coerce.number().int().min(1).max(12), subjectId: z.string().trim().max(40).optional(), medium: z.enum(['English', 'Tamil']).default('English') }), req.body);
    const f = req.file; if (!f) throw new HttpError(400, 'Choose a PDF file first.');
    if (f.buffer.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(415, 'Please choose a PDF file.');
    let subject: string | null = null;
    if (b.subjectId) { if (!(await q.get(db, 'SELECT id FROM subjects WHERE id=?', b.subjectId))) throw new HttpError(400, 'Unknown subject.'); subject = b.subjectId; }
    let pages: { page: number; text: string }[] = []; let status = 'ready', note: string | null = null;
    try { pages = await extractAll(f.buffer); } catch { status = 'failed'; note = 'This PDF could not be read. It may be damaged or password protected.'; }
    if (status === 'failed') throw new HttpError(422, note!);
    // Use the PDF's own text only where it is trustworthy; scanned or badly-encoded pages (common in older Tamil books) go to OCR.
    const { good, bad } = triage(pages, b.medium); const engine = bad.length ? await getOcrEngine() : null;
    if (bad.length && engine) { status = 'processing'; note = `Reading ${bad.length} page${bad.length > 1 ? 's' : ''} with OCR. The book opens now; the tutor can use it as the pages finish.`; }
    else if (bad.length && good.length < Math.max(1, Math.floor(pages.length / 4))) { status = 'needs_ocr'; note = 'Most pages are scanned images or use an unreadable text encoding, and OCR is not available on this server. Students can open this book, but the tutor cannot answer from it yet.'; }
    else if (bad.length) note = `${bad.length} page${bad.length > 1 ? 's' : ''} have no readable text (images or unusual encoding) and are skipped by the tutor.`;
    const id = uid(); const path = storage().newKey('textbooks', 'pdf'); await storage().put(path, f.buffer, 'application/pdf');
    await q.run(db, 'INSERT INTO textbooks(id,title,class_level,subject_id,medium,file_path,size,page_count,status,note,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', id, b.title, b.classLevel, subject, b.medium, path, f.size, pages.length, status, note, req.user!.id, iso());
    await putPages(db, id, good);
    if (status === 'processing') ocrQueue.add(() => runOcr(db, id, bad));
    res.status(201).json({ textbook: view(await get(id)) });
  }));

  /** Pages of the student's own class books that relate to one lesson (a few excerpts, never the whole book). */
  r.get('/for-lesson/:lessonId', requireAuth, wrap(async (req, res) => {
    const u = req.user!; const l = (await q.get<any>(db, 'SELECT id,class_level,subject_id,title_en,content FROM lessons WHERE id=?', req.params.lessonId));
    if (!l) throw new HttpError(404, 'Lesson not found.');
    if (u.role === 'student' ? (await studentClass(u.id)) !== l.class_level : !STAFF.includes(u.role)) return res.json({ pages: [] });
    let c: any = {}; try { c = JSON.parse(l.content); } catch { /* ignore */ }
    const query = [l.title_en, ...(c.sections ?? []).map((x: any) => `${x.h_en} ${x.en}`), ...(c.vocab ?? []).map((v: any) => v.en ?? v.term_en ?? '')].join(' ');
    const seen = new Set<string>(); const pages: any[] = [];
    for (const h of await textbookHits(db, l.class_level, l.subject_id, query, 12)) { const k = `${h.bookId}:${h.page}`; if (seen.has(k) || pages.length >= 4) continue; seen.add(k); pages.push({ bookId: h.bookId, book: h.source, page: h.page, excerpt: h.text.slice(0, 320) }); }
    res.json({ pages });
  }));

  r.get('/:id', requireAuth, wrap(async (req, res) => { const b = await get(req.params.id); if (!(await allowed(req, b))) throw new HttpError(404, 'Book not found.'); res.json({ textbook: view(b) }); }));
  r.get('/:id/pages/:n', requireAuth, wrap(async (req, res) => {
    const b = await get(req.params.id); if (!(await allowed(req, b))) throw new HttpError(404, 'Book not found.');
    const n = Number(req.params.n); const p = Number.isInteger(n) ? (await q.get<any>(db, 'SELECT page,text FROM textbook_pages WHERE textbook_id=? AND page=?', b.id, n)) : undefined;
    res.json({ page: n, text: p?.text ?? '', pageCount: b.page_count });
  }));
  r.get('/:id/file', requireAuth, wrap(async (req, res) => {
    const b = await get(req.params.id); if (!(await allowed(req, b)) || !(await storage().exists(b.file_path))) throw new HttpError(404, 'Book not found.');
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="${b.id}.pdf"`);
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Content-Security-Policy', "frame-ancestors 'self'"); res.setHeader('Cache-Control', 'private, max-age=300');
    (await storage().stream(b.file_path)).pipe(res);
  }));
  /** Re-run OCR on the pages that have no usable text (e.g. after OCR was installed). */
  r.post('/:id/ocr', admin, rateLimit(10, 600000, req => req.user!.id), wrap(async (req, res) => {
    const b = await get(req.params.id); if (b.status === 'processing') throw new HttpError(409, 'This book is already being read.');
    if (!(await getOcrEngine())) throw new HttpError(501, 'OCR is not available on this server.');
    const have = new Set((await q.all<any>(db, 'SELECT page FROM textbook_pages WHERE textbook_id=?', b.id)).map(r => r.page as number));
    const todo = Array.from({ length: b.page_count }, (_, i) => i + 1).filter(n => !have.has(n)); if (!todo.length) throw new HttpError(409, 'Every page already has text.');
    await q.run(db, "UPDATE textbooks SET status='processing', note=? WHERE id=?", `Reading ${todo.length} pages with OCR.`, b.id); ocrQueue.add(() => runOcr(db, b.id, todo));
    res.status(202).json({ textbook: view(await get(b.id)) });
  }));
  r.delete('/:id', admin, wrap(async (req, res) => {
    const b = await get(req.params.id); await storage().delete(b.file_path);
    await q.run(db, 'DELETE FROM textbook_pages WHERE textbook_id=?', b.id); await q.run(db, 'DELETE FROM textbooks WHERE id=?', b.id); res.json({ ok: true });
  }));
  return r;
}
