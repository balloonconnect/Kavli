import { Router } from 'express';
import { z } from 'zod';
import { DB, q } from '../db';
import { rateLimit, requireRole, uid } from '../security';
import { iso } from '../clock';
import { J, parse, wrap } from '../http';
import { HttpError } from '../services/tests';
import { myProfile } from './student';
import { initialState, MODES, ruleEngine, TeachEngine, TurnEvent, State } from '../services/teach';

/** Limits concurrent AI work; extra requests wait in a queue and give up with a clear message instead of piling up. */
export class Gate {
  private active = 0; private waiting: (() => void)[] = [];
  constructor(public max: number, private waitMs: number) {}
  get stats() { return { active: this.active, queued: this.waiting.length, max: this.max }; }
  async acquire(): Promise<() => void> {
    if (this.active < this.max) { this.active++; return () => this.release(); }
    await new Promise<void>((ok, no) => { const t = setTimeout(() => { this.waiting = this.waiting.filter(w => w !== go); no(new HttpError(503, 'The tutor is busy right now. Please try again in a few seconds.')); }, this.waitMs); const go = () => { clearTimeout(t); ok(); }; this.waiting.push(go); });
    this.active++; return () => this.release();
  }
  private release() { this.active--; this.waiting.shift()?.(); }
}

const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const LANG = z.enum(['ta', 'en', 'both']);

/**
 * Voice tutor API. Speech recognition and speech synthesis run in the student's browser (no audio is sent to our server);
 * this API holds the teaching state, the transcript (if the student allows it), usage limits and latency metrics.
 * `engine` is replaceable: any TeachEngine that yields the same events can sit behind the same UI.
 */
