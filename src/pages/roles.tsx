import { useState } from 'react';
import { Shell, parentNav, teacherNav, adminNav } from '../components/Shell';
import { Badge, Button, Card, Field, Icon, Progress, Stat } from '../components/ui';
import { certificates, subjects, tests } from '../data/demo';

const Parent = ({ children }: { children: React.ReactNode }) => <Shell nav={parentNav} role="Parent portal" user={{ name: 'Mr. Kumar', sub: 'Parent of Meena', initial: 'K' }}>{children}</Shell>;
const Teacher = ({ children }: { children: React.ReactNode }) => <Shell nav={teacherNav} role="Teacher workspace" user={{ name: 'Ms. Priya', sub: 'Class 8 Maths', initial: 'P' }}>{children}</Shell>;
const Admin = ({ children }: { children: React.ReactNode }) => <Shell nav={adminNav} role="Admin console" user={{ name: 'Admin', sub: 'Platform admin', initial: 'A' }}>{children}</Shell>;

export function ParentDashboard() {
  return (
    <Parent>
      <div><h1>Meena’s learning this week</h1><p className="muted">Read-only view for linked parents. You can see progress and results, not private chats.</p></div>
      <div className="grid g4 stat">
        <Stat icon="clock" bg="var(--primary-soft)" fg="var(--primary)" value="4 h 20 m" label="Study time" note="+35 min vs last week" />
        <Stat icon="book" bg="var(--accent-soft)" fg="var(--accent)" value="11" label="Lessons completed" note="of 14 planned" />
        <Stat icon="target" bg="var(--success-soft)" fg="var(--success)" value="78%" label="Practice accuracy" />
        <Stat icon="award" bg="var(--gold-soft)" fg="var(--gold)" value="2" label="Certificates" />
      </div>
      <div className="grid g2">
        <Card className="col"><h3>Subject progress</h3>{subjects.map(s => <div key={s.name}><div className="row small"><span className="grow semi">{s.name}</span>{s.pct}%</div><Progress pct={s.pct} label={s.name} color={s.pct < 40 ? 'var(--warning)' : 'var(--primary)'} /></div>)}</Card>
        <Card className="col"><h3>Where Meena may need support</h3>
          <div className="notice b-warning"><Icon name="alert" />Social Science — Scale and distance: 3 / 15 in the last test</div>
          <div className="notice b-warning"><Icon name="alert" />Retake available — closes 4 Nov</div>
          <Button tone="secondary">Download weekly report (PDF)</Button></Card>
      </div>
      <Card className="flush"><table className="tbl"><thead><tr><th>Test</th><th>Date</th><th>Marks</th><th>Result</th></tr></thead><tbody>
        {tests.filter(t => 'got' in t).map(t => <tr key={t.id}><td>{t.title}</td><td>{t.date}</td><td>{t.got} / {t.marks}</td><td><Badge tone={t.status === 'Passed' ? 'success' : 'neutral'}>{t.status}</Badge></td></tr>)}
      </tbody></table></Card>
    </Parent>
  );
}

export function TeacherBuilder() {
  const [title, setTitle] = useState('Mathematics — Weekly Test 7'); const [pass, setPass] = useState(20); const [total, setTotal] = useState(50);
  const err = pass > total ? 'Passing marks cannot exceed total marks' : '';
  return (
    <Teacher>
      <div className="row"><div className="grow"><h1>Create weekly test</h1><p className="muted">Draft · not visible to students until published</p></div><Badge>Draft</Badge><Button tone="secondary">Preview as student</Button><Button disabled={!!err}>Publish test</Button></div>
      <Card className="col"><h3>Test settings</h3>
        <div className="grid g3"><Field label="Title" value={title} onChange={e => setTitle(e.target.value)} /><Field label="Class" defaultValue="Class 8" /><Field label="Duration (min)" type="number" defaultValue={45} /></div>
        <div className="grid g3"><Field label="Total marks" type="number" value={total} onChange={e => setTotal(+e.target.value)} /><Field label="Passing marks" type="number" value={pass} onChange={e => setPass(+e.target.value)} error={err} hint="Saved with the test; later rule changes do not alter past results" /><Field label="Retakes allowed" type="number" defaultValue={1} /></div>
      </Card>
      <Card className="col"><div className="row"><h3 className="grow">Questions</h3><Button tone="secondary">Add from question bank</Button><Button tone="teal">Add question</Button></div>
        <p className="muted small">Answers are scored on the server. Answer keys are never sent to students’ browsers. Short and long answers go to review.</p></Card>
    </Teacher>
  );
}

