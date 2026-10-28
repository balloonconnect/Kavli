import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Field, Icon, IconBox, Badge } from '../components/ui';
import { Bi, LangToggle } from '../components/lang';

export function Landing() {
  return (
    <div>
      <header className="row" style={{ padding: '16px 48px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <span className="logo" style={{ padding: 0 }}><span className="m"><Icon name="book" size={20} /></span><b>Kalvi Mitra</b></span>
        <div className="grow" /><LangToggle /><Button tone="secondary" to="/signup">Sign up</Button><Button to="/app">Try the demo</Button>
      </header>
      <section className="grid g2" style={{ padding: '64px 48px', alignItems: 'center', gap: 48 }}>
        <div className="col" style={{ gap: 20 }}>
          <Badge tone="teal">Classes 1–12 · Samacheer Kalvi aligned</Badge>
          <h1 style={{ fontSize: 44, lineHeight: 1.15 }}><Bi block en="Learn at your own pace, in Tamil or English." ta="உங்கள் வேகத்தில் கற்றுக்கொள்ளுங்கள் — தமிழிலும் ஆங்கிலத்திலும்." /></h1>
          <p className="muted" style={{ fontSize: 16 }}>A friendly AI tutor for lessons, practice and weekly tests. Not an official board product.</p>
          <div className="row"><Button to="/signup">Start learning</Button><Button tone="secondary" to="/verify">Verify a certificate</Button></div>
        </div>
        <Card><h3>Today’s question</h3><p className="ta" style={{ marginTop: 8 }}>3x + 5 = 20 ஐ எப்படி தீர்ப்பது?</p>
          <p className="muted" style={{ marginTop: 8 }}>Step 1: subtract 5 from both sides → 3x = 15. Step 2: divide by 3 → x = 5.</p><p className="xs muted" style={{ marginTop: 12 }}>Demo conversation</p></Card>
      </section>
      <section className="grid g3" style={{ padding: '0 48px 64px' }}>
        {([['chat', 'AI tutor', 'Ask in Tamil or English'], ['upload', 'Your material', 'Learn from a photo, PDF or link'], ['award', 'Weekly tests', 'Server-scored, with certificates']] as const).map(([i, t, s]) =>
          <Card key={t}><div className="col"><IconBox name={i} bg="var(--primary-soft)" fg="var(--primary)" /><h3>{t}</h3><p className="muted">{s}</p></div></Card>)}
      </section>
      <footer className="muted small center" style={{ padding: 24 }}>© Kalvi Mitra · Independent learning aid · Demo data shown</footer>
    </div>
  );
}

export function Signup() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', pw: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = 'Please enter your name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email';
    if (f.pw.length < 8) er.pw = 'Use at least 8 characters';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true); setTimeout(() => nav('/profile'), 600); // TODO: POST /auth/signup
  };
  return (
    <div className="grid g2" style={{ minHeight: '100vh', gap: 0 }}>
      <div style={{ background: 'var(--primary)', color: '#fff', padding: 64 }} className="col">
        <h1><Bi block en="Welcome to Kalvi Mitra" ta="கல்வி மித்ராவுக்கு வரவேற்கிறோம்" /></h1><p>Create an account to start learning.</p>
      </div>
      <form onSubmit={submit} className="col" style={{ padding: 64, justifyContent: 'center', maxWidth: 520 }} noValidate>
        <h2>Create your account</h2>
        <Field label="Full name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} error={err.name} />
        <Field label="Email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} error={err.email} />
        <Field label="Password" type="password" value={f.pw} onChange={e => setF({ ...f, pw: e.target.value })} error={err.pw} hint="At least 8 characters" />
        <Button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
        <p className="muted small">Already registered? <Link to="/app" style={{ color: 'var(--primary)' }}>Sign in</Link></p>
      </form>
    </div>
  );
}

export function Profile() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const steps = ['About you', 'School', 'Language'];
  return (
    <div style={{ maxWidth: 720, margin: '48px auto', padding: 16 }} className="col">
      <h1>Complete your student profile</h1>
      <div className="row">{steps.map((s, i) => <Badge key={s} tone={i === step ? 'info' : i < step ? 'success' : 'neutral'}>{i + 1}. {s}</Badge>)}</div>
      <Card>
        {step === 0 && <div className="grid g2"><Field label="Student name" defaultValue="Meenakshi Kumar" /><Field label="Date of birth" type="date" hint="Used only to confirm eligibility" /></div>}
        {step === 1 && <div className="grid g2"><Field label="Class (1–12)" type="number" min={1} max={12} defaultValue={8} /><Field label="School (optional)" /></div>}
        {step === 2 && <p>Choose how lessons appear: Tamil, English, or both. You can change this any time from the top bar.</p>}
      </Card>
      <div className="row">
        {step > 0 && <Button tone="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
        <div className="grow" />
        <Button onClick={() => (step < 2 ? setStep(step + 1) : nav('/app'))}>{step < 2 ? 'Continue' : 'Finish'}</Button>
      </div>
    </div>
  );
}
