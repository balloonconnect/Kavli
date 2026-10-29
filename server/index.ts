import { openDb } from './db';
import { upsertTextbookLessons } from './curriculum';
import { seed, bootstrapProduction } from './seed';
import { createApp } from './app';
import { resumeOcr } from './services/textbookIngest';
import { llmClientFromEnv, llmEngine } from './services/llmEngine';

const db = await openDb();
if (process.env.SEED_DEMO !== '0') await seed(db); else await bootstrapProduction(db);
await upsertTextbookLessons(db);
const resumed = await resumeOcr(db); if (resumed) console.log(`Resuming OCR for ${resumed} textbook(s)`);
const port = Number(process.env.PORT ?? 3001);
const llm = llmClientFromEnv();
const app = createApp(db, llm ? { voiceEngine: llmEngine(llm) } : {});
app.listen(port, () => console.log(`Karkai AI API listening on http://localhost:${port} — tutor: ${llm ? llm.name : 'rule-based (no model configured)'}`));
