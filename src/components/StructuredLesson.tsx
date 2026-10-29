import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Async, Badge, Button, Card, Empty, useLoad } from './ui';
import { Bi } from './lang';
import { get, post, msg } from '../api';
import { useToast } from './toast';
import { TamilVoice } from './TamilVoice';
import { MindMapView } from './MindMap';

type Item = { id: string; ord: number; kind: string; section: string; page: number; number?: string; numberRead?: string; group?: string; title?: string; by?: string; lines: string[]; meaning?: string[]; device?: string; parent?: string; word?: { term: string; meaning: string }; question?: { type: string; category?: string; options?: string[] }; flags: string[]; uncertain?: number[] };
type Seg = { id: string; role: string; heading: string; page: number; itemIds: string[] };
const ROLE: Record<string, [string, string]> = { objectives: ['Learning objectives', 'கற்றல் நோக்கங்கள்'], intro: ['Before you begin', 'நுழையும்முன்'], author: ['About the author or book', 'நூல் வெளி'], poem: ['Poem', 'கவிதைப்பேழை'], prose: ['Prose', 'உரைநடை'], grammar: ['Grammar', 'இலக்கணம்'], glossary: ['Word meanings', 'சொல்லும் பொருளும்'], meaning: ['Meaning of the poem', 'பாடலின் பொருள்'], devices: ['Poetic devices', 'நயம்'], activities: ['Exercises', 'கற்பவை கற்றபின்'], qgroup: ['Questions', 'வினாக்கள்'], language: ['Language activities', 'மொழிப் பயிற்சி'], body: ['Lesson', 'பாடம்'] };
const FLAG: Record<string, string> = { ocr_uncertain: 'Some letters may be misread — check the printed page', number_misread: 'The number was misread; shown in book order', meaning_missing: 'The textbook meaning was not found', shape_irregular: 'This does not look like a complete couplet — check the printed page', number_out_of_order: 'Numbering is out of order — check the printed page', options_incomplete: 'Fewer than 4 options were read', pair_split_unsure: 'The word and meaning may be paired wrongly', poet_not_found: 'The poet’s name was not found', stanza_breaks_unclear: 'Stanza breaks are unclear' };
const label = (it: Item) => it.kind === 'couplet' ? `குறள் ${it.number}` : it.kind === 'stanza' ? `பாடல் ${it.number}` : it.kind === 'question' ? `வினா ${it.number ?? ''}` : (it.title ?? '');
const speakText = (its: Item[]) => its.map(i => [i.title, ...i.lines, ...(i.meaning ?? [])].filter(Boolean).join('. ')).join('. ');
export const Flags = ({ it }: { it: Item }) => it.flags.length ? <div className="row wrap">{it.flags.map(f => <Badge key={f} tone="warning">{FLAG[f] ?? f}</Badge>)}</div> : null;

function Source({ it }: { it: Item }) {
  const bad = new Set(it.uncertain ?? []);
  return <div className="srcbox" lang="ta"><div className="srctag"><Bi en="From the textbook" ta="பாடநூலில் உள்ளபடி" /> · p.{it.page}</div>
    {it.kind === 'word' ? <p className="ta"><b>{it.word?.term}</b> — {it.word?.meaning}</p> : <div className="ta verse">{it.lines.map((l, i) => <div key={i} className={bad.has(i) ? 'uncertain' : ''}>{l}</div>)}</div>}
    {!!it.meaning?.length && <p className="ta"><b>பொருள்: </b>{it.meaning.join(' ')}</p>}{it.device && <p className="ta"><b>அணி: </b>{it.device}</p>}
    {it.question?.options?.length ? <ul className="ta opts">{it.question.options.map(o => <li key={o}>{o}</li>)}</ul> : null}</div>;
}

