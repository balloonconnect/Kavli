import { useEffect, useRef, useState } from 'react';
import { StudentShell } from '../components/Shell';
import { Badge, Button, Card, Empty, ErrorState, Icon, Loading, Progress, Stat } from '../components/ui';
import { Bi } from '../components/lang';
import { subjects } from '../data/demo';

export function Dashboard() {
  return (
    <StudentShell>
      <div><h1><Bi block en="Vanakkam, Meena" ta="வணக்கம் மீனா!" /></h1><p className="muted">Pick up where you left off.</p></div>
      <div className="grid g4 stat">
        <Stat icon="clock" bg="var(--primary-soft)" fg="var(--primary)" value="4 h 20 m" label="This week" />
        <Stat icon="book" bg="var(--accent-soft)" fg="var(--accent)" value="11" label="Lessons done" />
        <Stat icon="target" bg="var(--success-soft)" fg="var(--success)" value="78%" label="Practice accuracy" />
        <Stat icon="award" bg="var(--gold-soft)" fg="var(--gold)" value="2" label="Certificates" />
      </div>
      <div className="grid g2">
        <Card><h3>Continue: Algebra — Solving equations</h3><p className="muted">Class 8 · Maths · 12 min left</p><div style={{ marginTop: 12 }}><Button to="/app/lesson">Resume lesson</Button></div></Card>
        <Card><div className="row"><h3 className="grow">Weekly Test 7 · Maths</h3><Badge tone="warning">Due Fri</Badge></div><p className="muted">45 minutes · 50 marks · 1 retake</p><div style={{ marginTop: 12 }}><Button tone="secondary" to="/app/tests/maths-7">View instructions</Button></div></Card>
      </div>
      <Card><h3 style={{ marginBottom: 12 }}>Subject progress</h3><div className="col">
        {subjects.map(s => <div key={s.name}><div className="row"><span className="grow semi">{s.name}</span><span>{s.pct}%</span></div><Progress pct={s.pct} label={s.name} color={s.pct < 40 ? 'var(--warning)' : 'var(--primary)'} /></div>)}
      </div></Card>
    </StudentShell>
  );
}

export function Lesson() {
  const [done, setDone] = useState(false);
  return (
    <StudentShell>
      <div className="row"><h1 className="grow"><Bi block en="Solving equations" ta="சமன்பாடுகளைத் தீர்த்தல்" /></h1><Badge tone="info">Class 8 · Maths</Badge></div>
      <div className="grid g2 split" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <Card><div className="col">
          <h3>Step by step</h3>
          <p><Bi block en="1. Subtract 5 from both sides: 3x = 15." ta="1. இருபுறமும் 5 ஐக் கழிக்கவும்: 3x = 15." /></p>
          <p><Bi block en="2. Divide both sides by 3: x = 5." ta="2. இருபுறமும் 3 ஆல் வகுக்கவும்: x = 5." /></p>
          <div className="notice" style={{ background: 'var(--primary-soft)' }}><Icon name="alert" color="var(--primary)" />Check: 3 × 5 + 5 = 20 ✓</div>
          <Button tone={done ? 'secondary' : 'teal'} onClick={() => setDone(true)} disabled={done}>{done ? 'Lesson completed ✓' : 'Mark as complete'}</Button>
        </div></Card>
        <Card><h3>Practice</h3><p className="muted" style={{ margin: '8px 0 12px' }}>Try 5 questions on this lesson.</p><Button to="/app/tutor" tone="ghost">Ask the tutor</Button></Card>
      </div>
    </StudentShell>
  );
}

type Msg = { from: 'me' | 'bot'; text: string };
export function Tutor() {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: 'Vanakkam! Ask me anything about your lesson, in Tamil or English.' }]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, busy]);
  const send = () => {
    if (!text.trim() || busy) return;
    setMsgs(m => [...m, { from: 'me', text }]); setText(''); setBusy(true); setErr(false);
    // TODO: replace with POST /tutor/messages (streaming); demo reply below
    setTimeout(() => { setMsgs(m => [...m, { from: 'bot', text: 'Step 1: subtract 5 → 3x = 15. Step 2: divide by 3 → x = 5. படி 1: இருபுறமும் 5 ஐக் கழிக்கவும்.' }]); setBusy(false); }, 900);
  };
  return (
    <StudentShell>
      <div className="row"><h1 className="grow">AI Tutor</h1><Badge tone="info">Class 8 · Maths · Algebra</Badge></div>
      <Card className="col" >
        <div className="col" style={{ minHeight: 320 }} aria-live="polite">
          {msgs.map((m, i) => <div key={i} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '75%', padding: '10px 14px', borderRadius: 16, background: m.from === 'me' ? 'var(--primary)' : 'var(--surface-alt)', color: m.from === 'me' ? '#fff' : 'var(--text)' }}>{m.text}</div>)}
          {busy && <Loading text="Tutor is thinking…" />}{err && <ErrorState text="Couldn’t reach the tutor." retry={send} />}
          <div ref={end} />
        </div>
        <form className="row" onSubmit={e => { e.preventDefault(); send(); }}>
          <input aria-label="Your question" className="search grow" style={{ width: 'auto' }} placeholder="Ask in Tamil or English…" value={text} onChange={e => setText(e.target.value)} />
          <Button aria-label="Send" disabled={!text.trim() || busy}><Icon name="send" /></Button>
        </form>
        <p className="xs muted">AI can make mistakes. Check with your textbook or teacher.</p>
      </Card>
    </StudentShell>
  );
}

export function Material() {
  const [tab, setTab] = useState<'photo' | 'pdf' | 'link'>('photo');
  const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState('');
  const pick = (f?: File) => {
    if (!f) return;
    const max = 10 * 1024 * 1024;
    if (f.size > max) { setErr('File is larger than 10 MB.'); setFile(null); return; }
    setErr(''); setFile(f);
  };
  return (
    <StudentShell>
      <h1>Learn from Your Material</h1>
      <div className="row">{(['photo', 'pdf', 'link'] as const).map(t => <button key={t} className={`pill ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t === 'photo' ? 'Photo' : t === 'pdf' ? 'PDF' : 'Link'}</button>)}</div>
      <Card className="col">
        {tab !== 'link' ? (<>
          <label className="state" style={{ border: '2px dashed var(--border)', borderRadius: 16, cursor: 'pointer' }}>
            <Icon name="upload" size={28} color="var(--primary)" /><b style={{ color: 'var(--text)' }}>Choose a {tab === 'photo' ? 'photo' : 'PDF'}</b><span>Up to 10 MB</span>
            <input type="file" hidden accept={tab === 'photo' ? 'image/*' : 'application/pdf'} onChange={e => pick(e.target.files?.[0])} />
          </label>
          {err && <div className="notice b-danger" role="alert">{err}</div>}
          {file ? <div className="row"><Icon name="file" /><span className="grow">{file.name}</span><Button tone="teal">Explain this</Button></div> : <Empty title="Nothing added yet" text="Your explanation will appear here." />}
        </>) : (<div className="row"><input className="search grow" style={{ width: 'auto' }} placeholder="Paste a web page link" aria-label="Link" /><Button>Explain</Button></div>)}
        <p className="xs muted">Files are used only to answer your questions and are not shared.</p>
      </Card>
    </StudentShell>
  );
}
