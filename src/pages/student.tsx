import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Async, Badge, Button, Card, Empty, Icon, IconBox, PageTitle, Progress, Stat, fmtDT, useLoad, Loading, ErrorState } from '../components/ui';
import { Bi, useLang } from '../components/lang';
import { useAuth } from '../auth';
import { del, get, post, msg } from '../api';
import { useToast } from '../components/toast';
import { canSpeak, speak, stopSpeaking } from '../components/voice';

const SUBJ_ICON: Record<string, any> = { maths: 'target', science: 'layers', english: 'book', social: 'users', tamil: 'edit' };
export const subjColor = (i: number) => [['var(--primary-soft)', 'var(--primary)'], ['var(--accent-soft)', 'var(--accent)'], ['var(--warning-soft)', 'var(--warning)'], ['var(--success-soft)', 'var(--success)'], ['var(--gold-soft)', 'var(--gold)']][i % 5];

export function Dashboard() {
  const { user } = useAuth();
  if (user && user.role !== 'student') return <Holding role={user.role} name={user.display_name} />;
  return <StudentDashboard />;
}
function StudentDashboard() {
  const s = useLoad(() => get('/dashboard'));
  return <Async s={s}>{d => {
    const h = new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }); const hr = Number(h);
    const hello = hr < 12 ? ['Good morning', 'காலை வணக்கம்'] : hr < 17 ? ['Good afternoon', 'மதிய வணக்கம்'] : ['Good evening', 'மாலை வணக்கம்'];
    return (
    <div className="col" style={{ gap: 20 }}>
      <PageTitle title={<><Bi en={`${hello[0]}, ${d.profile.name}`} ta={`${hello[1]}, ${d.profile.name}`} block /></>} sub={`Class ${d.profile.class_level} · ${d.profile.medium} medium · ${d.profile.academic_year} · Ref ${d.profile.ref_no}`} />
      <div className="grid g4 stat">
        <Stat icon="test" bg="var(--primary-soft)" fg="var(--primary)" value={String(d.toComplete)} label="Tests to complete" />
        <Stat icon="chart" bg="var(--success-soft)" fg="var(--success)" value={d.passRate === null ? '—' : `${d.passRate}%`} label="Pass rate" note={d.passRate === null ? 'No finished tests yet' : `${d.passRateBasis} finished test(s)`} />
        <Stat icon="award" bg="var(--gold-soft)" fg="var(--gold)" value={String(d.certificates)} label="Certificates" />
        <Stat icon="bookmark" bg="var(--accent-soft)" fg="var(--accent)" value={String(d.bookmarks.length)} label="Saved items" />
      </div>
      <div className="grid g2 split">
        <Card className="col"><h2>Continue learning</h2>
          {d.continueLesson ? <><div className="row"><IconBox name={SUBJ_ICON[d.continueLesson.subject_id] ?? 'book'} bg="var(--primary-soft)" fg="var(--primary)" /><div className="grow"><b><Bi en={d.continueLesson.title_en} ta={d.continueLesson.title_ta} block /></b><span className="muted small">{d.continueLesson.minutes} min</span></div></div>
            <Button to={`/app/learn/${d.continueLesson.id}`}>Open lesson</Button></> : <Empty title="All caught up" text="You have finished every lesson in your subjects." action={<Button to="/app/learn">Browse lessons</Button>} />}
          {d.recommendedPractice && <div className="notice info"><Icon name="target" /><div><b>Recommended practice:</b> {d.recommendedPractice.topic}<div className="muted small">{d.recommendedPractice.reason}</div></div></div>}
          {d.recommendedPractice && <Button tone="secondary" to="/app/practice">Go to practice</Button>}
        </Card>
        <Card className="col"><h2>Today’s goals</h2>
          {d.goals.map((g: any) => <div className="row" key={g.id}><span className={`tick ${g.done ? 'on' : ''}`} aria-hidden>{g.done ? '✓' : ''}</span><span className={g.done ? 'muted' : 'semi'}><Bi en={g.label_en} ta={g.label_ta} /></span><span className="sr">{g.done ? 'Done' : 'Not done yet'}</span></div>)}
          <div className="row wrap"><Button tone="ghost" to="/app/tutor">Ask the AI tutor</Button><Button tone="ghost" to="/app/practice">Practice</Button></div>
        </Card>
      </div>
      <Card className="col"><div className="row"><h2 className="grow">Your subjects</h2><Link to="/app/learn" className="link">All lessons</Link></div>
        <div className="grid g3">{d.subjects.map((s: any, i: number) => { const [bg, fg] = subjColor(i); return (
          <Link key={s.id} to={`/app/learn?subject=${s.id}`} className="subjcard"><div className="row"><IconBox name={SUBJ_ICON[s.id] ?? 'book'} bg={bg} fg={fg} /><div className="grow"><b><Bi en={s.name_en} ta={s.name_ta} block /></b><span className="muted small">{s.completed}/{s.lessons} lessons</span></div></div><Progress pct={s.pct} color={fg} label={`${s.name_en} progress`} /></Link>); })}</div></Card>
      <div className="grid g2 split">
        <Card className="col"><div className="row"><h2 className="grow">Upcoming tests</h2><Link to="/app/tests" className="link">View all</Link></div>
          {!d.upcoming.length ? <p className="muted">No tests are open right now.</p> : d.upcoming.map((t: any) => (
            <div className="row wrap listrow" key={t.id}><div className="grow"><b>{t.title}</b><div className="muted small">{t.status === 'Upcoming' ? `Opens ${fmtDT(t.opens_at)}` : `Closes ${fmtDT(t.closes_at)}`}{t.duration_min ? ` · ${t.duration_min} min` : ''}</div></div><Badge tone={t.status === 'Upcoming' ? 'neutral' : 'info'}>{t.status}</Badge><Button tone="secondary" to={`/app/tests/${t.id}`}>View</Button></div>))}</Card>
        <Card className="col"><div className="row"><h2 className="grow">Latest results</h2><Link to="/app/progress" className="link">Progress</Link></div>
          {!d.latestResults.length ? <p className="muted">You have not finished a test yet. Your results will appear here.</p> : d.latestResults.map((r: any) => (
            <div className="row wrap listrow" key={r.attempt_id}><div className="grow"><b>{r.title}</b><div className="muted small">{fmtDT(r.submitted_at)}</div></div>
              {r.status === 'pending_review' ? <Badge tone="warning">Pending review</Badge> : <><b>{r.marks}/{r.total}</b><Badge tone={r.status === 'passed' ? 'success' : 'danger'}>{r.status === 'passed' ? 'Passed' : 'Not passed'}</Badge></>}<Button tone="secondary" to={`/app/result/${r.attempt_id}`}>Open</Button></div>))}</Card>
      </div>
      {!!d.revision.length && <Card className="col"><h2>Topics to revise</h2><p className="muted small">Based on your finished tests.</p><div className="row wrap">{d.revision.map((t: any) => <Badge key={t.topic} tone="warning">{t.topic} · {t.pct}%</Badge>)}</div><Button tone="secondary" to="/app/progress">See revision plan</Button></Card>}
    </div>); }}</Async>;
}