export function TeacherResults() {
  const rows = [['Meenakshi K.', '42 / 50', '84%', 'Passed'], ['Arun P.', '38 / 50', '76%', 'Passed'], ['Divya S.', '31 / 40 + 2 pending', '—', 'Pending review'], ['Karthik R.', '17 / 50', '34%', 'Not passed']];
  return (
    <Teacher>
      <h1>Mathematics — Weekly Test 6 · Results</h1>
      <div className="grid g4 stat"><Stat icon="users" bg="var(--primary-soft)" fg="var(--primary)" value="58 / 62" label="Submitted" /><Stat icon="trend" bg="var(--accent-soft)" fg="var(--accent)" value="31.4 / 50" label="Class average" /><Stat icon="shield" bg="var(--success-soft)" fg="var(--success)" value="81%" label="Pass rate" /><Stat icon="clock" bg="var(--warning-soft)" fg="var(--warning)" value="3" label="Pending review" /></div>
      <Card className="flush"><table className="tbl"><thead><tr><th>Student</th><th>Marks</th><th>Percent</th><th>Status</th><th /></tr></thead><tbody>
        {rows.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><Badge tone={r[3] === 'Passed' ? 'success' : r[3] === 'Pending review' ? 'warning' : 'neutral'}>{r[3]}</Badge></td><td><Button tone={r[3] === 'Pending review' ? 'primary' : 'ghost'}>{r[3] === 'Pending review' ? 'Review' : 'View'}</Button></td></tr>)}
      </tbody></table></Card>
    </Teacher>
  );
}

export function AdminCertificates() {
  const [sel, setSel] = useState(certificates[0].ref); const [reason, setReason] = useState(''); const [log, setLog] = useState<string[]>(['24 Oct · system · Issued KM-2026-WT-000417']);
  const [status, setStatus] = useState<Record<string, string>>({});
  const revoke = () => { if (!reason) return; setStatus(s => ({ ...s, [sel]: 'Revoked' })); setLog(l => [`${new Date().toLocaleDateString()} · admin · Revoked ${sel} (${reason})`, ...l]); setReason(''); };
  return (
    <Admin>
      <div><h1>Certificates</h1><p className="muted">Revoke or reissue certificates. Every change needs a reason and is written to the audit log.</p></div>
      <div className="grid split" style={{ gridTemplateColumns: '1fr 400px' }}>
        <Card className="flush"><table className="tbl"><thead><tr><th>Reference</th><th>Test</th><th>Status</th></tr></thead><tbody>
          {certificates.map(c => { const st = status[c.ref] ?? c.status; return <tr key={c.ref} className={sel === c.ref ? 'sel' : ''} onClick={() => setSel(c.ref)} style={{ cursor: 'pointer' }}><td>{c.ref}</td><td>{c.title}</td><td><Badge tone={st === 'Valid' ? 'success' : 'danger'}>{st}</Badge></td></tr>; })}
        </tbody></table></Card>
        <Card className="col"><h3>Revoke certificate</h3><p className="muted small">{sel}</p>
          <div className="field"><label htmlFor="rs">Reason (required)</label><select id="rs" value={reason} onChange={e => setReason(e.target.value)}><option value="">Select a reason</option><option>Issued in error</option><option>Mark correction</option><option>Integrity issue</option></select></div>
          <div className="notice b-danger"><Icon name="alert" />Once revoked, the public verification link shows “revoked”. The student is notified.</div>
          <Button tone="danger" disabled={!reason} onClick={revoke}><Icon name="ban" />Revoke certificate</Button>
          <div className="col" style={{ background: 'var(--surface-alt)', borderRadius: 12, padding: 14, gap: 6 }}><b className="small">Audit trail</b>{log.map(l => <span key={l} className="xs muted">{l}</span>)}</div>
        </Card>
      </div>
    </Admin>
  );
}