export function voiceRoutes(db: DB, engine: TeachEngine = ruleEngine, opts: { maxConcurrency?: number; queueMs?: number } = {}) {
  const r = Router(); const S = requireRole('student');
  const gate = new Gate(opts.maxConcurrency ?? Number(process.env.VOICE_MAX_CONCURRENCY ?? 8), opts.queueMs ?? Number(process.env.VOICE_QUEUE_MS ?? 8000));
  const inflight = new Set<string>();
  const own = (id: string, userId: string) => { const s = q.get<any>(db, 'SELECT * FROM voice_sessions WHERE id=? AND user_id=?', id, userId); if (!s) throw new HttpError(404, 'Voice session not found.'); return s; };
  const view = (s: any) => ({ id: s.id, mode: s.mode, lang: s.lang, showBoth: !!s.show_both, subjectId: s.subject_id, lessonId: s.lesson_id, topic: s.topic, status: s.status, saveTranscript: !!s.save_transcript, state: J(s.state), createdAt: s.created_at, updatedAt: s.updated_at });
  const dailyLimit = () => Number(q.get<any>(db, "SELECT value FROM settings WHERE key='voice_daily_limit'")?.value ?? 150);
  const usedToday = (userId: string) => q.get<any>(db, "SELECT COUNT(*) n FROM ai_usage WHERE user_id=? AND kind='voice' AND substr(at,1,10)=?", userId, iso().slice(0, 10))!.n as number;
  const guardian = (userId: string) => { const p = myProfile(db, userId)!; if (q.get<any>(db, 'SELECT value FROM settings WHERE key=?', `under13:${userId}`)?.value === '1' && !p.guardian_approved) throw new HttpError(403, 'A parent or guardian needs to approve your account before you can use the AI tutor. Ask them to link using your guardian code in Settings.'); return p; };

  r.get('/config', S, wrap(async (req, res) => res.json({
    transport: 'browser', realtimeProvider: false, engine: { name: engine.name, mock: engine.mock }, modes: MODES, limits: { dailyTurns: dailyLimit(), usedToday: usedToday(req.user!.id), maxConcurrency: gate.max },
    notes: 'Speech recognition and speech synthesis run in your browser. No audio is sent to Kalvi Mitra servers.' })));
  /** Placeholder for a hybrid real-time voice provider. Not implemented: needs a provider choice and server-side short-lived credentials. */
  r.post('/realtime-token', S, wrap(async () => { throw new HttpError(501, 'No real-time voice provider is configured. The tutor uses your browser’s speech recognition and speech synthesis.'); }));

  r.get('/sessions', S, wrap(async (req, res) => res.json({ sessions: q.all<any>(db, 'SELECT * FROM voice_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 20', req.user!.id).map(view) })));
  r.post('/sessions', S, wrap(async (req, res) => {
    const b = parse(z.object({ mode: z.enum(MODES as [string, ...string[]]).default('teach'), lang: LANG.optional(), showBoth: z.boolean().optional(), subjectId: z.string().max(40).nullish(), lessonId: z.string().max(80).nullish(), saveTranscript: z.boolean().default(true) }), req.body ?? {});
    const p = guardian(req.user!.id); let subject = b.subjectId ?? null, topic: string | null = null;
    if (b.lessonId) { const l = q.get<any>(db, 'SELECT subject_id,title_en,class_level FROM lessons WHERE id=?', b.lessonId); if (!l || l.class_level !== p.class_level) throw new HttpError(404, 'Lesson not found for your class.'); subject = l.subject_id; topic = l.title_en; }
    const id = uid(), now = iso(), lang = b.lang ?? p.ai_lang;
    q.run(db, 'INSERT INTO voice_sessions(id,user_id,mode,lang,show_both,subject_id,lesson_id,topic,state,save_transcript,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', id, req.user!.id, b.mode, lang, (b.showBoth ?? lang === 'both') ? 1 : 0, subject, b.lessonId ?? null, topic, JSON.stringify(initialState(b.mode as any)), b.saveTranscript ? 1 : 0, 'active', now, now);
    res.status(201).json({ session: view(q.get(db, 'SELECT * FROM voice_sessions WHERE id=?', id)) });
  }));
  r.get('/sessions/:id', S, wrap(async (req, res) => { const s = own(req.params.id, req.user!.id); res.json({ session: view(s), turns: q.all<any>(db, 'SELECT role,kind,content,step,at FROM voice_turns WHERE session_id=? ORDER BY id', s.id).map(t => ({ ...t, content: J(t.content) })) }); }));
  r.patch('/sessions/:id', S, wrap(async (req, res) => {
    const s = own(req.params.id, req.user!.id); const b = parse(z.object({ lang: LANG.optional(), showBoth: z.boolean().optional(), mode: z.enum(MODES as [string, ...string[]]).optional() }), req.body ?? {});
    if (b.mode && b.mode !== s.mode) { const st: State = { ...J(s.state), mode: b.mode, awaiting: null, quiz: null, done: false }; q.run(db, 'UPDATE voice_sessions SET mode=?, state=? WHERE id=?', b.mode, JSON.stringify(st), s.id); }
    if (b.lang) q.run(db, 'UPDATE voice_sessions SET lang=? WHERE id=?', b.lang, s.id); if (b.showBoth !== undefined) q.run(db, 'UPDATE voice_sessions SET show_both=? WHERE id=?', b.showBoth ? 1 : 0, s.id);
    res.json({ session: view(q.get(db, 'SELECT * FROM voice_sessions WHERE id=?', s.id)) });
  }));
  r.post('/sessions/:id/end', S, wrap(async (req, res) => { const s = own(req.params.id, req.user!.id); const st = J(s.state) as State; q.run(db, 'UPDATE voice_sessions SET status=?, updated_at=? WHERE id=?', st.done ? 'completed' : 'ended', iso(), s.id); res.json({ ok: true }); }));
  r.delete('/sessions/:id', S, wrap(async (req, res) => { const s = own(req.params.id, req.user!.id); q.run(db, 'DELETE FROM voice_sessions WHERE id=?', s.id); res.json({ ok: true }); }));

  r.post('/sessions/:id/turn', S, rateLimit(60, 60000, req => `voice:${req.user?.id ?? req.ip}`), wrap(async (req, res) => {
    const b = parse(z.object({ text: z.string().trim().max(1000).default(''), action: z.string().max(30).optional(), lang: LANG.optional(), via: z.enum(['voice', 'text']).default('text') }).refine(v => v.text || v.action, 'Say or type something first'), req.body);
    const s = own(req.params.id, req.user!.id); const p = guardian(req.user!.id);
    if (usedToday(req.user!.id) >= dailyLimit()) throw new HttpError(429, 'You have reached today’s voice tutor limit. Please try again tomorrow.');
    if (inflight.has(s.id)) throw new HttpError(409, 'The tutor is still answering your last message.');
    inflight.add(s.id); let release: (() => void) | undefined; let aborted = false;
    res.on('close', () => { if (!res.writableFinished) aborted = true; });
    try {
      release = await gate.acquire();
      const sse = String(req.headers.accept ?? '').includes('text/event-stream'); const t0 = Date.now(); let firstMs: number | null = null;
      if (sse) { res.status(200); res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive'); res.setHeader('X-Accel-Buffering', 'no'); res.flushHeaders(); }
      const lang = b.lang ?? s.lang; const state = J(s.state) as State; const events: TurnEvent[] = []; let doneEv: Extract<TurnEvent, { type: 'done' }> | undefined;
      const ctx = { db, userId: req.user!.id, sessionId: s.id, classLevel: p.class_level, lang, subjectId: s.subject_id as string | null, lessonId: s.lesson_id as string | null, state };
      for await (const ev of engine.turn(ctx, { text: b.text, action: b.action })) {
        if (aborted) break; if (firstMs === null) firstMs = Date.now() - t0;
        if (ev.type === 'done') doneEv = ev; else events.push(ev);
        if (sse) res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      }
      const total = Date.now() - t0; const now = iso();
      if (aborted || !doneEv) { q.run(db, 'INSERT INTO voice_metrics(user_id,session_id,kind,ms,at) VALUES (?,?,?,?,?)', req.user!.id, s.id, 'server_aborted', total, now); return; }
      const chunks = events.filter(e => e.type === 'chunk') as Extract<TurnEvent, { type: 'chunk' }>[];
      db.exec('BEGIN');
      try {
        q.run(db, 'UPDATE voice_sessions SET state=?, topic=COALESCE(?, topic), lang=?, status=?, updated_at=? WHERE id=?', JSON.stringify(doneEv.state), doneEv.state.plan?.topic.en ?? null, lang, doneEv.meta.completed ? 'completed' : 'active', now, s.id);
        if (s.save_transcript) {
          if (b.text) q.run(db, 'INSERT INTO voice_turns(session_id,role,kind,content,step,at) VALUES (?,?,?,?,?,?)', s.id, 'student', b.via, JSON.stringify({ text: b.text }), null, now);
          else if (b.action) q.run(db, 'INSERT INTO voice_turns(session_id,role,kind,content,step,at) VALUES (?,?,?,?,?,?)', s.id, 'student', 'action', JSON.stringify({ text: b.action }), null, now);
          for (const c of chunks) q.run(db, 'INSERT INTO voice_turns(session_id,role,kind,content,step,at) VALUES (?,?,?,?,?,?)', s.id, 'tutor', c.kind, JSON.stringify({ en: c.en, ta: c.ta, math: c.math ?? [], sources: c.sources ?? [], refs: c.refs ?? [] }), c.step ?? null, now);
        }
        q.run(db, 'INSERT INTO ai_usage(user_id,provider,kind,input_chars,output_chars,at) VALUES (?,?,?,?,?,?)', req.user!.id, engine.name, 'voice', b.text.length, chunks.reduce((n, c) => n + c.en.length + c.ta.length, 0), now);
        q.run(db, 'INSERT INTO voice_metrics(user_id,session_id,kind,ms,at) VALUES (?,?,?,?,?)', req.user!.id, s.id, 'server_first_event', firstMs ?? total, now);
        q.run(db, 'INSERT INTO voice_metrics(user_id,session_id,kind,ms,at) VALUES (?,?,?,?,?)', req.user!.id, s.id, 'server_full', total, now);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      if (sse) res.end(); else res.json({ events, state: doneEv.state, meta: doneEv.meta });
    } catch (e) {
      if (res.headersSent) { try { res.write(`event: error\ndata: ${JSON.stringify({ error: e instanceof HttpError ? e.message : 'The tutor could not answer just now. Please try again.' })}\n\n`); res.end(); } catch { /* closed */ } return; }
      throw e;
    } finally { release?.(); inflight.delete(s.id); }
  }));

  r.post('/sessions/:id/metrics', S, wrap(async (req, res) => {
    const s = own(req.params.id, req.user!.id); const b = parse(z.object({ kind: z.enum(['stt', 'first_text', 'first_audio', 'full', 'interrupted', 'tts_error', 'reconnect']), ms: z.number().int().min(0).max(300000) }), req.body);
    q.run(db, 'INSERT INTO voice_metrics(user_id,session_id,kind,ms,at) VALUES (?,?,?,?,?)', req.user!.id, s.id, b.kind, b.ms, iso()); res.json({ ok: true });
  }));
  r.get('/progress', S, wrap(async (req, res) => {
    const u = req.user!.id;
    res.json({
      completed: q.all<any>(db, "SELECT topic, mode, updated_at FROM voice_sessions WHERE user_id=? AND status='completed' AND topic IS NOT NULL ORDER BY updated_at DESC LIMIT 30", u),
      mistakes: q.all<any>(db, 'SELECT COALESCE(topic,\'General\') topic, COUNT(*) wrong FROM voice_quiz WHERE user_id=? AND correct=0 GROUP BY topic ORDER BY wrong DESC LIMIT 10', u),
      quiz: q.get<any>(db, 'SELECT COUNT(*) total, COALESCE(SUM(correct),0) correct FROM voice_quiz WHERE user_id=?', u),
    });
  }));
  /** Operational metrics (no conversation content). */
  const admin = requireRole('admin', 'school_admin');
  r.get('/metrics', admin, wrap(async (_req, res) => {
    const rows = q.all<any>(db, 'SELECT kind, ms FROM voice_metrics ORDER BY id DESC LIMIT 5000'); const by: Record<string, number[]> = {}; for (const m of rows) (by[m.kind] ??= []).push(m.ms);
    res.json({ gate: gate.stats, latencyMs: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.length, p50: pct(v, 50), p95: pct(v, 95) }])) });
  }));
  return r;
}
