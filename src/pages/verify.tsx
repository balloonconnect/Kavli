import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Icon } from '../components/ui';
import { certificates } from '../data/demo';

export function Verify() {
  const params = useParams(); const [ref, setRef] = useState(params.ref ?? ''); const [q, setQ] = useState(params.ref ?? '');
  const c = certificates.find(x => x.ref === q.trim()); // TODO: GET /verify/:ref — return minimal fields only
  const ok = c?.status === 'Valid';
  return (
    <div style={{ maxWidth: 640, margin: '48px auto', padding: 16 }} className="col">
      <h1 className="center">Verify a certificate</h1>
      <p className="muted center">Enter the reference number printed on the certificate or scan its QR code.</p>
      <form className="row" onSubmit={e => { e.preventDefault(); setQ(ref); }}>
        <input className="search grow" style={{ width: 'auto', border: '1px solid var(--border)' }} aria-label="Reference number" value={ref} onChange={e => setRef(e.target.value)} placeholder="KM-2026-WT-000417" /><Button>Verify</Button>
      </form>
      {q && (c ? (
        <Card className="col" ><div className="row"><div className="iconbox" style={{ background: ok ? 'var(--success)' : 'var(--danger)', color: '#fff', borderRadius: 99 }}><Icon name={ok ? 'check' : 'x'} /></div>
          <div><h2 style={{ color: ok ? 'var(--success)' : 'var(--danger)' }}>{ok ? 'Valid certificate' : 'This certificate has been revoked'}</h2><p className="muted small">{ok ? 'Issued by AI Learning Platform and currently valid.' : 'It is no longer valid. Contact the issuing platform for details.'}</p></div></div>
          <table className="tbl"><tbody>
            <tr><td className="muted">Certificate</td><td>Weekly Test Achievement</td></tr><tr><td className="muted">Test</td><td>{c.title}</td></tr>
            {ok && <tr><td className="muted">Student</td><td>Meenakshi K.</td></tr>}<tr><td className="muted">Reference</td><td>{c.ref}</td></tr>
          </tbody></table>
          <p className="xs muted">Only minimal details are shown — no contact details, marks or school. Platform-issued, not an official board certificate.</p></Card>
      ) : <div className="card center muted" role="alert">No certificate found for “{q}”. Check the reference and try again.</div>)}
    </div>
  );
}
