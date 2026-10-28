import { Button, Card, Icon, PageTitle } from '../components/ui';
import { Bi } from '../components/lang';
import { useAuth } from '../auth';

export function Dashboard() {
  const { user } = useAuth();
  const hr = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const hello = hr < 12 ? ['Good morning', 'காலை வணக்கம்'] : hr < 17 ? ['Good afternoon', 'மதிய வணக்கம்'] : ['Good evening', 'மாலை வணக்கம்'];
  const name = user?.display_name ?? '';
  if (user && user.role !== 'student') return <Holding role={user.role} name={name} />;
  return (
    <div className="col" style={{ gap: 20 }}>
      <PageTitle title={<Bi en={`${hello[0]}, ${name}`} ta={`${hello[1]}, ${name}`} block />} sub="Your study dashboard" />
      <Card className="col">
        <div className="row"><Icon name="chat" /><h2 className="grow">AI Tutor</h2></div>
        <p className="muted">Ask questions about your Samacheer Kalvi lessons in Tamil or English. The tutor labels itself clearly: until an AI model is connected, it is a rule-based development tutor and not a real AI model.</p>
        <div><Button to="/app/tutor">Open the AI tutor</Button></div>
      </Card>
    </div>
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
