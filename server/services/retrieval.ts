// Small keyword retriever used for source-grounded answers (lessons and user material).
const STOP = new Set('the a an is are was were of to in on and or for with what how why when which that this it as by be from at do does can you i me my about tell explain show give please also more some any like'.split(' '));
export const tokens = (s: string) => (s.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}஀-௿]+/gu) ?? []).filter(t => t.length > 1 && !STOP.has(t));
export type Passage = { text: string; page?: number; source: string };
export function splitPassages(text: string, page?: number, source = 'document'): Passage[] {
  return text.split(/\n{1,}|(?<=[.!?।])\s+(?=[A-Z஀-௿])/).map(s => s.trim()).filter(s => s.length > 30).reduce<string[]>((acc, s) => {
    const last = acc[acc.length - 1]; if (last && last.length < 160) acc[acc.length - 1] = `${last} ${s}`; else acc.push(s); return acc;
  }, []).map(t => ({ text: t.slice(0, 700), page, source }));
}
const TAMIL_SCRIPT = /[\u0B80-\u0BFF]/;
/** Common Tamil case/plural endings, longest first. Tamil is agglutinative ("பாறை", "பாறைகளில்", "பாறைகளை"), so exact-word matching misses most inflected forms. */
const SUFFIX = ['ங்களுக்கு', 'களுக்கு', 'ங்களில்', 'களில்', 'ங்களை', 'களை', 'ங்களின்', 'களின்', 'ங்களால்', 'களால்', 'ங்கள்', 'கள்', 'இலிருந்து', 'ிலிருந்து', 'உடைய', 'ுடைய', 'இடம்', 'ிடம்', 'ோடு', 'ுடன்', 'ின்', 'ில்', 'ால்', 'ைக்', 'க்கு', 'ும்'];
/** A rough stem for a Tamil word: strips up to two common endings (case ending, then plural), keeping at least 3 code points. */
export function stem(w: string) {
  if (!TAMIL_SCRIPT.test(w)) return w; let cur = w;
  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    for (const suf of SUFFIX) {
      const n = [...suf].length; if ([...cur].length - n < 3 || !cur.endsWith(suf)) continue;
      cur = [...cur].slice(0, [...cur].length - n).join(''); changed = true;
      if (/[\u0B95-\u0BB9]$/.test(cur)) cur += '்'; // a vowel-sign ending leaves a bare consonant: restore its pulli (கிணறுகள → கிணறுகள்)
      break;
    }
    if (!changed) break;
  }
  return cur.replace(/்$/, '');
}
export function topPassages(question: string, passages: Passage[], k = 3) {
  const qt = new Set(tokens(question)); if (!qt.size) return [];
  const qs = new Set([...qt].filter(t => TAMIL_SCRIPT.test(t)).map(stem).filter(t => [...t].length >= 3));
  const scored = passages.map(p => {
    const pt = tokens(p.text); let hit = 0; const uniq = new Set<string>();
    for (const t of pt) {
      if (qt.has(t)) { hit++; uniq.add(t); continue; }
      if (qs.size && TAMIL_SCRIPT.test(t)) { const st = stem(t); if (qs.has(st)) { hit += 0.7; uniq.add(st); } }
    }
    return { p, uniq, score: uniq.size * 2 + hit / Math.sqrt(pt.length + 1) };
  });
  // Evidence gate: one shared word only counts when it is a distinctive word (rare across the passages), not "about" or "child".
  const df = new Map<string, number>(); for (const x of scored) for (const t of x.uniq) df.set(t, (df.get(t) ?? 0) + 1);
  const rare = Math.max(2, Math.floor(passages.length * 0.08));
  return scored.filter(x => x.score > 1 && (x.uniq.size >= 2 || [...x.uniq].some(t => [...t].length >= (TAMIL_SCRIPT.test(t) ? 3 : 4) && (df.get(t) ?? 0) <= rare)))
    .sort((a, b) => b.score - a.score).slice(0, k).map(x => x.p);
}