export function Learn() {
  const [sp, setSp] = useSearchParams(); const q = sp.get('q') ?? ''; const subject = sp.get('subject') ?? '';
  const { profile } = useAuth(); const [cls, setCls] = useState<number>(profile?.class_level ?? 8);
  const s = useLoad(() => get(`/curriculum?class=${cls}`), [cls]);
  return (
    <div className="col">
      <PageTitle title={<Bi en="Learn" ta="பாடங்கள்" />} sub="Tamil Nadu State Board (Samacheer Kalvi) · sample lessons for this prototype" right={<div className="field"><label className="sr" htmlFor="c">Class</label><select id="c" value={cls} onChange={e => setCls(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map(c => <option key={c} value={c}>Class {c}</option>)}</select></div>} />
      <div className="row wrap"><div className="field grow" style={{ maxWidth: 360 }}><label className="sr" htmlFor="lq">Search lessons</label><input id="lq" placeholder="Search lessons…" value={q} onChange={e => { const n = new URLSearchParams(sp); e.target.value ? n.set('q', e.target.value) : n.delete('q'); setSp(n, { replace: true }); }} /></div>
        <div className="row wrap" role="group" aria-label="Subject filter"><button className={`pill ${!subject ? 'on' : ''}`} onClick={() => { const n = new URLSearchParams(sp); n.delete('subject'); setSp(n); }}>All</button>
          {(s.data?.subjects ?? []).map((x: any) => <button key={x.id} className={`pill ${subject === x.id ? 'on' : ''}`} onClick={() => { const n = new URLSearchParams(sp); n.set('subject', x.id); setSp(n); }}>{x.name_en}</button>)}</div></div>
      <Async s={s}>{d => {
        const ql = q.trim().toLowerCase(); const subs = d.subjects.filter((x: any) => !subject || x.id === subject).map((x: any) => ({ ...x, lessons: x.lessons.filter((l: any) => !ql || `${l.title_en} ${l.title_ta} ${l.chapter_en}`.toLowerCase().includes(ql)) })).filter((x: any) => x.lessons.length);
        if (!subs.length) return <Empty title="No lessons found" text={ql ? 'Try a different search word.' : `There are no published lessons for Class ${cls} yet.`} />;
        return <>{d.note && <div className="notice info"><Icon name="info" />{d.note}</div>}{subs.map((x: any, i: number) => (
          <Card key={x.id} className="col"><h2><Bi en={x.name_en} ta={x.name_ta} /></h2>
            {x.lessons.map((l: any) => <Link key={l.id} to={`/app/learn/${l.id}`} className="row listrow lessonrow"><IconBox name={SUBJ_ICON[x.id] ?? 'book'} bg={subjColor(i)[0]} fg={subjColor(i)[1]} /><div className="grow"><span className="muted xs">Chapter {l.chapter_no}</span><div className="semi"><Bi en={l.title_en} ta={l.title_ta} block /></div></div><span className="muted small">{l.minutes} min</span>{l.completed ? <Badge tone="success">Done</Badge> : <Badge tone="neutral">New</Badge>}</Link>)}</Card>))}</>; }}</Async>
    </div>
  );
}

function ReadAloud({ en, ta, rate }: { en: string; ta: string; rate: number }) {
  const { lang } = useLang(); const [on, setOn] = useState(false);
  useEffect(() => () => { stopSpeaking(); }, []);
  if (!canSpeak) return null;
  return <button className="btn secondary" aria-pressed={on} onClick={() => { if (on) { stopSpeaking(); setOn(false); } else { setOn(true); speak(lang === 'ta' ? ta : en, lang === 'ta' ? 'ta' : 'en', rate, () => setOn(false)); } }}><Icon name="volume" /> {on ? 'Stop' : 'Read aloud'}</button>;
}

import { MindMapView, RevisionList } from '../components/MindMap';
const TABS: [string, string][] = [['explain', 'Explanation'], ['map', 'Mind Map'], ['examples', 'Examples'], ['practice', 'Practice questions'], ['revision', 'Quick revision']];
export function Lesson() {
  const { id } = useParams(); const nav = useNavigate(); const [sp, setSp] = useSearchParams(); const rawTab = sp.get('tab') ?? 'explain'; const tab = TABS.some(t => t[0] === rawTab) ? rawTab : 'explain';
  const goTab = (t: string, el?: string | null) => { const n = new URLSearchParams(sp); n.set('tab', t); setSp(n, { replace: true }); if (el) setTimeout(() => document.getElementById(el)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); else window.scrollTo({ top: 0 });}; const toast = useToast(); const { profile } = useAuth(); const { lang } = useLang();
  const s = useLoad(() => get(`/lessons/${id}`), [id]); const [bm, setBm] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { if (s.data) { setBm(s.data.bookmarked); setDone(s.data.progress.completed); post(`/lessons/${id}/open`).catch(() => {}); } }, [s.data, id]);
  return <Async s={s}>{d => {
    const l = d.lesson, c = l.content; const both = lang === 'both';
    const toggleBm = async () => { try { if (bm) await del(`/bookmarks?kind=lesson&ref=${l.id}`); else await post('/bookmarks', { kind: 'lesson', ref: l.id, title: l.title_en }); setBm(!bm); toast(bm ? 'Bookmark removed' : 'Lesson bookmarked'); } catch (e) { toast(msg(e), 'err'); } };
    const speakEn = [l.title_en, ...c.sections.map((x: any) => `${x.h_en}. ${x.en}`)].join('. '); const speakTa = [l.title_ta, ...c.sections.map((x: any) => `${x.h_ta}. ${x.ta}`)].join('. ');
    return (
    <div className="col lesson">
      <div className="row wrap"><Link to="/app/learn" className="link row" style={{ gap: 4 }}><Icon name="back" size={16} />All lessons</Link></div>
      <PageTitle title={<Bi en={l.title_en} ta={l.title_ta} block />} sub={<><Bi en={`${l.subject_en} · Class ${l.class_level} · Chapter ${l.chapter_no}`} ta={`${l.subject_ta} · வகுப்பு ${l.class_level} · பாடம் ${l.chapter_no}`} /> · {l.minutes} min</>} right={<div className="row wrap">{done && <Badge tone="success">Completed</Badge>}<Badge tone="warning">Sample content</Badge></div>} />
      <div className="row wrap no-print">
        <ReadAloud en={speakEn} ta={speakTa} rate={profile?.voice_prefs?.rate ?? 1} />
        <Button tone="secondary" onClick={toggleBm} aria-pressed={bm}><Icon name="bookmark" /> {bm ? 'Bookmarked' : 'Bookmark'}</Button>
        <Button to={`/app/tutor?lesson=${l.id}`}><Icon name="chat" /> Ask AI about this lesson</Button>
      </div>
      <div className="tabs no-print" role="tablist" aria-label="Lesson sections">{TABS.map(([k, t]) => <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="lesson-panel" tabIndex={tab === k ? 0 : -1} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => goTab(k)} onKeyDown={e => { const i = TABS.findIndex(x => x[0] === k); const j = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : -1; if (j >= 0) { e.preventDefault(); goTab(TABS[j][0]); setTimeout(() => document.getElementById(`tab-${TABS[j][0]}`)?.focus(), 0); } }}>{t}</button>)}</div>
      <div role="tabpanel" id="lesson-panel" aria-labelledby={`tab-${tab}`} className="col">
      {tab === 'map' && <MindMapView lessonId={l.id} subjectId={l.subject_id} onOpenLesson={a => goTab(a.tab, a.el)} />}
      {tab === 'revision' && <RevisionList lessonId={l.id} />}
      {tab === 'explain' && <>
      <Card className="col"><h2><Bi en="What you will learn" ta="இதில் நீங்கள் கற்பது" /></h2>
        <div className={both ? 'grid g2 split' : ''}>{lang !== 'ta' && <ul>{c.objectives.en.map((o: string) => <li key={o}>{o}</li>)}</ul>}{lang !== 'en' && <ul lang="ta" className="ta">{c.objectives.ta.map((o: string) => <li key={o}>{o}</li>)}</ul>}</div></Card>
      {c.sections.map((x: any, si: number) => <div key={x.h_en} id={`lesson-sec-${si}`}><Card className="col"><h2><Bi en={x.h_en} ta={x.h_ta} block /></h2>
        <div className={both ? 'grid g2 split' : ''}>{lang !== 'ta' && <p>{x.en}</p>}{lang !== 'en' && <p lang="ta" className="ta">{x.ta}</p>}</div></Card></div>)}
      {!!c.vocab?.length && <div id="lesson-vocab"><Card className="col"><h2><Bi en="Key words" ta="முக்கிய சொற்கள்" /></h2><div className="tablewrap" tabIndex={0} role="region" aria-label="Data table"><table className="tbl"><thead><tr><th>English</th><th>தமிழ்</th><th>Meaning</th><th>Say it</th><th>Example</th></tr></thead>
        <tbody>{c.vocab.map((v: any) => <tr key={v.en}><td><b>{v.en}</b></td><td lang="ta" className="ta">{v.ta}</td><td>{v.meaning}</td><td className="muted">{v.pron}</td><td>{v.example}</td></tr>)}</tbody></table></div></Card></div>}
      </>}
      {tab === 'examples' && <>
      {!c.examples?.length && !c.realLife?.en && !c.mistakes?.length && <Empty title="No examples yet" text="This sample lesson has no worked examples." />}
      {!!c.examples?.length && <Card className="col"><h2><Bi en="Worked example" ta="தீர்க்கப்பட்ட எடுத்துக்காட்டு" /></h2>{c.examples.map((e: any) => <div key={e.q_en} className="col"><b><Bi en={e.q_en} ta={e.q_ta} block /></b>
        <div className={both ? 'grid g2 split' : ''}>{lang !== 'ta' && <ol>{e.steps_en.map((x: string) => <li key={x}>{x}</li>)}</ol>}{lang !== 'en' && <ol lang="ta" className="ta">{e.steps_ta.map((x: string) => <li key={x}>{x}</li>)}</ol>}</div></div>)}</Card>}
      {c.realLife?.en && <Card className="col"><h2><Bi en="In real life" ta="நிஜ வாழ்வில்" /></h2><p><Bi en={c.realLife.en} ta={c.realLife.ta} block /></p></Card>}
      {!!c.mistakes?.length && <Card className="col warnbox"><h2><Bi en="Common mistakes" ta="பொதுவான தவறுகள்" /></h2><ul>{c.mistakes.map((m: any) => <li key={m.en}><Bi en={m.en} ta={m.ta} block /></li>)}</ul></Card>}
      </>}
      {tab === 'practice' && <Card className="col"><h2><Bi en="Check yourself" ta="உங்களைச் சோதிக்க" /></h2><p className="muted">Try a short practice set on this subject, or ask the tutor to test your understanding.</p>
        <div className="row wrap"><Button to={`/app/practice?subject=${l.subject_id}`}>Practise now</Button><Button tone="secondary" to={`/app/tutor?lesson=${l.id}&action=test_me`}>Test my understanding</Button></div></Card>}
      </div>
      <div className="row wrap lessonnav no-print">
        {d.prev ? <Button tone="secondary" to={`/app/learn/${d.prev.id}`}><Icon name="back" size={16} /> Previous</Button> : <span />}
        <div className="grow" />
        <Button tone={done ? 'secondary' : 'teal'} disabled={done} onClick={async () => { try { await post(`/lessons/${l.id}/complete`); setDone(true); toast('Lesson marked complete'); } catch (e) { toast(msg(e), 'err'); } }}>{done ? '✓ Completed' : 'Mark as complete'}</Button>
        {d.next ? <Button to={`/app/learn/${d.next.id}`}>Next lesson →</Button> : <Button tone="secondary" onClick={() => nav('/app/learn')}>Back to lessons</Button>}
      </div>
    </div>); }}</Async>;
}

