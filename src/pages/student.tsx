import { Button, Card, Icon, PageTitle } from '../components/ui';
import { Bi } from '../components/lang';
import { useAuth } from '../auth';

export function Dashboard() {
  const { user } = useAuth();
  const hr = Number(new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const hello = hr < 12 ? ['Good morning', 'காலை வணக்கம்'] : hr < 17 ? ['Good afternoon', 'மதிய வணக்கம்'] : ['Good evening', 'மாலை வணக்கம்'];
  const name = user?.display_name ?? '';
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