export function StructuredLesson({ lessonId }: { lessonId: string }) {
  const [sp, setSp] = useSearchParams(); const view = sp.get('view') ?? 'overview'; const cur = sp.get('item');
  const s = useLoad(() => get(`/lessons/${lessonId}/structure`), [lessonId]);
  const go = (v: string, item?: string | null) => { const n = new URLSearchParams(sp); n.set('view', v); if (item) n.set('item', item); else n.delete('item'); setSp(n, { replace: true }); if (!item) window.scrollTo({ top: 0 }); };
  return <Async s={s}>{d => {
    const st = d.structure as { template: string; segments: Seg[]; items: Item[]; flags: string[] }; const by = new Map(st.items.map(i => [i.id, i]));
    const modes: [string, string, string][] = [['overview', 'Overview', 'மேலோட்டம்'], ['detail', 'Study one item', 'ஒவ்வொன்றாகப் படிக்க'], ['practice', 'Practice', 'பயிற்சி'], ['revision', 'Revision', 'திருப்புதல்']];
    return <div className="col">
      <div className="tabs no-print" role="tablist" aria-label="Chapter view">{modes.map(([k, en, ta]) => <button key={k} role="tab" aria-selected={view === k} className={`tab ${view === k ? 'on' : ''}`} onClick={() => go(k, k === 'detail' ? (cur ?? st.items.find(i => i.kind !== 'heading')?.id) : null)}><Bi en={en} ta={ta} /></button>)}</div>
      <p className="muted small">{d.source}</p>
      {st.flags.map(f => <div key={f} className="notice warn"><b>{f === 'no_structure_found' ? 'No structure could be read from these pages.' : f === 'truncated' ? 'This chapter is long; only the first part is shown here.' : f.startsWith('couplets_found_') ? `${f.slice(15)} couplets were read; a Thirukkural chapter has 10. Check the printed page for the others.` : f}</b></div>)}
      {view === 'overview' && <Overview st={st} by={by} go={go} />}
      {view === 'detail' && <Detail lessonId={lessonId} st={st} id={cur && by.has(cur) ? cur : st.items.find(i => i.kind !== 'heading')?.id ?? ''} go={go} />}
      {view === 'practice' && <PracticeView lessonId={lessonId} st={st} go={go} />}
      {view === 'revision' && <Revision lessonId={lessonId} st={st} go={go} />}
    </div>; }}</Async>;
}

