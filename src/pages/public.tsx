import { ReactNode, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Icon, Button, Card, Badge, Field } from '../components/ui';
import { Bi, LangToggle } from '../components/lang';
import { useAuth, homeFor } from '../auth';
import { useToast } from '../components/toast';
import { msg } from '../api';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth(); const [open, setOpen] = useState(false); const loc = useLocation();
  const links: [string, string][] = [['/features', 'Features'], ['/how-it-works', 'How it works'], ['/verify', 'Verify certificate'], ['/help', 'Help']];
  return (
    <div className="pub">
      <a className="skip" href="#main">Skip to content</a>
      <header className="pubhead">
        <Link to="/" className="logo" aria-label="Kalvi Mitra home"><span className="m"><Icon name="book" size={20} /></span><span><b style={{ fontSize: 16 }}>Kalvi Mitra</b></span></Link>
        <nav className="pubnav" aria-label="Site">{links.map(([to, t]) => <NavLink key={to} to={to}>{t}</NavLink>)}</nav>
        <div className="grow" /><LangToggle />
        {user ? <Button to={homeFor(user.role)} className="hide-sm">Open app</Button> : <><Button tone="secondary" to="/signin" className="hide-sm">Sign in</Button><Button to="/signup" className="hide-sm">Get started</Button></>}
        <button className="btn secondary iconbtn menubtn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name={open ? 'x' : 'menu'} /></button>
      </header>
      {open && <div className="pubdrawer" key={loc.pathname}>{links.map(([to, t]) => <Link key={to} to={to} onClick={() => setOpen(false)}>{t}</Link>)}{!user ? <><Link to="/signin" onClick={() => setOpen(false)}>Sign in</Link><Link to="/signup" onClick={() => setOpen(false)}>Get started</Link></> : <Link to={homeFor(user.role)} onClick={() => setOpen(false)}>Open app</Link>}</div>}
      <main id="main" tabIndex={-1} className="pubmain">{children}</main>
      <footer className="pubfoot">
        <div><b>Kalvi Mitra · கல்வி மித்ரா</b><p className="muted small">An independent study companion for Tamil Nadu State Board (Samacheer Kalvi) students, Classes 1–12. Not affiliated with, or endorsed by, the Government of Tamil Nadu or the Tamil Nadu State Board.</p></div>
        <div className="footlinks"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/child-safety">Child safety</Link><Link to="/help">Help</Link><Link to="/verify">Verify certificate</Link></div>
      </footer>
    </div>
  );
}

export function Landing() {
  const { user } = useAuth();
  return (
    <div className="col" style={{ gap: 48 }}>
      <section className="hero">
        <div className="col" style={{ gap: 16 }}>
          <Badge tone="info">Tamil Nadu State Board · Classes 1–12</Badge>
          <h1 className="herotitle"><Bi en="Learn in Tamil, English, or both — with an AI study friend" ta="தமிழ், ஆங்கிலம் அல்லது இரண்டிலும் கற்றுக்கொள்ளுங்கள்" block /></h1>
          <p className="muted" style={{ fontSize: 16 }}><Bi en="Bilingual lessons, a patient AI tutor, practice questions, weekly tests and verifiable achievement certificates." ta="இருமொழிப் பாடங்கள், AI ஆசிரியர், பயிற்சி, வாராந்திரத் தேர்வுகள் மற்றும் சான்றிதழ்கள்." block /></p>
          <div className="row wrap"><Button to={user ? homeFor(user.role) : '/signup'}>{user ? 'Open my app' : 'Create free account'}</Button><Button tone="secondary" to="/how-it-works">See how it works</Button></div>
          <p className="muted small">Lessons and questions shown here are sample content for this prototype, not official textbook content.</p>
        </div>
        <Card className="heroside"><h3>Today’s learning loop</h3>
          {['Open a lesson in Tamil or English', 'Ask the AI tutor to explain it simply', 'Practise a few questions', 'Take the weekly test', 'Earn a verifiable certificate'].map((t, i) => <div className="row" key={t}><span className="avatar">{i + 1}</span><span className="semi">{t}</span></div>)}</Card>
      </section>
      <section className="grid g3">
        {[['chat', 'AI tutor that explains', 'Ask in Tamil or English. Get step-by-step help, hints, and a “test my understanding” mode.'], ['upload', 'Learn from your own material', 'Add a photo, PDF or web page and get answers grounded in it — with page references.'], ['award', 'Certificates you can verify', 'Pass a weekly test and receive a PDF certificate with a QR code anyone can check.']].map(([i, t, d]) => (
          <Card key={t}><div className="col"><span className="iconbox" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Icon name={i as any} size={22} /></span><h3>{t}</h3><p className="muted">{d}</p></div></Card>))}
      </section>
    </div>
  );
}

