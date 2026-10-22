import { openDatabase } from './database.ts';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const baseUrl = (process.env.BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, '');
const parsedBaseUrl = new URL(baseUrl);
if (!['http:', 'https:'].includes(parsedBaseUrl.protocol) || parsedBaseUrl.search || parsedBaseUrl.hash) {
  throw new Error('BASE_URL deve ser uma URL HTTP ou HTTPS sem query ou fragmento.');
}
const db = openDatabase(process.env.DATABASE_PATH ?? './data/database.sqlite');
const server = createApp(db, baseUrl).listen(port, () => console.log(`API disponível em ${baseUrl}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => { db.close(); }));
}
