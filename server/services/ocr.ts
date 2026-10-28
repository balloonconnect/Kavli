import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * OCR for scanned or badly-encoded textbook PDFs.
 *
 * Default engine: the Tesseract command line (`tesseract`, with the `tam` and `eng` language data) and `pdftoppm` (poppler) to turn a page into an image.
 * Both are installed in the Docker image (see docs/DEPLOYMENT.md). Without them `ocrAvailable()` is false and uploads fall back to "needs OCR".
 * The engine is an interface so a cloud OCR (Azure Document Intelligence, Google Vision) can be dropped in without touching the importer.
 */
export interface OcrEngine { readonly name: string; recognize(png: Buffer, lang: string): Promise<string> }

const run = (cmd: string, args: string[], input?: Buffer, env?: NodeJS.ProcessEnv, timeoutMs = 120000) => new Promise<{ code: number; out: Buffer; err: string }>((resolve, reject) => {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] }); const out: Buffer[] = []; let err = '';
  const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} timed out`)); }, timeoutMs);
  p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => { err += d; }); p.on('error', e => { clearTimeout(t); reject(e); });
  p.on('close', code => { clearTimeout(t); resolve({ code: code ?? 1, out: Buffer.concat(out), err }); });
  p.stdin.on('error', () => { /* process exited early */ }); p.stdin.end(input);
});

const tessEnv = (tessdata?: string) => { const d = tessdata ?? process.env.OCR_TESSDATA ?? process.env.TESSDATA_PREFIX; return { OMP_THREAD_LIMIT: '1', ...(d ? { TESSDATA_PREFIX: d } : {}) } as NodeJS.ProcessEnv; };
export function tesseractEngine(opts: { tessdata?: string } = {}): OcrEngine {
  const env = tessEnv(opts.tessdata);
  return {
    name: 'tesseract',
    async recognize(png, lang) {
      const r = await run('tesseract', ['stdin', 'stdout', '-l', lang, '--psm', '6'], png, env);
      if (r.code !== 0) throw new Error(`tesseract failed: ${r.err.slice(0, 200)}`);
      return r.out.toString('utf8');
    },
  };
}

let override: OcrEngine | null | undefined;
/** Tests (and alternative providers) can replace the engine; `null` means "no OCR available". */
export const setOcrEngine = (e: OcrEngine | null | undefined) => { override = e; };
let probed: Promise<OcrEngine | null> | undefined;
export async function getOcrEngine(): Promise<OcrEngine | null> {
  if (override !== undefined) return override;
  if (process.env.OCR_ENGINE === 'off') return null;
  probed ??= (async () => {
    try {
      const langs = await run('tesseract', ['--list-langs'], undefined, tessEnv());
      if (langs.code !== 0 || !/\beng\b/.test(langs.out.toString())) return null;
      await run('pdftoppm', ['-v']); // throws if poppler is missing
      return tesseractEngine();
    } catch { return null; }
  })();
  return probed;
}
export const ocrAvailable = async () => !!(await getOcrEngine());
export const resetOcrProbe = () => { probed = undefined; };

/** Renders one PDF page to a PNG (poppler). */
export async function renderPage(pdf: Buffer, page: number, dpi = 200): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'kavli-ocr-'));
  try {
    await writeFile(join(dir, 'in.pdf'), pdf);
    const r = await run('pdftoppm', ['-r', String(dpi), '-f', String(page), '-l', String(page), '-png', '-singlefile', join(dir, 'in.pdf'), join(dir, 'p')]);
    if (r.code !== 0) throw new Error(`could not render page ${page}: ${r.err.slice(0, 200)}`);
    return await readFile(join(dir, 'p.png'));
  } finally { await rm(dir, { recursive: true, force: true }); }
}

const EN_FUNCTION = new Set('the of and a to in is are was were it that for on with as by be this from at or an not you he she they we his her their which has have had can will'.split(' '));
/** Ill-formed Tamil sequences per 100 Tamil characters. */
export function illFormedTamil(t: string) {
  const tam = (t.match(/[\u0B80-\u0BFF]/g) ?? []).length || 1;
  const n = (t.match(/\uFFFD|(?:^|[\s\p{P}\d])[\u0BBE-\u0BCD]|[\u0BBE-\u0BCD]{3,}|[\u0BC6-\u0BC8][\u0BBE-\u0BCD]|்்/gu) ?? []).length;
  return (n / tam) * 100;
}
const TAMIL = /[஀-௿]/g; const LETTER = /\p{L}/gu;
/**
 * Is this page's embedded text layer trustworthy? Old Tamil PDFs often carry legacy-font text that looks like Tamil but is corrupted
 * (doubled virama "்்", replacement characters, letters spaced apart) — retrieval and the tutor must not be fed that.
 */
export function textQuality(text: string, medium: 'English' | 'Tamil'): { ok: boolean; reason?: string } {
  const t = text.replace(/\s+/g, ' ').trim(); if (t.length < 20) return { ok: false, reason: 'no text' };
  const letters = (t.match(LETTER) ?? []).length; if (letters < 15) return { ok: false, reason: 'no text' };
  const bad = (t.match(/�|்்|ாா|ெெ|ொொ|ோோ/g) ?? []).length; if (bad / Math.max(1, t.length / 100) > 1.5) return { ok: false, reason: 'corrupted encoding' };
  // Ill-formed Tamil: marks with no consonant to attach to, replacement characters, stray viramas. Measured on a real legacy-font book:
  // its text layer scored 4.6–10 per 100 Tamil characters on every page, clean OCR output scored 0–1.2.
  const taN = (t.match(TAMIL) ?? []).length;
  if (taN >= 20 && illFormedTamil(t) > 2) return { ok: false, reason: 'corrupted encoding' };
  const singles = t.split(' ').filter(w => w.length <= 2).length / Math.max(1, t.split(' ').length); if (singles > 0.6) return { ok: false, reason: 'spaced-out letters' };
  const ta = (t.match(TAMIL) ?? []).length;
  if (medium === 'Tamil' && ta / letters < 0.25 && letters > 60) {
    // Latin text on a Tamil-medium page is either genuine English or legacy-font Tamil shown as Latin gibberish; real English is full of function words.
    const words = t.toLowerCase().match(/[a-z]+/g) ?? []; const fn = words.filter(w => EN_FUNCTION.has(w)).length;
    if (fn / Math.max(1, words.length) < 0.12) return { ok: false, reason: 'not Tamil text' };
  }
  return { ok: true };
}

/** Light clean-up of OCR output: unify whitespace, drop stray control characters. */
export const cleanOcr = (s: string) => s.replace(/[|¦[\]{}]+/g, ' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200D\uFEFF]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

export type PageText = { page: number; text: string };
/**
 * OCRs the given pages one after another (pdftoppm + engine), reporting progress. Failed pages are skipped and reported, not fatal.
 */
export async function ocrPages(pdf: Buffer, pages: number[], o: { engine: OcrEngine; lang: string; dpi?: number; onPage?: (done: number, total: number, page: number) => void | Promise<void>; shouldStop?: () => boolean }) {
  const out: PageText[] = []; const failed: number[] = []; let done = 0;
  for (const n of pages) {
    if (o.shouldStop?.()) break;
    try { const png = await renderPage(pdf, n, o.dpi); const text = cleanOcr(await o.engine.recognize(png, o.lang)); out.push({ page: n, text }); } catch { failed.push(n); }
    done++; await o.onPage?.(done, pages.length, n);
  }
  return { pages: out, failed };
}