export function Features() {
  const f: [any, string, string][] = [['layers', 'Bilingual lessons', 'Every lesson shows Tamil, English, or side by side — with vocabulary, worked examples, common mistakes and real-life links.'], ['chat', 'AI tutor', 'Asks clarifying questions, gives hints before answers, and can explain simply or in Tamil first.'], ['upload', 'Learn from your material', 'Photos, PDFs and links. Answers cite where they came from. Your uploads are private and never used to train models.'], ['target', 'Practice centre', 'Pick subject, chapter and difficulty. Answers and explanations appear after you submit.'], ['test', 'Weekly tests', 'Timed, server-checked attempts with clear pass rules, retake limits and answer review.'], ['award', 'Certificates', 'A4 PDF with Tamil text and a QR code that opens a privacy-safe verification page.'], ['users', 'Parents & teachers', 'Parents see only their linked child. Teachers see only their classes. Schools are kept separate.'], ['shield', 'Safety first', 'Guardian approval for younger children, no ads, no selling data, and a way to delete your data.']];
  return <div className="col"><h1>Features</h1><div className="grid g2">{f.map(([i, t, d]) => <Card key={t}><div className="row" style={{ alignItems: 'flex-start' }}><span className="iconbox" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Icon name={i} size={22} /></span><div><h3>{t}</h3><p className="muted">{d}</p></div></div></Card>)}</div></div>;
}
export function HowItWorks() {
  const s = [['Create an account', 'Sign up as a student or parent. Younger children need a parent or guardian to approve.'], ['Complete your profile', 'Choose your class, medium, subjects and language so lessons fit you.'], ['Learn', 'Open a lesson in Tamil, English or both, and ask the tutor when stuck.'], ['Practise', 'Do short practice sets and see explanations straight away.'], ['Take the weekly test', 'Timed and checked on the server. Pass to earn a certificate.'], ['Share your certificate', 'Download the PDF. Anyone can verify it with the QR code or reference number.']];
  return <div className="col"><h1>How it works</h1>{s.map(([t, d], i) => <Card key={t}><div className="row"><span className="avatar">{i + 1}</span><div><h3>{t}</h3><p className="muted">{d}</p></div></div></Card>)}</div>;
}
const Doc = ({ title, children }: { title: string; children: ReactNode }) => <div className="doc col"><h1>{title}</h1><div className="notice" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="info" /><span>Draft text for a prototype. It describes how this software currently behaves and must be reviewed by the school/operator and legal counsel before real use.</span></div>{children}</div>;
export const Privacy = () => <Doc title="Privacy notice"><Card className="prose">
  <h3>What we collect</h3><p>Name, email, class, medium, chosen subjects, school (optional), your test attempts and results, tutor chats, and files or links you add. We do not collect phone numbers, home addresses or photos of the student.</p>
  <h3>Why</h3><p>To personalise lessons, grade tests, issue certificates and show progress to you and your linked parent or teacher.</p>
  <h3>Your uploads</h3><p>Photos, PDFs and links are stored privately and visible only to you. They are not used to train AI models.</p>
  <h3>AI providers</h3><p>When an external AI provider is configured, your question and the relevant lesson or material text are sent to it to produce an answer. If none is configured, a built-in rule-based tutor answers instead and sends nothing outside this service.</p>
  <h3>Certificates</h3><p>The public verification page shows only a first name and initial, the achievement, date and status.</p>
  <h3>Your choices</h3><p>You can delete your account and data from Settings. Parents can approve or withdraw approval for children under 13.</p></Card></Doc>;
export const Terms = () => <Doc title="Terms of use"><Card className="prose"><p>Kalvi Mitra is a study aid. It is not a replacement for teachers or textbooks. AI answers can be wrong — check important answers with your textbook or teacher.</p><p>Certificates issued here recognise achievement in this platform’s weekly tests. They are not official Tamil Nadu State Board certificates.</p><p>Do not share your password. Do not upload other people’s private information. We may suspend accounts that misuse the service.</p></Card></Doc>;
export const ChildSafety = () => <Doc title="Child safety"><Card className="prose"><ul><li>Children under 13 need a parent or guardian to approve their account before using the AI tutor or uploads.</li><li>No advertising and no selling of data.</li><li>Tutor replies are limited to study help; you can report any reply with the flag button.</li><li>Parents can see their child’s progress and results, but not other families’ data.</li><li>If you ever feel unsafe or upset, talk to a trusted adult. In India you can call Childline on 1098.</li></ul></Card></Doc>;
export function Help() {
  const faq: [string, string][] = [['I forgot my password', 'Password reset by email is not available in this prototype. Ask your school administrator or platform admin to help.'], ['Why can’t I start a test?', 'A test can be started only between its opening and closing times, and only while you have attempts left.'], ['Why is my result “pending review”?', 'Written answers are marked by your teacher. Your result is final once they finish.'], ['Is the tutor a real AI?', 'It depends on how this service is configured. The tutor’s label tells you which one is answering.'], ['How do I verify a certificate?', 'Open Verify certificate and paste the reference number or scan the QR code.']];
  return <div className="col"><h1>Help</h1>{faq.map(([q, a]) => <Card key={q}><h3>{q}</h3><p className="muted">{a}</p></Card>)}</div>;
}
export function NotFound() { return <div className="state"><h1>Page not found</h1><p>The page you are looking for does not exist.</p><Button to="/">Go home</Button></div>; }

