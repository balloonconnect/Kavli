import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StudentShell } from '../components/Shell';
import { Badge, Button, Card, Icon, Progress, ScoreRing } from '../components/ui';
import { certificates, questions, student, tests, topics } from '../data/demo';

const tone = (s: string) => (s === 'Passed' ? 'success' : s === 'Available' ? 'info' : s === 'Pending review' ? 'warning' : 'neutral') as 'success' | 'info' | 'warning' | 'neutral';

export function TestsList() {
  return (
    <StudentShell>
      <h1>Weekly Tests</h1>
      <div className="col">
        {tests.map(t => (
          <Card key={t.id} className="row wrap">
            <div className="grow"><h3>{t.title}</h3><p className="muted small">{'due' in t ? `Closes ${t.due} · ${t.minutes} min · ${t.marks} marks` : `${t.date} · ${t.got} / ${t.marks}`}</p></div>
            <Badge tone={tone(t.status)}>{t.status}</Badge>
            {t.status === 'Available' ? <Button to={`/app/tests/${t.id}`}>Start</Button> : <Button tone="secondary" to={`/app/tests/${t.id}/result`}>View result</Button>}
          </Card>
        ))}
      </div>
    </StudentShell>
  );
}

export function TestInstructions() {
  const { id } = useParams(); const [ok, setOk] = useState(false);
  return (
    <StudentShell>
      <h1>Mathematics — Weekly Test 7</h1>
      <Card className="col">
        <h3>Before you begin</h3>
        <ul className="col" style={{ margin: 0, paddingLeft: 20 }}>
          <li>45 minutes · 50 marks · pass mark 20.</li><li>Answers save automatically. You can flag a question to come back to it.</li>
          <li>Short answers are reviewed by your teacher, so your result may show “Pending review”.</li><li>You have 1 retake. Your latest finalised score counts.</li>
        </ul>
        <div className="notice b-success"><Icon name="check" />You are eligible: Class 8 · active student.</div>
        <label className="row"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />I have read the instructions.</label>
        <Button to={`/app/tests/${id}/take`} disabled={!ok} className={ok ? '' : 'disabled'}>Start test</Button>
      </Card>
    </StudentShell>
  );
}

export function TestTaking() {
  const nav = useNavigate(); const { id } = useParams();
  const [i, setI] = useState(0); const [ans, setAns] = useState<Record<number, string>>({});
  const [flag, setFlag] = useState<Set<number>>(new Set()); const [secs, setSecs] = useState(45 * 60);
  const [confirm, setConfirm] = useState(false); const [submitting, setSubmitting] = useState(false);
  useEffect(() => { const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  const q = questions[i];
  const unanswered = questions.filter(x => !ans[x.id]).map(x => 'Q' + x.id);
  const submit = () => { if (submitting) return; setSubmitting(true); /* TODO: POST /attempts/:id/submit (idempotent) */ setTimeout(() => nav(`/app/tests/${id}/result`), 700); };
  const mm = String(Math.floor(secs / 60)).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0');
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16 }} className="col">
      <div className="row"><b className="grow">Maths · Week 7</b><Badge tone="warning">⏱ {mm}:{ss} left</Badge></div>
      <div className="row"><span className="small muted">Question {i + 1} of {questions.length}</span><div className="grow"><Progress pct={((i + 1) / questions.length) * 100} label="Test progress" /></div></div>
      <Card className="col">
        <div className="row"><Badge tone="info">{q.type} · {q.marks} marks</Badge>{flag.has(q.id) && <Badge tone="warning">Flagged</Badge>}</div>
        <h2>{q.text}</h2>
        {q.options.length ? <div className="col" role="radiogroup" aria-label="Answer options">{q.options.map(o => <button key={o} role="radio" aria-checked={ans[q.id] === o} className="opt" onClick={() => setAns({ ...ans, [q.id]: o })}><span style={{ width: 20, height: 20, borderRadius: 99, border: '2px solid ' + (ans[q.id] === o ? 'var(--primary)' : 'var(--border)'), background: ans[q.id] === o ? 'var(--primary)' : 'none' }} />{o}</button>)}</div>
          : <div className="field"><label htmlFor="sa" className="muted">Your answer</label><textarea id="sa" rows={5} value={ans[q.id] ?? ''} onChange={e => setAns({ ...ans, [q.id]: e.target.value })} /></div>}
      </Card>
      <div className="row wrap">
        <Button tone="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
        <Button tone="ghost" onClick={() => setFlag(s => { const n = new Set(s); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}>Flag</Button>
        <div className="grow" />
        {i < questions.length - 1 ? <Button onClick={() => setI(i + 1)}>Next</Button> : <Button tone="teal" onClick={() => setConfirm(true)}>Review & submit</Button>}
      </div>
      <p className="xs muted center">Answers save automatically. Scores are checked on the server.</p>
      {confirm && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="sm"><div className="modal col">
          <div className="iconbox" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="alert" size={22} /></div>
          <h2 id="sm">Submit your test?</h2>
          <p className="muted">You answered {questions.length - unanswered.length} of {questions.length}. {flag.size} flagged, {unanswered.length} empty. You cannot change answers after submitting.</p>
          <div className="row"><Button tone="secondary" onClick={() => setConfirm(false)} className="grow">Keep working</Button><Button onClick={submit} disabled={submitting} className="grow">{submitting ? 'Submitting…' : 'Submit test'}</Button></div>
          <p className="xs muted">Each attempt is submitted once, even if you press twice.</p>
        </div></div>
      )}
    </div>
  );
}

