import { Router } from 'express';
import { z } from 'zod';
import { DB, q } from '../db';
import { iso } from '../clock';
import { rateLimit } from '../security';
import { parse, wrap } from '../http';
import { HttpError } from '../services/tests';
import { LlmClient, llmClientFromEnv } from '../services/llmEngine';
import { Structure } from '../services/bookStructure';
import { ItemAi, ItemAiError, chapterMap, explainItem, itemHash, itemMindMap, itemPractice } from '../services/itemLearn';

/** The structured view of a book lesson: items in the book's order, per-item mind maps, practice and AI explanations (stored apart, labelled). */
export function structureRoutes(db: DB, opts: { llm?: LlmClient | null } = {}) {
  const r = Router(); const llm = opts.llm === undefined ? llmClientFromEnv() : opts.llm;
  const A = (req: any, _res: any, next: any) => (req.user ? next() : next(new HttpError(401, 'Please sign in.')));
  const load = async (id: string) => {
    const l = await q.get<any>(db, "SELECT * FROM lessons WHERE id=? AND status='published'", id); if (!l) throw new HttpError(404, 'Lesson not found.');
    const c = typeof l.content === 'string' ? JSON.parse(l.content) : l.content; const st = c?.structure as Structure | undefined;
    if (!st?.items?.length) throw new HttpError(404, 'This lesson has no structured view yet. Use “Re-read all pages” on the book.');
    return { l, st };
  };
  const item = (st: Structure, id: string) => { const it = st.items.find(i => i.id === id); if (!it) throw new HttpError(404, 'Item not found.'); return it; };
  const aiRow = async (lid: string, iid: string, kind: string, it: Structure['items'][number]) => {
    const row = await q.get<any>(db, 'SELECT * FROM item_ai WHERE lesson_id=? AND item_id=? AND kind=?', lid, iid, kind); if (!row) return null;
    return { ...JSON.parse(row.content) as ItemAi, label: 'AI-generated', model: row.model, createdAt: row.created_at, stale: row.source_hash !== itemHash(it) };
  };

  r.get('/lessons/:id/structure', A, wrap(async (req, res) => {
    const { l, st } = await load(req.params.id);
    const rows = await q.all<any>(db, 'SELECT item_id, kind, source_hash FROM item_ai WHERE lesson_id=?', l.id);
    const ai: Record<string, string[]> = {}; for (const x of rows) (ai[x.item_id] ??= []).push(x.kind);
    res.json({ lessonId: l.id, structure: st, ai, aiEnabled: !!llm, source: 'Original text is from the textbook as read by OCR; check the printed page where an item is flagged. Anything marked AI-generated was written by the app’s AI and is not part of the textbook.' });
  }));
  r.get('/lessons/:id/chapter-map', A, wrap(async (req, res) => { const { l, st } = await load(req.params.id); res.json({ map: chapterMap(l, st) }); }));
  r.get('/lessons/:id/items/:itemId', A, wrap(async (req, res) => {
    const { l, st } = await load(req.params.id); const it = item(st, req.params.itemId);
    const idx = st.items.filter(i => !['heading'].includes(i.kind)); const k = idx.findIndex(i => i.id === it.id);
    res.json({ item: it, explanation: await aiRow(l.id, it.id, 'explain', it), answer: await aiRow(l.id, it.id, 'answer', it), official: { hasAnswer: false, note: 'This textbook does not print an answer key for this item.' }, practice: itemPractice(st, it.id), prev: idx[k - 1]?.id ?? null, next: idx[k + 1]?.id ?? null, aiEnabled: !!llm });
  }));
  r.get('/lessons/:id/items/:itemId/mindmap', A, wrap(async (req, res) => {
    const { l, st } = await load(req.params.id); const it = item(st, req.params.itemId); const ex = await aiRow(l.id, it.id, 'explain', it);
    res.json({ map: itemMindMap(l, st, it.id, ex && !ex.stale ? ex : null) });
  }));
  r.post('/lessons/:id/items/:itemId/ai', A, rateLimit(20, 60000, req => `itemai:${req.user?.id ?? req.ip}`), wrap(async (req, res) => {
    const b = parse(z.object({ mode: z.enum(['explain', 'answer']).default('explain') }), req.body ?? {});
    const { l, st } = await load(req.params.id); const it = item(st, req.params.itemId);
    if (!llm) throw new HttpError(501, 'The AI explanation service is not set up on this server (no AI model key is configured). The textbook text is shown as it is.');
    if (b.mode === 'answer' && it.kind !== 'question') throw new HttpError(400, 'Only questions have answers.');
    if (b.mode === 'explain' && it.kind === 'question') throw new HttpError(400, 'Use mode “answer” for questions.');
    const ac = new AbortController(); res.on('close', () => { if (!res.writableFinished) ac.abort(); });
    try {
      const ai = await explainItem(llm, it, b.mode, { chapter: l.title_ta || l.title_en, signal: ac.signal });
      await q.run(db, 'INSERT INTO item_ai(lesson_id,item_id,kind,content,source_hash,model,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(lesson_id,item_id,kind) DO UPDATE SET content=excluded.content, source_hash=excluded.source_hash, model=excluded.model, created_at=excluded.created_at', l.id, it.id, b.mode, JSON.stringify(ai), itemHash(it), llm.name, iso());
      await q.run(db, 'INSERT INTO ai_usage(user_id,provider,kind,input_chars,output_chars,at) VALUES (?,?,?,?,?,?)', req.user!.id, llm.name, 'item_ai', it.lines.join('').length, JSON.stringify(ai).length, iso());
      res.json({ [b.mode === 'answer' ? 'answer' : 'explanation']: { ...ai, label: 'AI-generated', model: llm.name, stale: false } });
    } catch (e) { if (e instanceof ItemAiError) throw new HttpError(e.status, e.message); throw e; }
  }));
  return r;
}