export function Bookmarks() {
  const s = useLoad(() => get('/bookmarks')); const toast = useToast();
  return <div className="col"><PageTitle title="Bookmarks" sub="Lessons and tutor answers you saved." />
    <Async s={s}>{d => !d.bookmarks.length ? <Empty title="Nothing saved yet" text="Use the bookmark button on a lesson or a tutor answer to find it here later." action={<Button to="/app/learn">Browse lessons</Button>} /> :
      <Card className="col">{d.bookmarks.map((b: any) => <div className="row wrap listrow" key={b.id}><Icon name={b.kind === 'lesson' ? 'book' : 'chat'} /><div className="grow"><b>{b.title}</b><div className="muted small">{b.kind} · saved {fmtDT(b.created_at)}</div></div>
        {b.kind === 'lesson' && <Button tone="secondary" to={`/app/learn/${b.ref}`}>Open</Button>}<Button tone="secondary" aria-label={`Remove ${b.title}`} onClick={async () => { try { await del(`/bookmarks/${b.id}`); toast('Removed'); s.reload(); } catch (e) { toast(msg(e), 'err'); } }}><Icon name="trash" /></Button></div>)}</Card>}</Async></div>;
}

export function Homework() {
  const s = useLoad(() => get('/assignments')); const toast = useToast(); const [text, setText] = useState<Record<string, string>>({});
  return <div className="col"><PageTitle title={<Bi en="Homework" ta="வீட்டுப்பாடம்" />} sub="Assignments from your teacher." />
    <Async s={s}>{d => !d.assignments.length ? <Empty title="No homework" text="Your teacher has not set any homework yet, or you are not in a class." /> : d.assignments.map((a: any) => (
      <Card key={a.id} className="col"><div className="row wrap"><h3 className="grow">{a.title}</h3><Badge tone={a.submitted_at ? 'success' : new Date(a.due_at) < new Date() ? 'danger' : 'warning'}>{a.submitted_at ? 'Submitted' : new Date(a.due_at) < new Date() ? 'Overdue' : 'To do'}</Badge></div>
        <p className="muted">{a.description}</p><p className="small">Due {fmtDT(a.due_at)}</p>
        {a.feedback && <div className="notice info"><Icon name="chat" /><div><b>Teacher feedback</b><div>{a.feedback}</div></div></div>}
        <div className="field"><label htmlFor={`h${a.id}`}>Your answer</label><textarea id={`h${a.id}`} rows={4} maxLength={5000} value={text[a.id] ?? a.submission ?? ''} onChange={e => setText({ ...text, [a.id]: e.target.value })} /></div>
        <div className="row"><Button disabled={!(text[a.id] ?? a.submission ?? '').trim()} onClick={async () => { try { await post(`/assignments/${a.id}/submit`, { text: text[a.id] ?? a.submission }); toast('Homework submitted'); s.reload(); } catch (e) { toast(msg(e), 'err'); } }}>{a.submitted_at ? 'Update submission' : 'Submit'}</Button></div></Card>))}</Async></div>;
}

