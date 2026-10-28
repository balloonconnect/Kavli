// Small keyword retriever used for source-grounded answers (lessons and user material).
const STOP = new Set('the a an is are was were of to in on and or for with what how why when which that this it as by be from at do does can you i me my'.split(' '));
export const tokens = (s: string) => (s.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}஀-௿]+/gu) ?? []).filter(t => t.length > 1 && !STOP.has(t));
export type Passage = { text: string; page?: number; source: string };
export function splitPassages(text: string, page?: number, source = 'document'): Passage[] {
  return text.split(/\n{1,}|(?<=[.!?।])\s+(?=[A-Z஀-௿])/).map(s => s.trim()).filter(s => s.length > 30).reduce<string[]>((acc, s) => {
    const last = acc[acc.length - 1]; if (last && last.length < 160) acc[acc.length - 1] = `${last} ${s}`; else acc.push(s); return acc;
  }, []).map(t => ({ text: t.slice(0, 700), page, source }));
}
export function topPassages(question: string, passages: Passage[], k = 3) {
  const qt = new Set(tokens(question)); if (!qt.size) return [];
  return passages.map(p => { const pt = tokens(p.text); let hit = 0; for (const t of pt) if (qt.has(t)) hit++; const uniq = new Set(pt.filter(t => qt.has(t))).size; return { p, score: uniq * 2 + hit / Math.sqrt(pt.length + 1) }; })
    .filter(x => x.score > 1).sort((a, b) => b.score - a.score).slice(0, k).map(x => x.p);
}
