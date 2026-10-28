import { DB, q } from '../db';
import { iso } from '../clock';
import { JobQueue } from './jobs';
import { getOcrEngine, ocrPages, textQuality } from './ocr';
import { storage } from './storage';

export type PageText = { page: number; text: string };
export async function extractAll(buf: Buffer): Promise<PageText[]> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try { const r = await parser.getText(); return r.pages.map((p: any) => ({ page: p.num as number, text: String(p.text).replace(/\s+/g, ' ').trim() })); }
  finally { await parser.destroy().catch(() => {}); }
}

export const ocrQueue = new JobQueue(Number(process.env.OCR_CONCURRENCY ?? 1));
const langFor = (medium: string) => (medium === 'Tamil' ? process.env.OCR_LANG_TAMIL ?? 'tam+eng' : process.env.OCR_LANG_ENGLISH ?? 'eng');
const MIN_PAGE_CHARS = 20;

export async function putPages(db: DB, bookId: string, pages: PageText[]) {
  for (const p of pages) if (p.text.length >= MIN_PAGE_CHARS) await q.run(db, 'INSERT INTO textbook_pages(textbook_id,page,text) VALUES (?,?,?) ON CONFLICT(textbook_id,page) DO UPDATE SET text=excluded.text', bookId, p.page, p.text.slice(0, 20000));
}

/** Splits the PDF's own text layer into pages we can trust and pages that need OCR. */
export function triage(pages: PageText[], medium: 'English' | 'Tamil') {
  const good = pages.filter(p => textQuality(p.text, medium).ok); const ok = new Set(good.map(p => p.page));
  return { good, bad: pages.filter(p => !ok.has(p.page)).map(p => p.page) };
}

/** Background job: OCR the listed pages of a stored book, saving each page as it is read, then settle the book's status. */
export async function runOcr(db: DB, bookId: string, pageNos: number[]) {
  const book = await q.get<any>(db, 'SELECT * FROM textbooks WHERE id=?', bookId); if (!book) return;
  const engine = await getOcrEngine();
  const settle = async (status: string, note: string | null) => { await q.run(db, 'UPDATE textbooks SET status=?, note=? WHERE id=?', status, note, bookId); };
  if (!engine) return settle('needs_ocr', 'OCR is not available on this server, so scanned pages cannot be read yet.');
  let pdf: Buffer; try { pdf = await storage().get(book.file_path); } catch { return settle('failed', 'The stored PDF could not be found, so OCR could not run.'); }
  let last = 0;
  const r = await ocrPages(pdf, pageNos, {
    engine, lang: langFor(book.medium),
    onPage: async (done, total) => { if (done - last >= 3 || done === total) { last = done; await q.run(db, 'UPDATE textbooks SET note=? WHERE id=?', `Reading the pages (OCR): ${done} of ${total} done.`, bookId); } },
    shouldStop: () => false,
  });
  await putPages(db, bookId, r.pages);
  const have = (await q.get<any>(db, 'SELECT COUNT(*) c FROM textbook_pages WHERE textbook_id=?', bookId))?.c ?? 0;
  const skipped = r.failed.length;
  if (!have) return settle('needs_ocr', 'No readable text could be found in this PDF.');
  await settle('ready', skipped ? `${skipped} page${skipped > 1 ? 's' : ''} could not be read (OCR). The rest is ready.` : null);
}

/** After a restart, books left half-read continue where they stopped (pages already saved are skipped). */
export async function resumeOcr(db: DB) {
  const books = await q.all<any>(db, "SELECT id, page_count FROM textbooks WHERE status='processing'");
  for (const b of books) {
    const have = new Set((await q.all<any>(db, 'SELECT page FROM textbook_pages WHERE textbook_id=?', b.id)).map(r => r.page as number));
    const todo = Array.from({ length: b.page_count }, (_, i) => i + 1).filter(n => !have.has(n));
    ocrQueue.add(() => runOcr(db, b.id, todo));
  }
  return books.length;
}