export function Progress_() {
  const s = useLoad(async () => ({ r: await get('/reports/me'), plan: await get('/revision-plan') }));
  return <div className="col"><PageTitle title={<Bi en="My progress" ta="என் முன்னேற்றம்" />} sub="Calculated only from your finished tests and activity." />
    <Async s={s}>{({ r, plan }) => { const rep = r.report; return <>
      <div className="grid g4 stat"><Stat icon="test" bg="var(--primary-soft)" fg="var(--primary)" value={String(rep.attempted)} label="Tests attempted" /><Stat icon="check" bg="var(--success-soft)" fg="var(--success)" value={String(rep.passed)} label="Passed" /><Stat icon="chart" bg="var(--gold-soft)" fg="var(--gold)" value={rep.passRate === null ? '—' : `${rep.passRate}%`} label="Pass rate" /><Stat icon="clock" bg="var(--accent-soft)" fg="var(--accent)" value={`${r.activity.activeDays}/7`} label="Active days this week" /></div>
      <Card className="col"><h2>Test scores</h2>{!rep.scores.length ? <p className="muted">No finished tests yet. Take a weekly test to see your scores here.</p> :
        <div className="bars" role="img" aria-label="Test scores">{rep.scores.map((x: any, i: number) => <div key={i} className="barcol"><span className="barval">{x.pct}%</span><i style={{ height: `${Math.max(4, x.pct)}%`, background: x.status === 'passed' ? 'var(--success)' : 'var(--danger)' }} /><span className="barlbl">{x.test.replace(/ —.*/, '')}</span></div>)}</div>}</Card>
      <div className="grid g2 split"><Card className="col"><h2>By subject</h2>{!rep.subjects.length ? <p className="muted">Appears after your first finished test.</p> : rep.subjects.map((x: any) => <div key={x.id} className="col" style={{ gap: 4 }}><div className="row"><b className="grow">{x.name}</b><span>{x.avgPct}% avg · {x.tests} test(s)</span></div><Progress pct={x.avgPct} label={x.name} /></div>)}</Card>
        <Card className="col"><h2>Activity — last 7 days</h2><div className="tablewrap" tabIndex={0} role="region" aria-label="Data table"><table className="tbl"><thead><tr><th>Day</th><th>Lessons</th><th>Practice</th><th>Tests</th><th>Tutor</th></tr></thead><tbody>{r.activity.days.map((d: any) => <tr key={d.day}><td>{new Date(d.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</td><td>{d.lessons}</td><td>{d.practice}</td><td>{d.tests}</td><td>{d.tutor}</td></tr>)}</tbody></table></div></Card></div>
      <Card className="col"><h2>Revision plan</h2><p className="muted small">{plan.note}</p>{!plan.items.length ? <p>No weak topics found yet.</p> : plan.items.map((i: any) => <div key={i.topic} className="row wrap listrow"><div className="grow"><b>{i.topic}</b><div className="muted small">{i.pct}% in recent tests</div></div>{i.lessons.map((l: any) => <Button key={l.id} tone="secondary" to={`/app/learn/${l.id}`}>Review: {l.title_en}</Button>)}<Button tone="ghost" to="/app/practice">Practise</Button></div>)}
        {!!plan.upcoming.length && <><h3>Upcoming tests</h3>{plan.upcoming.map((t: any) => <div key={t.id} className="row wrap listrow"><span className="grow">{t.title}</span><span className="muted small">closes {fmtDT(t.closes_at)}</span><Button tone="secondary" to={`/app/tests/${t.id}`}>View</Button></div>)}</>}</Card></>; }}</Async></div>;
}

export function Practice() {
  const [sp] = useSearchParams(); const opt = useLoad(() => get('/practice/options')); const toast = useToast();
  const [cfg, setCfg] = useState<any>({ subject: sp.get('subject') ?? '', chapter: '', difficulty: 'mixed', count: 5 }); const [run, setRun] = useState<any>(null); const [ans, setAns] = useState<Record<string, any>>({}); const [res, setRes] = useState<any>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (opt.data && !cfg.subject && opt.data.subjects[0]) setCfg((c: any) => ({ ...c, subject: opt.data.subjects[0].id })); }, [opt.data]); // eslint-disable-line
  const start = async () => { setBusy(true); try { const r = await post('/practice/start', { subject: cfg.subject, chapter: cfg.chapter ? Number(cfg.chapter) : undefined, difficulty: cfg.difficulty, count: Number(cfg.count) }); setRun(r); setAns({}); setRes(null); } catch (e) { toast(msg(e), 'err'); } finally { setBusy(false); } };
  const submit = async () => { setBusy(true); try { setRes(await post(`/practice/${run.sessionId}/submit`, { answers: ans })); } catch (e) { toast(msg(e), 'err'); } finally { setBusy(false); } };
  return <div className="col"><PageTitle title={<Bi en="Practice centre" ta="பயிற்சி மையம்" />} sub="Short sets from our question bank. Answers appear after you submit." />
    <Async s={opt}>{o => !o.subjects.length ? <Empty title="No practice questions yet" text={`There are no practice questions for Class ${o.classLevel} yet.`} /> : <>
      {!run && <Card className="col"><h2>Choose a set</h2><div className="grid g2">
        <div className="field"><label htmlFor="ps">Subject</label><select id="ps" value={cfg.subject} onChange={e => setCfg({ ...cfg, subject: e.target.value, chapter: '' })}>{o.subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name_en} ({s.n})</option>)}</select></div>
        <div className="field"><label htmlFor="pc">Chapter</label><select id="pc" value={cfg.chapter} onChange={e => setCfg({ ...cfg, chapter: e.target.value })}><option value="">All chapters</option>{(o.subjects.find((s: any) => s.id === cfg.subject)?.chapters ?? []).map((c: number) => <option key={c} value={c}>Chapter {c}</option>)}</select></div>
        <div className="field"><label htmlFor="pd">Difficulty</label><select id="pd" value={cfg.difficulty} onChange={e => setCfg({ ...cfg, difficulty: e.target.value })}>{['mixed', 'easy', 'medium', 'hard'].map(d => <option key={d}>{d}</option>)}</select></div>
        <div className="field"><label htmlFor="pn">Number of questions</label><select id="pn" value={cfg.count} onChange={e => setCfg({ ...cfg, count: e.target.value })}>{[3, 5, 10, 15, 20].map(d => <option key={d}>{d}</option>)}</select></div></div>
        <div className="row"><Button onClick={start} disabled={busy || !cfg.subject}>{busy ? 'Preparing…' : 'Start practice'}</Button></div></Card>}
      {run && !res && <Card className="col"><div className="row"><h2 className="grow">Practice set</h2><Badge tone="info">{Object.keys(ans).filter(k => String(ans[k] ?? '') !== '').length}/{run.questions.length} answered</Badge></div><p className="muted small">{run.label}</p>
        {run.questions.map((q: any, i: number) => <QuestionInput key={q.id} n={i + 1} q={q} value={ans[q.id]} onChange={v => setAns({ ...ans, [q.id]: v })} />)}
        <div className="row"><Button onClick={submit} disabled={busy}>{busy ? 'Checking…' : 'Submit answers'}</Button><Button tone="secondary" onClick={() => setRun(null)}>Cancel</Button></div></Card>}
      {res && <Card className="col"><h2>Result: {res.score}/{res.total} ({res.pct}%)</h2><p>{res.next}</p>
        {res.results.map((r: any, i: number) => <div key={r.id} className={`review ${r.correct ? 'ok' : 'bad'}`}><div className="row"><b className="grow">Q{i + 1}. <Bi en={r.text_en} ta={r.text_ta} /></b><Badge tone={r.correct ? 'success' : 'danger'}>{r.correct ? 'Correct' : 'Not correct'}</Badge></div>
          <div className="small">Your answer: <b>{String(r.given ?? '—')}</b>{!r.correct && <> · Correct answer: <b>{String(r.correctAnswer)}</b></>}</div>{r.explanation_en && <div className="muted small"><Bi en={r.explanation_en} ta={r.explanation_ta ?? ''} /></div>}</div>)}
        {!!res.revise.length && <div className="notice info"><Icon name="target" />Revise: {res.revise.join(', ')}</div>}
        <div className="row wrap"><Button onClick={() => { setRun(null); setRes(null); }}>New set</Button><Button tone="secondary" to="/app/tutor">Ask the tutor</Button></div></Card>}</>}</Async></div>;
}

