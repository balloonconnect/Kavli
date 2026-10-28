import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Empty, Icon, Loading, PageTitle } from '../components/ui';
import { useAuth } from '../auth';
import { get, getCsrf, msg, post, api } from '../api';
import { PREVIEW } from '../preview';
import { previewTurn } from '../previewVoice';
import { VisualCard } from '../components/VisualCard';
import { canSimplify, Visual } from '../../shared/visuals';
import { canListen, canSpeak, hasVoice, recognize, Recognizer, Seg, Speaker, SpeechLang } from '../components/speech';

type Lang = 'ta' | 'en' | 'both';
type Mode = 'teach' | 'explain' | 'hint' | 'practice' | 'revise';
type Item = { id: string; role: 'student' | 'tutor'; kind: string; en: string; ta: string; say?: { en: string; ta: string }; step?: number | null; total?: number; math?: string[]; sources?: string[]; refs?: { bookId: string; page: number }[]; via?: string; visuals?: Visual[] };
type Status = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'error';
const MODES: [Mode, string, string][] = [['teach', 'Teach me', 'கற்றுக்கொடு'], ['explain', 'Explain fully', 'முழுமையாக விளக்கு'], ['hint', 'Give me a hint', 'குறிப்பு கொடு'], ['practice', 'Practice with me', 'என்னுடன் பயிற்சி'], ['revise', 'Revise this topic', 'இந்தப் பாடத்தைத் திருப்பு']];
const STATUS_TEXT: Record<Status, string> = { idle: 'Ready', connecting: 'Connecting…', listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…', paused: 'Paused', error: 'Something went wrong' };
const SUBJ: [string, string][] = [['', 'Any subject'], ['maths', 'Mathematics'], ['science', 'Science'], ['english', 'English'], ['social', 'Social Science'], ['tamil', 'Tamil']];
let seq = 0; const nid = () => `i${Date.now().toString(36)}${seq++}`;

/** SSE over fetch (EventSource cannot send a POST body or the CSRF header). Falls back to one JSON response. */
async function streamTurn(id: string, body: any, signal: AbortSignal, onEvent: (type: string, data: any) => void) {
  if (PREVIEW) { for await (const ev of previewTurn(body)) { if (signal.aborted) throw new DOMException('aborted', 'AbortError'); onEvent(ev.type, ev); } return; }
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'text/event-stream', 'x-csrf-token': getCsrf() };
  const res = await fetch(`/api/voice/sessions/${id}/turn`, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'same-origin', signal });
  if (!res.ok) { let m = 'Request failed.'; try { m = (await res.json()).error ?? m; } catch { /* ignore */ } const e: any = new Error(m); e.status = res.status; throw e; }
  if (!res.body) { const j = await res.json(); for (const ev of j.events) onEvent(ev.type, ev); onEvent('done', { type: 'done', state: j.state, meta: j.meta }); return; }
  const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i: number; while ((i = buf.indexOf('\n\n')) >= 0) { const raw = buf.slice(0, i); buf = buf.slice(i + 2); const type = /^event: (.*)$/m.exec(raw)?.[1] ?? 'message'; const data = /^data: (.*)$/m.exec(raw)?.[1]; if (data) onEvent(type, JSON.parse(data)); }
  }
}