export function SignIn() {
  const { login, config } = useAuth(); const nav = useNavigate(); const loc = useLocation(); const toast = useToast();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e: string, p: string) => { setErr(''); setBusy(true); try { const u = await login(e, p); const from = (loc.state as any)?.from; nav(from && from.startsWith('/') ? from : homeFor(u.role), { replace: true }); } catch (x) { setErr(msg(x)); } finally { setBusy(false); } };
  const demo: [string, string][] = [['Student (Class 8)', 'meena@demo.kavli.local'], ['Parent', 'parent@demo.kavli.local'], ['Teacher', 'teacher@demo.kavli.local'], ['School admin', 'school@demo.kavli.local'], ['Platform admin', 'admin@demo.kavli.local']];
  return (
    <div className="authwrap"><Card className="authcard">
      <h1>Sign in</h1><p className="muted">Welcome back. <Bi en="" ta="மீண்டும் வருக" /></p>
      <form className="col" onSubmit={e => { e.preventDefault(); go(email, password); }} noValidate>
        <Field label="Email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
        <div className="field"><label htmlFor="pw">Password</label><div className="row" style={{ gap: 8 }}><input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required style={{ flex: 1 }} /><button type="button" className="btn secondary" onClick={() => setShow(s => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button></div></div>
        {err && <div className="notice err" role="alert"><Icon name="alert" />{err}</div>}
        <Button type="submit" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="small muted center">New here? <Link to="/signup" className="link">Create an account</Link></p>
      {config.demoAccounts && <div className="demobox"><div className="row"><Badge tone="warning">Development only</Badge><span className="small muted">Demo accounts (password <code>Demo@12345</code>). Hidden in production.</span></div>
        <div className="row wrap">{demo.map(([l, e]) => <button key={e} className="pill" disabled={busy} onClick={() => go(e, 'Demo@12345')}>{l}</button>)}</div></div>}
    </Card></div>
  );
}

export function SignUp() {
  const { register } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ role: 'student', displayName: '', email: '', password: '', consent: false, under13: false }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }));
  const rules = [['At least 8 characters', f.password.length >= 8], ['A letter', /[A-Za-z]/.test(f.password)], ['A number', /\d/.test(f.password)]] as const;
  const ok = f.displayName.trim() && /.+@.+\..+/.test(f.email) && rules.every(r => r[1]) && f.consent;
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setErr(''); setBusy(true); try { const d = await register(f); nav(d.needsProfile ? '/profile' : homeFor(f.role as any), { replace: true }); } catch (x) { setErr(msg(x)); } finally { setBusy(false); } };
  return (
    <div className="authwrap"><Card className="authcard">
      <h1>Create your account</h1>
      <form className="col" onSubmit={submit} noValidate>
        <div className="field"><label>I am a</label><div className="row wrap" role="radiogroup" aria-label="Account type">{[['student', 'Student'], ['parent', 'Parent / guardian']].map(([k, t]) => <button type="button" key={k} role="radio" aria-checked={f.role === k} className={`pill ${f.role === k ? 'on' : ''}`} onClick={() => set('role', k)}>{t}</button>)}</div></div>
        <Field label={f.role === 'student' ? 'Your name' : 'Your name'} value={f.displayName} onChange={e => set('displayName', e.target.value)} autoComplete="name" maxLength={60} required />
        <Field label="Email" type="email" value={f.email} onChange={e => set('email', e.target.value)} autoComplete="email" required hint={f.role === 'student' ? 'Use a parent’s email if you are under 13.' : undefined} />
        <div className="field"><label htmlFor="pw2">Password</label><div className="row" style={{ gap: 8 }}><input id="pw2" type={show ? 'text' : 'password'} value={f.password} onChange={e => set('password', e.target.value)} autoComplete="new-password" style={{ flex: 1 }} /><button type="button" className="btn secondary" onClick={() => setShow(s => !s)}>{show ? 'Hide' : 'Show'}</button></div>
          <ul className="rules">{rules.map(([t, v]) => <li key={t} className={v ? 'ok' : ''}>{v ? '✓' : '○'} {t}</li>)}</ul></div>
        {f.role === 'student' && <label className="check"><input type="checkbox" checked={f.under13} onChange={e => set('under13', e.target.checked)} /> I am under 13 (a parent or guardian must approve before I use the AI tutor)</label>}
        <label className="check"><input type="checkbox" checked={f.consent} onChange={e => set('consent', e.target.checked)} /> I agree to the <Link to="/terms" className="link" target="_blank">Terms</Link> and <Link to="/privacy" className="link" target="_blank">Privacy notice</Link>.</label>
        {err && <div className="notice err" role="alert"><Icon name="alert" />{err}</div>}
        <Button type="submit" disabled={busy || !ok}>{busy ? 'Creating…' : 'Create account'}</Button>
      </form>
      <p className="small muted center">Already registered? <Link to="/signin" className="link">Sign in</Link></p>
    </Card></div>
  );
}
