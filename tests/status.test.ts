import { describe, expect, it } from 'vitest';
import { client, DEMO, setup } from './helpers';
import { bootstrapProduction } from '../server/seed';
import { openDb, q } from '../server/db';
import { systemStatus } from '../server/services/status';

describe('live set-up checks', () => {
  it('is admin-only and reports each service without exposing secrets', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-secret-abc'; const ctx = await setup();
    const s = client(ctx.app); await s.login(DEMO.student); expect((await s.get('/api/admin/system')).status).toBe(403);
    const a = client(ctx.app); await a.login(DEMO.admin); const r = await a.get('/api/admin/system'); expect(r.status).toBe(200);
    expect(r.body.checks.map((c: any) => c.key)).toEqual(['database', 'storage', 'ocr', 'tutor', 'voice', 'demo', 'https']);
    expect(r.body.checks.find((c: any) => c.key === 'tutor').detail).toMatch(/AI model: anthropic/); expect(JSON.stringify(r.body)).not.toContain('sk-secret-abc');
    expect(r.body.content.lessons).toBeGreaterThan(0); delete process.env.ANTHROPIC_API_KEY;
  });
  it('a production start has no demo accounts but does have subjects, lessons and practice questions', async () => {
    const db = await openDb(':memory:'); await bootstrapProduction(db); await bootstrapProduction(db); // idempotent
    expect(Number((await q.get<any>(db, 'SELECT COUNT(*) n FROM users'))!.n)).toBe(0);
    const st = await systemStatus(db); expect(st.content.practiceQuestions).toBeGreaterThan(10); expect(st.content.lessons).toBeGreaterThan(0);
    const ids = await q.all<any>(db, "SELECT id FROM questions WHERE origin='practice'"); expect(new Set(ids.map((x: any) => x.id)).size).toBe(ids.length);
  });
});