function Visualizer({ status }: { status: Status }) {
  return <div className={`vt-viz ${status}`} aria-hidden="true"><span className="vt-face">{status === 'listening' ? '🎧' : status === 'thinking' ? '💭' : status === 'speaking' ? '🗣️' : '🎓'}</span>
    <div className="vt-bars">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 90}ms` }} />)}</div></div>;
}

export function VoiceTutor() {
  const { profile } = useAuth();
  const [curr, setCurr] = useState<any>(null); const [prior, setPrior] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<any>(null);
  // setup
  const [mode, setMode] = useState<Mode>('teach'); const [lang, setLang] = useState<Lang>((profile?.ai_lang as Lang) ?? 'both'); const [showBoth, setShowBoth] = useState(true);
  const [subject, setSubject] = useState(''); const [lesson, setLesson] = useState(''); const [save, setSave] = useState(true); const [lessons, setLessons] = useState<any[]>([]);
  // session
  const [ses, setSes] = useState<any>(null); const [items, setItems] = useState<Item[]>([]); const [status, setStatus] = useState<Status>('idle'); const [err, setErr] = useState('');
  const [voiceOn, setVoiceOn] = useState(false); const [mic, setMic] = useState<'unknown' | 'ok' | 'denied' | 'unsupported'>(canListen ? 'unknown' : 'unsupported');
  const [muted, setMuted] = useState(false); const [paused, setPaused] = useState(false); const [slow, setSlow] = useState(false); const [interim, setInterim] = useState(''); const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [text, setText] = useState(''); const [micLang, setMicLang] = useState<SpeechLang>('en'); const [notice, setNotice] = useState(''); const [lastMs, setLastMs] = useState<{ text?: number; audio?: number; full?: number } | null>(null);

  const R = useRef({ ses: null as any, lang, voiceOn: false, status: 'idle' as Status, muted: false, ac: null as AbortController | null, rec: null as Recognizer | null, micLang: 'en' as SpeechLang, streaming: false, last: null as any, t0: 0, tText: 0, tAudio: 0, sttMs: 0, retries: 0, showBoth: true });
  const speaker = useRef(new Speaker()).current;
  R.current.lang = lang; R.current.voiceOn = voiceOn; R.current.status = status; R.current.muted = muted; R.current.micLang = micLang; R.current.ses = ses; R.current.showBoth = showBoth;
  const setSt = (s: Status) => { R.current.status = s; setStatus(s); };
  const metric = (kind: string, ms: number) => { const s = R.current.ses; if (!s) return; post(`/voice/sessions/${s.id}/metrics`, { kind, ms: Math.max(0, Math.round(ms)) }).catch(() => {}); };

  // load config, previous sessions, lesson list
  useEffect(() => { (async () => {
    try { if (PREVIEW) { setCfg({ engine: { mock: true }, notes: 'UI preview demo: a small in-browser tutor that only walks through linear equations such as 3x + 5 = 20.' }); return; } const [c, l, cur] = await Promise.all([get('/voice/config'), get('/voice/sessions'), get('/curriculum')]); setCfg(c); setPrior(l.sessions.filter((s: any) => s.status === 'active')); setCurr(cur); }
    catch (e) { setErr(msg(e)); } finally { setLoading(false); }
  })(); return () => { speaker.cancel(); R.current.ac?.abort(); R.current.rec?.stop(); }; }, []); // eslint-disable-line
  useEffect(() => { if (!curr) return; setLessons(curr.subjects.filter((s: any) => !subject || s.id === subject).flatMap((s: any) => s.lessons.map((l: any) => ({ id: l.id, t: l.title_en, s: s.id })))); setLesson(''); }, [curr, subject]);
  useEffect(() => { setMicLang(lang === 'ta' ? 'ta' : 'en'); }, [lang]);
  useEffect(() => { speaker.rate = slow ? 0.75 : 1; }, [slow, speaker]); useEffect(() => { speaker.muted = muted; if (muted) speaker.cancel(); }, [muted, speaker]);
  const endRef = useRef<HTMLDivElement>(null); useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [items.length]);

  const segsFor = (it: Item): Seg[] => { const l = R.current.lang; const say = it.say ?? { en: it.en, ta: it.ta }; const out: Seg[] = [];
    if (l !== 'ta' && say.en) out.push({ id: it.id, text: say.en, lang: 'en' }); if (l !== 'en' && say.ta && say.ta !== say.en) { if (hasVoice('ta')) out.push({ id: it.id, text: say.ta, lang: 'ta' }); else setNotice('This device has no Tamil voice, so Tamil is shown as text only. English can still be spoken.'); } return out; };

  speaker.onStart = id => { setSpeakingId(id); setSt(R.current.status === 'paused' ? 'paused' : 'speaking'); };
  speaker.onFirstAudio = () => { if (R.current.tAudio === 0 && R.current.t0) { R.current.tAudio = performance.now() - R.current.t0; setLastMs(m => ({ ...m, audio: Math.round(R.current.tAudio) })); metric('first_audio', R.current.tAudio); } };
  speaker.onError = why => { setNotice(why); metric('tts_error', 0); };
  speaker.onIdle = () => { setSpeakingId(null); if (!R.current.streaming) afterTutor(); };
  const afterTutor = () => { if (R.current.status === 'error') return; setSt(R.current.voiceOn ? 'listening' : 'idle'); };

  const interrupt = useCallback((why: 'voice' | 'new') => {
    const was = R.current.status; speaker.cancel(); setSpeakingId(null); R.current.ac?.abort(); R.current.ac = null;
    if (why === 'voice' && (was === 'speaking' || was === 'thinking')) metric('interrupted', R.current.t0 ? performance.now() - R.current.t0 : 0);
  }, [speaker]); // eslint-disable-line

  const sendTurn = useCallback(async (body: { text?: string; action?: string }, via: 'voice' | 'text' = 'text', attempt = 0) => {
    const s = R.current.ses; if (!s) return; interrupt('new'); setErr(''); setInterim(''); setPaused(false);
    const label = body.text || (body.action ? ({ hint: 'Give me a hint', repeat: 'Please repeat', simpler: 'Explain more simply', next: 'Continue', summary: 'Summarise' } as any)[body.action] ?? body.action : '');
    if (attempt === 0 && !body.action?.startsWith('mode:')) setItems(x => [...x, { id: nid(), role: 'student', kind: via, en: label, ta: label, via }]);
    R.current.last = { body, via }; R.current.t0 = performance.now(); R.current.tText = 0; R.current.tAudio = 0; R.current.streaming = true; speaker.reset(); setSt('thinking'); setLastMs(null);
    const ac = new AbortController(); R.current.ac = ac; if (via === 'voice' && R.current.sttMs) { metric('stt', R.current.sttMs); }
    try {
      const turnIds: string[] = [];
      await streamTurn(s.id, { ...body, lang: R.current.lang, via }, ac.signal, (type, d) => {
        if (type === 'visual') { const id = turnIds[d.at]; if (id) setItems(x => x.map(i => i.id === id ? { ...i, visuals: d.visuals } : i)); }
        else if (type === 'chunk') {
          if (!R.current.tText) { R.current.tText = performance.now() - R.current.t0; setLastMs(m => ({ ...m, text: Math.round(R.current.tText) })); metric('first_text', R.current.tText); }
          const it: Item = { id: nid(), role: 'tutor', kind: d.kind, en: d.en, ta: d.ta, say: d.say, step: d.step ?? null, total: d.total, math: d.math, sources: d.sources, refs: d.refs };
          turnIds.push(it.id); setItems(x => [...x, it]); const segs = segsFor(it); if (segs.length) speaker.enqueue(segs); else setSpeakingId(it.id);
        } else if (type === 'done') { setSes((o: any) => ({ ...o, state: d.state, topic: d.state?.plan?.topic?.en ?? o.topic })); }
        else if (type === 'error') throw new Error(d.error);
      });
      const full = performance.now() - R.current.t0; setLastMs(m => ({ ...m, full: Math.round(full) })); metric('full', full); R.current.retries = 0;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (e?.status === 409 && attempt < 2) { await new Promise(r => setTimeout(r, 300)); return sendTurn(body, via, attempt + 1); }
      setSt('error'); setErr(e?.status ? msg(e) : navigator.onLine === false ? 'You are offline. Your lesson is saved — reconnect and press Try again.' : 'The connection dropped. Your lesson is saved — press Try again.'); metric('reconnect', 0);
    } finally { R.current.streaming = false; if (R.current.status === 'thinking') { speaker.speaking ? setSt('speaking') : afterTutor(); } else if (!speaker.speaking && R.current.status === 'speaking') afterTutor(); }
  }, [interrupt, speaker]); // eslint-disable-line

  // when the connection comes back, resend the last message automatically
  useEffect(() => { const on = () => { const l = R.current.last; if (R.current.status === 'error' && l) sendTurn(l.body, l.via); }; window.addEventListener('online', on); return () => window.removeEventListener('online', on); }, [sendTurn]);

  // microphone
  const stopMic = () => { R.current.rec?.stop(); R.current.rec = null; };
  const startMic = useCallback(() => {
    if (R.current.rec) return; if (!canListen) { setMic('unsupported'); return; }
    let n = 0; const go = () => {
      if (!R.current.voiceOn) return;
      R.current.rec = recognize({ lang: R.current.micLang,
        onSpeechStart: () => { setMic('ok'); if (R.current.status === 'speaking' || R.current.status === 'thinking') interrupt('voice'); if (R.current.status !== 'thinking') setSt('listening'); },
        onInterim: t => { setInterim(t); if (R.current.status === 'speaking') { interrupt('voice'); setSt('listening'); } },
        onFinal: (t, ms) => { n = 0; setInterim(''); if (t.trim()) { R.current.sttMs = ms; sendTurn({ text: t.trim() }, 'voice'); } },
        onError: c => { R.current.rec = null; if (c === 'not-allowed' || c === 'service-not-allowed') { setMic('denied'); setVoiceOn(false); R.current.voiceOn = false; setSt('idle'); setErr('The microphone is blocked. Allow it in your browser’s site settings (the lock icon beside the address), or type your question instead.'); } else if (c === 'no-speech' || c === 'aborted') { n++; } else if (c === 'network' || c === 'start-failed') { setVoiceOn(false); R.current.voiceOn = false; setSt('idle'); setErr('Voice input is not working right now. You can type instead.'); } },
        onEnd: () => { R.current.rec = null; if (R.current.voiceOn && n < 4) setTimeout(go, 250); else if (R.current.voiceOn) { setVoiceOn(false); R.current.voiceOn = false; setNotice('The microphone stopped because nothing was heard. Press “Start talking” to begin again.'); if (R.current.status === 'listening') setSt('idle'); } } });
      if (!R.current.rec) return; };
    go();
  }, [interrupt, sendTurn]);
  const toggleVoice = () => { if (voiceOn) { setVoiceOn(false); R.current.voiceOn = false; stopMic(); if (status === 'listening') setSt('idle'); } else { setErr(''); setVoiceOn(true); R.current.voiceOn = true; setSt(R.current.status === 'idle' ? 'listening' : R.current.status); startMic(); } };
  useEffect(() => { if (voiceOn) { stopMic(); setTimeout(startMic, 50); } }, [micLang]); // eslint-disable-line

  const begin = async (resume?: any) => {
    setErr(''); setSt('connecting');
    try {
      let s = resume; let turns: any[] = [];
      if (!s) s = (await post('/voice/sessions', { mode, lang, showBoth, subjectId: subject || undefined, lessonId: lesson || undefined, saveTranscript: save })).session;
      else { const d = await get(`/voice/sessions/${s.id}`); s = d.session; turns = d.turns; setLang(s.lang); setMode(s.mode); setShowBoth(s.showBoth); }
      R.current.ses = s; setSes(s); setItems(turns.map((t: any, i: number) => t.role === 'student' ? { id: nid(), role: 'student' as const, kind: t.kind, en: t.content.text, ta: t.content.text } : { id: nid(), role: 'tutor' as const, kind: t.kind, en: t.content.en, ta: t.content.ta, step: t.step, math: t.content.math, sources: t.content.sources, refs: t.content.refs, visuals: t.content.visuals }));
      setSt('idle');
      if (!resume && (lesson || mode === 'practice')) sendTurn({ text: mode === 'practice' ? 'start' : '' , action: mode === 'practice' ? undefined : 'mode:' + mode }, 'text');
    } catch (e) { setSt('error'); setErr(msg(e)); }
  };
  const end = async () => { interrupt('new'); stopMic(); setVoiceOn(false); R.current.voiceOn = false; const s = R.current.ses; setSes(null); R.current.ses = null; setSt('idle'); setInterim(''); if (s) { try { await post(`/voice/sessions/${s.id}/end`); } catch { /* ignore */ } } get('/voice/sessions').then(l => setPrior(l.sessions.filter((x: any) => x.status === 'active'))).catch(() => {}); };
  const wipe = async () => { const s = R.current.ses; if (!s || !confirm('Delete this lesson and its transcript from your account?')) return; await end(); try { await api('DELETE', `/voice/sessions/${s.id}`); setPrior(p => p.filter(x => x.id !== s.id)); } catch (e) { setErr(msg(e)); } };
  const switchMode = async (m: Mode) => { setMode(m); if (!ses) return; try { await api('PATCH', `/voice/sessions/${ses.id}`, { mode: m }); } catch { /* the turn below also sets it */ } sendTurn({ action: `mode:${m}`, text: m === 'practice' || m === 'revise' ? '' : '' }, 'text'); };
  const changeLang = async (l: Lang) => { setLang(l); R.current.lang = l; if (ses) api('PATCH', `/voice/sessions/${ses.id}`, { lang: l }).catch(() => {}); };
  const togglePause = () => { if (paused) { speaker.resume(); setPaused(false); if (speaker.speaking) setSt('speaking'); } else { speaker.pause(); setPaused(true); setSt('paused'); } };
  const replay = (it?: Item) => { const target = it ?? [...items].reverse().find(i => i.role === 'tutor' && i.kind === 'step') ?? [...items].reverse().find(i => i.role === 'tutor'); if (!target) return; interrupt('new'); setPaused(false); speaker.reset(); const segs = segsFor(target); if (segs.length) { setSt('speaking'); speaker.enqueue(segs); } };
  const retry = () => { const l = R.current.last; if (l) sendTurn(l.body, l.via); };
  const lastStep = [...items].reverse().find(i => i.role === 'tutor' && i.kind === 'step');
  const both = lang === 'both' || showBoth;

  if (loading) return <Loading />;
  const strictlyText = !canListen && !canSpeak;

  return (
    <div className="col vt">
      <PageTitle title="Voice tutor" sub="Talk or type. The tutor teaches one step at a time and checks that you understood." />
      {strictlyText && <div className="notice warn"><Icon name="alert" /><span>This browser cannot listen or speak. You can still type and read the lesson.</span></div>}
      {!ses ? (
        <div className="vt-setup">
          <Card className="col">
            <h2>Start a lesson</h2>
            <div className="grid g2">
              <div className="field"><label htmlFor="vt-class">Class</label><input id="vt-class" value={`Class ${profile?.class_level ?? 8}`} readOnly /></div>
              <div className="field"><label htmlFor="vt-lang">Language</label><select id="vt-lang" value={lang} onChange={e => setLang(e.target.value as Lang)}><option value="ta">தமிழ்</option><option value="en">English</option><option value="both">தமிழ் + English</option></select></div>
              <div className="field"><label htmlFor="vt-sub">Subject</label><select id="vt-sub" value={subject} onChange={e => setSubject(e.target.value)}>{SUBJ.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
              <div className="field"><label htmlFor="vt-les">Chapter / lesson</label><select id="vt-les" value={lesson} onChange={e => setLesson(e.target.value)}><option value="">Not chosen — I will ask a question</option>{lessons.map(l => <option key={l.id} value={l.id}>{l.t}</option>)}</select></div>
            </div>
            <div className="field"><span className="lbl">How should we learn?</span><div className="chips" role="group" aria-label="Teaching mode">{MODES.map(([k, en, ta]) => <button key={k} className={`pill ${mode === k ? 'on' : ''}`} aria-pressed={mode === k} onClick={() => setMode(k)}>{en} <span className="ta" lang="ta">· {ta}</span></button>)}</div></div>
            <label className="check"><input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} /> Save the transcript so I can continue later</label>
            <p className="muted small">{cfg?.notes} {save ? 'Your lesson and transcript are kept in your account; you can delete them any time.' : 'Nothing you say is saved. Only your progress is.'}</p>
            <div className="row wrap"><Button onClick={() => begin()} disabled={status === 'connecting'}><Icon name="mic" /> {status === 'connecting' ? 'Connecting…' : 'Start conversation'}</Button></div>
            {err && <div className="notice err" role="alert"><Icon name="alert" /><span>{err}</span></div>}
          </Card>
          {!!prior.length && <Card className="col"><h2>Continue a previous lesson</h2>{prior.slice(0, 4).map(p => <div key={p.id} className="row wrap listrow"><div className="grow"><b>{p.topic ?? 'Voice lesson'}</b><div className="muted small">{p.mode} · {p.lang} · {new Date(p.updatedAt).toLocaleString()}</div></div><Button tone="secondary" onClick={() => begin(p)}>Continue</Button></div>)}</Card>}
          <Card className="col"><h2>What to expect</h2><ul className="small"><li>Voice uses your browser’s speech recognition and speech synthesis. Android Chrome and desktop Chrome/Edge work best; iPhone Safari may only support typing.</li><li>The tutor answers only from your class lessons, your class books, or by solving an equation — and says which. If it has no verified source it tells you instead of guessing.</li><li>Use headphones so the tutor does not hear itself.</li></ul></Card>
        </div>
      ) : (
        <div className="vt-grid">
          <Card className="col vt-stage">
            <div><Badge tone={cfg?.engine?.mock ? 'warning' : 'info'}>{PREVIEW ? 'UI preview demo — in-browser, not the real tutor' : cfg?.engine?.mock ? 'Rule-based tutor — no AI model connected' : 'AI tutor'}</Badge></div>
            <Visualizer status={status} />
            <div className="vt-status" role="status" aria-live="polite"><b>{STATUS_TEXT[status]}</b>{interim && <span className="muted"> “{interim}”</span>}</div>
            <div className="muted small">Class {profile?.class_level ?? 8} · {ses.topic ?? 'Ask a question to begin'}</div>
            {lastStep && lastStep.total ? <div className="vt-steps" aria-label={`Step ${(lastStep.step ?? 0) + 1} of ${lastStep.total}`}>{Array.from({ length: lastStep.total }, (_, i) => <i key={i} className={i < (lastStep.step ?? 0) ? 'done' : i === lastStep.step ? 'now' : ''} />)}</div> : null}
            <div className="row wrap vt-main">
              <Button onClick={toggleVoice} disabled={mic === 'unsupported' || mic === 'denied'} aria-pressed={voiceOn}><Icon name="mic" /> {voiceOn ? 'Stop talking' : 'Start talking'}</Button>
              <Button tone="secondary" onClick={togglePause} disabled={!speaker.speaking && !paused}>{paused ? 'Resume' : 'Pause'}</Button>
              <Button tone="secondary" onClick={() => setMuted(m => !m)} aria-pressed={muted}><Icon name="volume" /> {muted ? 'Unmute' : 'Mute'}</Button>
            </div>
            {mic === 'unsupported' && <p className="muted small">Voice input is not available in this browser. Type your answer below.</p>}
            {mic === 'denied' && <p className="small" style={{ color: 'var(--danger)' }}>Microphone blocked. Allow it in your browser’s site settings, then reload this page.</p>}
            <div className="row wrap vt-acts" role="group" aria-label="Tutor actions">
              <button className="pill" onClick={() => sendTurn({ action: 'hint' })}>Hint</button><button className="pill" onClick={() => sendTurn({ action: 'repeat' })}>Repeat</button><button className="pill" onClick={() => replay()}>Replay step</button>
              <button className="pill" onClick={() => sendTurn({ action: 'simpler' })}>Explain simply</button><button className="pill" onClick={() => setSlow(s => !s)} aria-pressed={slow}>Slower speech</button><button className="pill" onClick={() => sendTurn({ action: 'next' })}>Continue</button>
            </div>
            <details className="vt-more" open={typeof window !== 'undefined' && window.innerWidth > 900}><summary>Mode, language &amp; options</summary><div className="col">
            <div className="field"><span className="lbl">Mode</span><div className="chips" role="group" aria-label="Teaching mode">{MODES.map(([k, en]) => <button key={k} className={`pill ${mode === k ? 'on' : ''}`} aria-pressed={mode === k} onClick={() => switchMode(k)}>{en}</button>)}</div></div>
            <div className="grid g2">
              <div className="field"><label htmlFor="vt-l2">Tutor language</label><select id="vt-l2" value={lang} onChange={e => changeLang(e.target.value as Lang)}><option value="ta">தமிழ்</option><option value="en">English</option><option value="both">தமிழ் + English</option></select></div>
              <div className="field"><label htmlFor="vt-ml">I will speak in</label><select id="vt-ml" value={micLang} onChange={e => setMicLang(e.target.value as SpeechLang)}><option value="en">English</option><option value="ta">தமிழ்</option></select></div>
            </div>
            <label className="check"><input type="checkbox" checked={showBoth} onChange={e => { setShowBoth(e.target.checked); if (ses) api('PATCH', `/voice/sessions/${ses.id}`, { showBoth: e.target.checked }).catch(() => {}); }} /> Show both languages on screen</label>
            {lastMs && <p className="muted small" aria-label="Measured response times">Last answer: first text {lastMs.text ?? '…'} ms · first voice {lastMs.audio ?? '…'} ms · complete {lastMs.full ?? '…'} ms</p>}
            </div></details>
            <div className="row wrap"><Button tone="ghost" onClick={end}>End conversation</Button><Button tone="ghost" onClick={wipe}>Delete this lesson</Button></div>
          </Card>
          <Card className="col vt-chat">
            <div className="row wrap"><h2 className="grow" style={{ margin: 0 }}>Transcript</h2><button className="pill" onClick={async () => { try { await navigator.clipboard.writeText(items.map(i => `${i.role === 'student' ? 'Me' : 'Tutor'}: ${i.en}${i.ta !== i.en && both ? '\n' + i.ta : ''}`).join('\n\n')); setNotice('Transcript copied.'); } catch { setNotice('Could not copy on this device.'); } }}>Copy transcript</button></div>
            {notice && <div className="notice info" role="status"><Icon name="check" /><span>{notice}</span><button className="link" onClick={() => setNotice('')}>Dismiss</button></div>}
            {err && <div className="notice err" role="alert"><Icon name="alert" /><span>{err}</span>{status === 'error' && R.current.last && <button className="link" onClick={retry}>Try again</button>}</div>}
            <div className="vt-log" aria-label="Conversation">
              {!items.length && <p className="muted">Ask a question — for example “Solve 3x + 5 = 20”, or “What is an equation?” — or choose a chapter and press “Continue”.</p>}
              {items.map(it => it.role === 'student'
                ? <div key={it.id} className="vt-me"><div className="bubble">{it.en}</div><span className="muted small">{it.via === 'voice' ? 'spoken' : 'typed'}</span></div>
                : <div key={it.id} className={`vt-tutor ${it.kind} ${speakingId === it.id ? 'speaking' : ''}`} aria-current={speakingId === it.id ? 'true' : undefined}>
                  <div className="vt-k">{({ step: 'Step', check: 'Check', feedback: 'Feedback', hint: 'Hint', info: 'Tutor', question: 'Question', summary: 'Summary', notice: 'Note' } as any)[it.kind] ?? 'Tutor'}{speakingId === it.id && <span className="vt-sp"> · speaking</span>}<button className="vt-rep" aria-label="Replay this" onClick={() => replay(it)}><Icon name="volume" size={14} /></button></div>
                  {(lang !== 'ta' || both) && <div className="mtext">{it.en}</div>}{(lang !== 'en' || both) && it.ta !== it.en && <div className="mtext ta" lang="ta">{it.ta}</div>}
                  {!!it.math?.length && <div className="vt-math" aria-label="Equations">{it.math.map((m, k) => <code key={k}>{m}</code>)}</div>}
                  {it.visuals?.map(v => <VisualCard key={`${it.id}-${v.key.id}-${v.key.hl ?? ''}-${v.key.lvl ?? ''}-${v.key.p ?? ''}`} v={v} lng={lang} canSimple={canSimplify(v.key.id)} onAsk={t => sendTurn({ text: t }, 'text')} />)}
                  {!!it.sources?.length && <div className="srcs"><b>Source:</b> {it.sources.join(' · ')}</div>}
                  {!!it.refs?.length && <div className="chips">{[...new Map(it.refs.map(r => [`${r.bookId}-${r.page}`, r])).values()].map(r => <Link key={`${r.bookId}-${r.page}`} className="pill" to={`/app/textbook/${r.bookId}?page=${r.page}`} target="_blank" rel="noreferrer">Open book, page {r.page}</Link>)}</div>}
                </div>)}
              {status === 'thinking' && <div className="vt-tutor thinking" aria-hidden="true"><span className="dots"><i /><i /><i /></span></div>}
              <div ref={endRef} />
            </div>
            <form className="row vt-form" onSubmit={e => { e.preventDefault(); const t = text.trim(); if (!t) return; setText(''); sendTurn({ text: t }, 'text'); }}>
              <div className="field grow"><label className="sr" htmlFor="vt-text">Type your question or answer</label><input id="vt-text" value={text} onChange={e => setText(e.target.value)} maxLength={1000} placeholder="Type here — or press Start talking" autoComplete="off" /></div>
              <Button type="submit" disabled={!text.trim()}><Icon name="send" /> Send</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
