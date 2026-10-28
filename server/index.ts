import { openDb } from './db';
import { seed } from './seed';
import { createApp } from './app';

const db = openDb();
if (process.env.SEED_DEMO !== '0') await seed(db);
const port = Number(process.env.PORT ?? 3001);
createApp(db).listen(port, () => console.log(`Kavli API listening on http://localhost:${port}`));