export function ResultPage() {
  const { id } = useParams();
  const passed = id !== 'social-5'; const pending = id === 'pending';
  const got = passed ? 42 : 17; const pct = got * 2;
  const col = passed ? 'var(--success)' : 'var(--primary)';
  return (
    <StudentShell>
      <div className="row" style={{ background: pending ? 'var(--warning-soft)' : passed ? 'var(--success-soft)' : 'var(--primary-soft)', borderRadius: 20, padding: 32, gap: 32 }}>
        <ScoreRing pct={pct} color={col} label={`${pct}%`} sub={`${got} / 50`} />
        <div className="col grow">
          <Badge tone={passed ? 'success' : 'neutral'}>{pending ? 'Pending review' : passed ? 'Passed · Final result' : 'Not passed · Final result'}</Badge>
          <h1 style={{ color: col }}>{passed ? 'Well done, Meena! You passed.' : 'Almost there — you were 3 marks away.'}</h1>
          <p lang="ta" className="ta" style={{ fontSize: 18, color: col }}>{passed ? 'வாழ்த்துகள் மீனா! நீங்கள் தேர்ச்சி பெற்றீர்கள்.' : 'இன்னும் 3 மதிப்பெண்கள் தேவைப்பட்டன. மீண்டும் முயல்வோம்!'}</p>
          <div className="row">{passed ? <Button tone="teal" to="/app/certificates">Download certificate</Button> : <Button>Start retake (1 left)</Button>}<Button tone="secondary">Review answers</Button></div>
        </div>
      </div>
      <Card className="col"><h3>Topic-wise performance</h3>
        {topics.map(t => <div key={t.t}><div className="row small"><span className="grow semi">{t.t}</span><span className="muted">{t.got} / {t.tot} marks</span></div><Progress pct={(t.got / t.tot) * 100} label={t.t} color={t.got / t.tot < 0.7 ? 'var(--warning)' : 'var(--success)'} /></div>)}
      </Card>
      {!passed && <p className="muted small">No certificate for this attempt. Certificates are issued only after a finalised pass.</p>}
    </StudentShell>
  );
}

export function Certificates() {
  return (
    <StudentShell>
      <div className="row"><h1 className="grow">My Certificates</h1><Badge tone="warning">Demo data</Badge></div>
      <p className="muted">You can see only your own certificates. Share a verification link instead of the PDF to protect your details.</p>
      {certificates.filter(c => c.status === 'Valid').map(c => (
        <Card key={c.ref} className="row wrap gold" >
          <Icon name="award" size={32} color="var(--gold)" />
          <div className="grow"><h3>{c.title}</h3><p className="muted small">{c.marks} · Earned {c.date} · Ref {c.ref}</p></div>
          <Badge tone="success">Valid</Badge><Button to={`/app/certificates/${c.ref}`}>Preview</Button>
          <Button tone="secondary" onClick={() => navigator.clipboard?.writeText(`${location.origin}/verify/${c.ref}`)}>Copy verification link</Button>
        </Card>
      ))}
    </StudentShell>
  );
}

export function CertificateView() {
  const { ref } = useParams(); const c = certificates.find(x => x.ref === ref) ?? certificates[0];
  return (
    <div style={{ maxWidth: 1123, margin: '24px auto', padding: 16 }} className="col">
      <div className="row no-print"><Button tone="secondary" to="/app/certificates">Back</Button><div className="grow" /><Button onClick={() => window.print()}>Print / Save PDF</Button></div>
      <div className="cert" style={{ aspectRatio: '1123 / 794', background: 'var(--surface)', padding: '40px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <b style={{ color: 'var(--primary)' }}>AI Learning Platform</b>
        <h1 style={{ color: 'var(--gold)', fontSize: 30 }}>WEEKLY TEST ACHIEVEMENT CERTIFICATE</h1>
        <p lang="ta" className="ta" style={{ color: 'var(--gold)', fontSize: 20 }}>வாராந்திர தேர்வு சாதனைச் சான்றிதழ்</p>
        <p className="muted">This certificate is proudly presented to</p>
        <h1 style={{ fontSize: 44 }}>{student.name}</h1><p lang="ta" className="ta" style={{ fontSize: 26, fontWeight: 600 }}>{student.ta}</p>
        <p>for passing {c.title} (Class 8) with {c.marks}.</p><p className="muted small">Academic year 2026–2027 · Issued {c.date}</p>
        <div className="grow" />
        <div className="row" style={{ width: '100%', textAlign: 'left', alignItems: 'flex-end' }}>
          <div style={{ width: 110, height: 110, border: '2px solid var(--text)', display: 'grid', placeItems: 'center' }} aria-label="QR code placeholder" className="muted small">QR code</div>
          <div className="grow small"><b>Reference No. {c.ref}</b><br /><span style={{ color: 'var(--primary)' }}>Verify at: /verify/{c.ref}</span></div>
          <p className="xs muted" style={{ maxWidth: 300, textAlign: 'right' }}>Platform-issued achievement certificate. Not an official board, school or government certificate. Demo data.</p>
        </div>
      </div>
    </div>
  );
}