/** Shared question input used by practice and tests. Never shows answer keys. */
export function QuestionInput({ q, n, value, onChange, disabled }: { q: any; n: number; value: any; onChange: (v: any) => void; disabled?: boolean }) {
  const labelId = `q${q.id}`;
  return (
    <fieldset className="qbox" disabled={disabled}><legend id={labelId} className="qtext"><span className="muted">Q{n}.</span> <Bi en={q.text_en} ta={q.text_ta ?? q.text_en} block />{q.marks != null && <span className="muted small"> [{q.marks} {q.marks === 1 ? 'mark' : 'marks'}]</span>}</legend>
      {(q.type === 'mcq') && <div className="col" role="radiogroup" aria-labelledby={labelId} style={{ gap: 8 }}>{q.options.map((o: string, i: number) => <button type="button" key={i} role="radio" aria-checked={value === i} className="opt" onClick={() => onChange(i)}><span className="avatar">{String.fromCharCode(65 + i)}</span><span>{o}</span></button>)}</div>}
      {q.type === 'tf' && <div className="row wrap" role="radiogroup" aria-labelledby={labelId}>{['True', 'False'].map((o, i) => <button type="button" key={o} role="radio" aria-checked={value === i} className="opt" style={{ width: 'auto', flex: 1 }} onClick={() => onChange(i)}>{o}</button>)}</div>}
      {(q.type === 'fill' || q.type === 'numeric') && <div className="field"><label className="sr" htmlFor={`a${q.id}`}>Your answer</label><input id={`a${q.id}`} inputMode={q.type === 'numeric' ? 'decimal' : 'text'} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={q.type === 'numeric' ? 'Enter a number' : 'Type your answer'} maxLength={200} /></div>}
      {q.type === 'short' && <div className="field"><label className="sr" htmlFor={`a${q.id}`}>Your written answer</label><textarea id={`a${q.id}`} rows={5} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder="Write your answer with steps. Your teacher will mark this." maxLength={4000} /><div className="hint">Marked by your teacher</div></div>}
    </fieldset>
  );
}

const HOLD: Record<string, string> = { pending: 'Your teacher or school-administrator request is waiting for approval by a platform administrator. Until then your account has no staff access.', parent: 'Your parent / guardian account is created. The parent dashboard is not available in this version.', teacher: 'The teacher workspace is not available in this version.', school_admin: 'The school administration workspace is not available in this version.', admin: 'The administration workspace is not available in this version.' };
function Holding({ role, name }: { role: string; name: string }) {
  return (
    <div className="col" style={{ gap: 20 }}>
      <PageTitle title={`Welcome, ${name}`} sub="Account created" />
      <Card className="col"><div className="row"><Icon name="shield" /><h2 className="grow">{role === 'pending' ? 'Waiting for approval' : 'Your workspace'}</h2></div><p className="muted">{HOLD[role]}</p></Card>
    </div>
  );
}
