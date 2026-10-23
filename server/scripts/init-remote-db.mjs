/**
 * 在远程 MySQL 兼容库（这里是 TiDB Cloud Starter）上建库并执行迁移脚本。
 *
 * 用法：cd server && node scripts/init-remote-db.mjs
 * 读取 server/.env.tidb。
 */
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
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.tidb'));

const base = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 4000),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: (process.env.DB_SSL ?? 'true') === 'true' ? { rejectUnauthorized: true } : undefined,
  connectTimeout: 15000,
  multipleStatements: true,
};

const dbName = process.env.DB_NAME ?? 'myblog';

async function main() {
  console.log(`连接 ${base.host}:${base.port} ...`);

  // 1. 建库。TiDB 可能不支持 0900 排序规则，失败就退回 general_ci
  const root = await mysql.createConnection(base);
  try {
    try {
      await root.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
      );
      console.log(`建库成功：${dbName}（utf8mb4_0900_ai_ci）`);
    } catch (err) {
      console.log(`0900 排序规则不可用（${err.code}），退回 utf8mb4_general_ci`);
      await root.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
      );
      console.log(`建库成功：${dbName}（utf8mb4_general_ci）`);
    }
  } finally {
    await root.end();
  }

  // 2. 按顺序执行迁移脚本
  const db = await mysql.createConnection({ ...base, database: dbName });
  try {
    const files = ['001_init.sql', '002_seed_categories.sql', '003_add_show_toc.sql'];
    for (const file of files) {
      const sql = readFileSync(path.resolve(process.cwd(), 'sql', file), 'utf8');
      try {
        await db.query(sql);
        console.log(`执行 ${file} ✅`);
      } catch (err) {
        console.log(`执行 ${file} ❌ ${err.code ?? ''} ${err.message.slice(0, 200)}`);
      }
    }

    const [tables] = await db.query(
      `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [dbName],
    );
    console.log('表清单：', tables.map((row) => row.name).join(', '));
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('失败：', err.message);
  process.exitCode = 1;
});
