/**
 * UI-preview mode (VITE_UI_PREVIEW=1): a browser-only stand-in for the API so the UI flow can be reviewed
 * without a backend. Nothing here is real: one fixed demo login, canned tutor replies, data kept in this
 * browser tab only. It is switched off by default and must not be used in production.
 */
export const PREVIEW = import.meta.env.VITE_UI_PREVIEW === '1';
export const PREVIEW_LOGIN = { username: 'vikikalvi', password: 'demo@12345' };

class PErr extends Error { constructor(public status: number, m: string) { super(m); } }
const USER = { id: 'u-preview', email: 'vikikalvi@preview.local', display_name: 'Viki', role: 'student', school_id: null };
const PROFILE = { full_name: 'Viki', preferred_name: 'Viki', class_level: 8, medium: 'English', voice_prefs: { rate: 1 } };
const ACTIONS: Record<string, { en: string; ta: string }> = {
  simpler: { en: 'Explain simply', ta: 'எளிமையாக விளக்கு' }, steps: { en: 'Solve step by step', ta: 'படிப்படியாகத் தீர்' },
  hint: { en: 'Give a hint', ta: 'குறிப்பு கொடு' }, another: { en: 'Show another example', ta: 'இன்னொரு எடுத்துக்காட்டு' },
};
type St = { signedIn: boolean; convs: any[]; msgs: Record<string, any[]> };
const mem: St = { signedIn: false, convs: [], msgs: {} };
const load = (): St => { try { const s = sessionStorage.getItem('kavli_preview'); return s ? JSON.parse(s) : mem; } catch { return mem; } };
const save = (s: St) => { try { sessionStorage.setItem('kavli_preview', JSON.stringify(s)); } catch { Object.assign(mem, s); } };
const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

function reply(text: string, action?: string) {
  const t = text.toLowerCase().replace(/\s+/g, '');
  const m = t.match(/^(?:solve)?(-?\d*\.?\d*)x([+-]\d+\.?\d*)?=(-?\d+\.?\d*)$/);
  let en: string, ta: string;
  if (m) {
    const a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]); const b = Number(m[2] ?? 0); const c = Number(m[3]);
    if (a === 0) { en = 'The coefficient of x is 0, so this is not a linear equation in x.'; ta = 'x இன் கெழு 0 என்பதால் இது x இல் நேரியல் சமன்பாடு அல்ல.'; }
    else { const x = (c - b) / a; const x4 = Math.round(x * 1e4) / 1e4;
      en = `Let’s solve it step by step.\n1. Start with ${text.replace(/^solve\s*/i, '')}\n2. Move the constant: ${a}x = ${c - b}\n3. Divide both sides by ${a}: x = ${x4}\n4. Check by putting x = ${x4} back.`;
      ta = `படிப்படியாகத் தீர்ப்போம்.\n1. சமன்பாட்டை எழுதுங்கள்\n2. மாறிலியை நகர்த்துங்கள்: ${a}x = ${c - b}\n3. இரு பக்கமும் ${a} ஆல் வகுக்கவும்: x = ${x4}\n4. x = ${x4} ஐ மீண்டும் இட்டுச் சரிபார்க்கவும்.`; }
  } else if (/^(hi|hello|vanakkam|வணக்கம்)/i.test(text.trim())) { en = 'Hello! Ask me a question, or type an equation like 2x + 3 = 11.'; ta = 'வணக்கம்! ஒரு கேள்வி கேளுங்கள், அல்லது 2x + 3 = 11 போன்ற சமன்பாட்டை உள்ளிடுங்கள்.'; }
  else { en = `This is a UI preview, so I can only solve simple equations like 2x + 3 = 11. You asked${action ? ` (“${ACTIONS[action]?.en ?? action}”)` : ''}: “${text}”.`; ta = `இது UI முன்னோட்டம் மட்டுமே; 2x + 3 = 11 போன்ற எளிய சமன்பாடுகளை மட்டுமே தீர்க்க முடியும்.`; }
  return { en, ta };
}

export async function previewApi(method: string, url: string, body: any): Promise<any> {
  const s = load(); const path = url.split('?')[0];
  if (path === '/config') return { production: false, demoAccounts: true, aiProvider: 'ui-preview', aiIsMock: true, ocrAvailable: false, preview: true };
  if (path === '/auth/me') return s.signedIn ? { user: USER, profile: PROFILE, needsProfile: false, csrf: 'preview' } : { user: null };
  if (path === '/auth/login') {
    const u = String(body?.email ?? '').trim().toLowerCase();
    if (u !== PREVIEW_LOGIN.username || body?.password !== PREVIEW_LOGIN.password) throw new PErr(401, 'Email or password is incorrect.');
    s.signedIn = true; save(s); return { user: USER, csrf: 'preview' };
  }
  if (path === '/auth/logout') { s.signedIn = false; save(s); return { ok: true }; }
  if (!s.signedIn) throw new PErr(401, 'Please sign in.');
  if (path === '/notifications') return { notifications: [], unread: 0 };
  if (path === '/notifications/read' || path === '/bookmarks') return { ok: true };
  if (path === '/tutor/conversations') {
    if (method === 'GET') return { conversations: [...s.convs].reverse(), provider: { name: 'ui-preview', mock: true }, actions: ACTIONS };
    const c = { id: id(), title: body?.title ?? 'New conversation', created_at: now() }; s.convs.push(c); s.msgs[c.id] = []; save(s); return { conversation: c };
  }
  const mm = path.match(/^\/tutor\/conversations\/([^/]+)(\/messages)?$/);
  if (mm) {
    const c = s.convs.find(x => x.id === mm[1]); if (!c) throw new PErr(404, 'Conversation not found.');
    if (!mm[2]) { s.convs = s.convs.filter(x => x.id !== c.id); delete s.msgs[c.id]; save(s); return { ok: true }; }
    if (method === 'GET') return { conversation: c, messages: s.msgs[c.id] };
    const text = String(body?.text ?? ''); const u = { id: id(), role: 'user', content: { en: text, ta: text }, meta: {}, created_at: now() };
    const a = { id: id(), role: 'assistant', content: reply(text, body?.action), meta: { mock: true, provider: 'ui-preview', suggestions: ['steps', 'hint', 'another'] }, created_at: now() };
    s.msgs[c.id].push(u, a); if (c.title === 'New conversation' && text) c.title = text.slice(0, 60); save(s); return { messages: [u, a] };
  }
  if (path.startsWith('/tutor/messages/')) return { ok: true };
  throw new PErr(404, 'Not available in UI preview.');
}
export { PErr };