function Overview({ st, by, go }: { st: any; by: Map<string, Item>; go: (v: string, i?: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set()); const toggleAll = (on: boolean) => setOpen(on ? new Set(st.segments.map((s: Seg) => s.id)) : new Set());
  return <div className="col"><div className="row wrap no-print"><Button tone="secondary" onClick={() => toggleAll(true)}>Expand all</Button><Button tone="secondary" onClick={() => toggleAll(false)}>Collapse all</Button></div>
    {st.segments.map((sg: Seg) => {
      const its = sg.itemIds.map(x => by.get(x)!).filter(Boolean); const [en, ta] = ROLE[sg.role] ?? ROLE.body; const isOpen = open.has(sg.id) || its.length <= 12;
      const couplets = its.filter(i => i.kind === 'couplet');
      return <div key={sg.id} id={`seg-${sg.id}`}><Card className="col"><div className="row wrap"><h2 className="grow"><Bi en={en} ta={ta} /> <span className="muted small">· p.{sg.page}</span></h2>{!!its.length && <TamilVoice text={speakText(its)} label="Listen to this part" />}
        {its.length > 12 && <Button tone="ghost" aria-expanded={isOpen} onClick={() => setOpen(o => { const n = new Set(o); n.has(sg.id) ? n.delete(sg.id) : n.add(sg.id); return n; })}>{isOpen ? 'Collapse' : `Show all ${its.length}`}</Button>}</div>
        {isOpen ? (couplets.length ? <div className="kgrid">{couplets.map(k => <div key={k.id} className="kcell"><div className="row"><b className="knum">{label(k)}</b><div className="grow" /><Button tone="ghost" onClick={() => go('detail', k.id)}>Study →</Button></div><Source it={k} /><Flags it={k} /></div>)}</div>
          : <div className="col">{its.map(it => <div key={it.id} className="col item" id={`item-${it.id}`}>{it.kind === 'heading' ? <h3 className="ta" lang="ta">{it.lines[0]}</h3> : <>{it.kind === 'stanza' || it.kind === 'question' ? <b className="knum">{label(it)}</b> : null}{it.kind === 'poem' ? <h3 className="ta" lang="ta">{it.title}{it.by ? ` — ${it.by}` : ''}</h3> : <Source it={it} />}<Flags it={it} />{['couplet', 'stanza', 'paragraph', 'question', 'poem'].includes(it.kind) && <div className="row no-print"><Button tone="ghost" onClick={() => go('detail', it.id)}>{it.kind === 'question' ? 'Answer help →' : 'Explain →'}</Button></div>}</>}</div>)}</div>) : <p className="muted"><Bi en={`${its.length} items. Use “Show all” to open them.`} ta={`${its.length} உருப்படிகள். திறக்க “அனைத்தையும் காட்டு” என்பதை அழுத்துக.`} /></p>}
      </Card></div>; })}</div>;
}

function Detail({ lessonId, st, id, go }: { lessonId: string; st: any; id: string; go: (v: string, i?: string) => void }) {
  const s = useLoad(() => get(`/lessons/${lessonId}/items/${id}`), [lessonId, id]); const toast = useToast(); const [busy, setBusy] = useState(false); const [fresh, setFresh] = useState<any>(null); const [showMap, setShowMap] = useState(true); const [mapKey, setMapKey] = useState(0);
  useEffect(() => { setFresh(null); setMapKey(k => k + 1); }, [id]);
  const ask = async (mode: 'explain' | 'answer') => { setBusy(true); try { setFresh(await post(`/lessons/${lessonId}/items/${id}/ai`, { mode })); setMapKey(k => k + 1); } catch (e) { toast(msg(e), 'err'); } finally { setBusy(false); } };
  if (!id) return <Empty title="Nothing to study" text="No items were found in this chapter." />;
  return <Async s={s}>{d => {
    const it = d.item as Item; const ex = fresh?.explanation ?? d.explanation; const an = fresh?.answer ?? d.answer; const isQ = it.kind === 'question';
    const aiText = ex ? [ex.simple_ta, ex.summary, ex.central_idea, ...(ex.key_points ?? [])].filter(Boolean).join('. ') : an?.answer ?? '';
    return <div className="col">
      <div className="row wrap no-print"><Button tone="secondary" disabled={!d.prev} onClick={() => go('detail', d.prev)}>← Previous</Button><b className="grow" style={{ textAlign: 'center' }}>{label(it) || 'Item'}</b><Button tone="secondary" disabled={!d.next} onClick={() => go('detail', d.next)}>Next →</Button></div>
      <Card className="col"><Source it={it} /><Flags it={it} /><TamilVoice text={speakText([it])} label="Listen to this item" /></Card>
      <Card className="col aibox"><div className="row wrap"><h2 className="grow"><Bi en="Explanation" ta="விளக்கம்" /></h2><Badge tone="info">AI-generated</Badge></div>
        {isQ ? <>
          <p className="muted small"><Bi en="This textbook does not print an answer for this question." ta="இந்த வினாவுக்கான விடையை நூல் தரவில்லை." /></p>
          {an ? <><p lang="ta" className="ta">{an.answer}</p>{an.why && <p lang="ta" className="ta muted">{an.why}</p>}<Badge tone="info">AI-generated answer — not from the textbook. Check with your teacher.</Badge></> : <Button disabled={busy || !d.aiEnabled} onClick={() => ask('answer')}>{busy ? 'Writing…' : 'Suggest an answer (AI)'}</Button>}
        </> : ex ? <Explanation ex={ex} /> : <Button disabled={busy || !d.aiEnabled} onClick={() => ask('explain')}>{busy ? 'Writing…' : 'Explain this with AI'}</Button>}
        {!d.aiEnabled && !ex && !an && <p className="muted small">The AI explanation service is not switched on for this school yet. The textbook text above is always available.</p>}
        {ex?.stale && <Badge tone="warning">The textbook text was re-read after this was written. Ask again to refresh.</Badge>}
        {!!aiText && <TamilVoice text={aiText} label="Listen to the explanation" />}</Card>
      <Card className="col"><div className="row wrap"><h2 className="grow"><Bi en="Mind map" ta="மனவரைபடம்" /></h2><Button tone="ghost" aria-expanded={showMap} onClick={() => setShowMap(v => !v)}>{showMap ? 'Collapse' : 'Expand'}</Button></div>
        {showMap && <MindMapView key={`${id}-${mapKey}`} lessonId={lessonId} mapUrl={`/lessons/${lessonId}/items/${id}/mindmap`} onOpenLesson={() => {}} />}</Card>
      {!!d.practice.length && <Card className="col"><h2><Bi en="Quick practice" ta="விரைவுப் பயிற்சி" /></h2><p className="muted small">Made from this item’s textbook text by the app — not textbook questions.</p>{d.practice.map((p: any) => <Mcq key={p.id} p={p} />)}</Card>}
    </div>; }}</Async>;
}
function Explanation({ ex }: { ex: any }) {
  return <div className="col" lang="ta">{ex.simple_ta && <p className="ta">{ex.simple_ta}</p>}{ex.summary && <p className="ta">{ex.summary}</p>}
    {!!ex.word_meanings?.length && <table className="tbl"><thead><tr><th>சொல்</th><th>பொருள்</th></tr></thead><tbody>{ex.word_meanings.map((w: any) => <tr key={w.word}><td className="ta"><b>{w.word}</b></td><td className="ta">{w.meaning}</td></tr>)}</tbody></table>}
    {!!ex.line_notes?.length && <ol>{ex.line_notes.map((l: any) => <li key={l.line} className="ta"><b>{l.line}</b><br />{l.note}</li>)}</ol>}
    {ex.central_idea && <p className="ta"><b>மையக் கருத்து: </b>{ex.central_idea}</p>}{ex.moral && <p className="ta"><b>நீதி: </b>{ex.moral}</p>}{ex.example && <p className="ta"><b>எடுத்துக்காட்டு: </b>{ex.example}</p>}
    {!!ex.key_points?.length && <ul>{ex.key_points.map((k: string) => <li key={k} className="ta">{k}</li>)}</ul>}{!!ex.devices?.length && <p className="ta"><b>அணி / நயம்: </b>{ex.devices.join('; ')}</p>}
    {!!ex.keywords?.length && <div className="chips">{ex.keywords.map((k: string) => <Badge key={k} tone="teal">{k}</Badge>)}</div>}{ex.memory_tip && <p className="ta"><b>நினைவில் வைக்க: </b>{ex.memory_tip}</p>}{ex.english && <p lang="en"><b>English: </b>{ex.english}</p>}</div>;
}
function Mcq({ p }: { p: any }) {
  const [pick, setPick] = useState<number | null>(null);
  return <div className="col item"><p lang="ta" className="ta">{p.stem}</p><div className="chips">{p.options.map((o: string, i: number) => <button key={o} className={`btn ${pick === null ? 'secondary' : i === p.correct ? '' : pick === i ? 'danger' : 'secondary'}`} disabled={pick !== null} onClick={() => setPick(i)} lang="ta">{o}</button>)}</div>{pick !== null && <p className="muted small">{pick === p.correct ? 'Correct.' : `The word is “${p.options[p.correct]}”.`}</p>}</div>;
}

function PracticeView({ lessonId, st, go }: { lessonId: string; st: any; go: (v: string, i?: string) => void }) {
  const qs: Item[] = st.items.filter((i: Item) => i.kind === 'question'); const groups = useMemo(() => { const m = new Map<string, Item[]>(); for (const q of qs) { const k = q.question?.category ?? 'வினாக்கள்'; m.set(k, [...(m.get(k) ?? []), q]); } return [...m]; }, [qs]);
  if (!qs.length) return <Empty title="No textbook questions found" text="No questions were read from these pages. Use the Practice questions tab for questions made from the chapter." />;
  return <div className="col"><p className="muted small"><Bi en="Textbook questions with their original numbers. Answers are hidden until you ask. This book does not print an answer key, so any answer shown is AI-generated." ta="பாடநூல் வினாக்கள் அதே எண்களுடன். விடைகள் நீங்கள் கேட்டால் மட்டுமே. இந்நூலில் விடைகள் இல்லை; காட்டப்படும் விடை AI உருவாக்கியது." /></p>
    {groups.map(([cat, items]) => <Card key={cat} className="col"><h2 lang="ta" className="ta">{cat}</h2>{items.map(q => <div key={q.id} className="col item"><div className="row"><b className="knum">{q.number}.</b><div className="grow"><Source it={q} /><Flags it={q} /></div></div><div className="row no-print"><Button tone="ghost" onClick={() => go('detail', q.id)}>Show / suggest answer →</Button></div></div>)}</Card>)}</div>;
}

function Revision({ lessonId, st, go }: { lessonId: string; st: any; go: (v: string, i?: string) => void }) {
  const ks: Item[] = st.items.filter((i: Item) => ['couplet', 'stanza'].includes(i.kind)); const words: Item[] = st.items.filter((i: Item) => i.kind === 'word');
  return <div className="col"><Card className="col"><h2><Bi en="Chapter mind map" ta="பாடத்தின் மனவரைபடம்" /></h2><MindMapView lessonId={lessonId} mapUrl={`/lessons/${lessonId}/chapter-map`} onOpenLesson={() => {}} /></Card>
    {!!ks.length && <Card className="col"><div className="row wrap"><h2 className="grow">{ks[0].kind === 'couplet' ? <Bi en={`All ${ks.length} couplets`} ta={`அனைத்துக் குறள்களும் (${ks.length})`} /> : <Bi en="All stanzas" ta="அனைத்துப் பாடல்களும்" />}</h2><TamilVoice text={speakText(ks)} label="Listen to all" /></div>
      <div className="kgrid">{ks.map(k => <div key={k.id} className="kcell"><b className="knum">{label(k)}</b><Source it={k} /><Button tone="ghost" onClick={() => go('detail', k.id)}>Study →</Button></div>)}</div></Card>}
    {!!words.length && <Card className="col"><h2><Bi en="Important words" ta="முக்கிய சொற்கள்" /></h2><table className="tbl"><tbody>{words.map(w => <tr key={w.id}><td className="ta" lang="ta"><b>{w.word?.term}</b></td><td className="ta" lang="ta">{w.word?.meaning}</td></tr>)}</tbody></table></Card>}</div>;
}
