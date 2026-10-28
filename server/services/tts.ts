import { createHash } from 'node:crypto';

/**
 * Text-to-speech provider seam. The server holds the API key; the browser only ever calls our own /voice/tts endpoint.
 * `httpTts` speaks the common "POST {model, input, voice, response_format} → audio bytes" shape (OpenAI-style and many
 * self-hosted servers such as a local GPU TTS service). Any other provider can implement `TtsProvider` instead.
 */
export type TtsLang = 'ta' | 'en';
export interface TtsProvider { name: string; synth(text: string, lang: TtsLang, signal: AbortSignal): Promise<{ audio: Buffer; mime: string }>; }
export class TtsError extends Error { name = 'TtsError'; constructor(m: string, public status = 502) { super(m); } }

export function httpTts(o: { url: string; apiKey?: string; model?: string; voiceEn?: string; voiceTa?: string; format?: string; timeoutMs?: number; name?: string }): TtsProvider {
  const format = o.format ?? 'mp3'; const mime = format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/ogg' : 'audio/mpeg'; const timeout = o.timeoutMs ?? 12000;
  return {
    name: o.name ?? 'http-tts',
    async synth(text, lang, signal) {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(new TtsError('The voice service took too long.', 504)), timeout); const onAbort = () => ac.abort(); signal.addEventListener('abort', onAbort);
      try {
        const res = await fetch(o.url, { method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json', ...(o.apiKey ? { authorization: `Bearer ${o.apiKey}` } : {}) },
          body: JSON.stringify({ model: o.model ?? 'tts', input: text, voice: (lang === 'ta' ? o.voiceTa : o.voiceEn) ?? 'alloy', response_format: format, language: lang }) });
        if (!res.ok) throw new TtsError(`The voice service responded with an error (${res.status}).`);
        const ct = res.headers.get('content-type') ?? ''; if (!/^audio\//i.test(ct)) throw new TtsError('The voice service did not return audio.');
        const buf = Buffer.from(await res.arrayBuffer()); if (!buf.length || buf.length > 6_000_000) throw new TtsError('The voice service returned an unusable audio file.');
        return { audio: buf, mime: ct.split(';')[0] || mime };
      } catch (e: any) {
        if (e instanceof TtsError) throw e; if (ac.signal.reason instanceof TtsError) throw ac.signal.reason; if (signal.aborted) throw new TtsError('Cancelled.', 499);
        throw new TtsError('Could not reach the voice service.');
      } finally { clearTimeout(t); signal.removeEventListener('abort', onAbort); }
    },
  };
}
/** Reads TTS_URL (+ TTS_API_KEY, TTS_MODEL, TTS_VOICE_EN, TTS_VOICE_TA, TTS_FORMAT, TTS_TIMEOUT_MS). No URL → null → browser voice only. */
export function ttsFromEnv(env = process.env): TtsProvider | null {
  if (!env.TTS_URL) return null; let host = 'tts'; try { host = new URL(env.TTS_URL).hostname; } catch { return null; }
  return httpTts({ url: env.TTS_URL, apiKey: env.TTS_API_KEY, model: env.TTS_MODEL, voiceEn: env.TTS_VOICE_EN, voiceTa: env.TTS_VOICE_TA, format: env.TTS_FORMAT, timeoutMs: Number(env.TTS_TIMEOUT_MS) || undefined, name: `tts:${host}` });
}
/** Small in-memory LRU so identical sentences (replays, repeated steps, other sessions) are generated once. Holds tutor text only. */
export class AudioLru {
  private m = new Map<string, { audio: Buffer; mime: string }>(); private bytes = 0;
  constructor(private maxBytes = 8_000_000, private maxItems = 80) {}
  static key(text: string, lang: string) { return createHash('sha1').update(`${lang}|${text}`).digest('hex'); }
  get(k: string) { const v = this.m.get(k); if (v) { this.m.delete(k); this.m.set(k, v); } return v; }
  set(k: string, v: { audio: Buffer; mime: string }) { if (v.audio.length > this.maxBytes) return; this.m.set(k, v); this.bytes += v.audio.length; while (this.m.size > this.maxItems || this.bytes > this.maxBytes) { const [ok, ov] = this.m.entries().next().value!; this.m.delete(ok); this.bytes -= ov.audio.length; } }
  get size() { return this.m.size; }
}
