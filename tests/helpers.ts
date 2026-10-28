import request from 'supertest';
import { openDb } from '../server/db';
import { seed, DEMO_PASSWORD } from '../server/seed';
import { createApp } from '../server/app';
import { clock } from '../server/clock';

process.env.DISABLE_RATE_LIMIT = '1';
export async function setup(o: { voiceEngine?: any; voiceMax?: number; voiceQueueMs?: number; voiceVisuals?: any; voiceTts?: any } = {}) {
  clock.reset();
  const db = openDb(':memory:'); await seed(db); const app = createApp(db, { serveStatic: false, ...o });
  return { db, app };
}
export type Client = ReturnType<typeof client>;
/** A cookie-keeping API client that attaches the CSRF token automatically. */
export function client(app: any) {
  const agent = request.agent(app); let csrf = '';
  const w = (m: 'post' | 'put' | 'patch' | 'delete') => (url: string, body?: any) => { const r = (agent as any)[m](url); if (csrf) r.set('x-csrf-token', csrf); return body === undefined ? r : r.send(body); };
  return {
    agent, get: (url: string) => agent.get(url), post: w('post'), put: w('put'), patch: w('patch'), del: w('delete'),
    async login(email: string, password = DEMO_PASSWORD) { const r = await agent.post('/api/auth/login').send({ email, password }); if (r.status === 200) csrf = r.body.csrf; return r; },
    async register(body: any) { const r = await agent.post('/api/auth/register').send(body); if (r.status === 201) csrf = r.body.csrf; return r; },
  };
}
export const DEMO = { student: 'meena@demo.kavli.local', parent: 'parent@demo.kavli.local', teacher: 'teacher@demo.kavli.local', school: 'school@demo.kavli.local', admin: 'admin@demo.kavli.local', arun: 'arun@demo.kavli.local' };
export const profileBody = (o: any = {}) => ({ fullName: 'Test Student', classLevel: 8, medium: 'English', aiLang: 'both', academicYear: '2026–2027', subjects: ['maths', 'science'], goals: ['understand'], ...o });
