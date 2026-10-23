import path from 'node:path';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

function loadEnvFile(file) {
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    if (!(key in process.env)) process.env[key] = line.slice(index + 1).trim();
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.tidb'));

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true },
});

const [rows] = await conn.query(
  'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM articles) AS articles, (SELECT COUNT(*) FROM categories) AS categories, @@hostname AS host',
);
console.log(JSON.stringify(rows[0]));

const [list] = await conn.query('SELECT id, title, author_id FROM articles ORDER BY id DESC LIMIT 5');
console.log(JSON.stringify(list));

await conn.end();
