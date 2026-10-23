/**
 * TiDB Cloud（或任意 MySQL 兼容库）兼容性探测。
 *
 * 目的：在把项目迁过去之前，先确认我们依赖的几个特性它在不支持。
 * 全部探测都在 `_probe_` 前缀的临时表里做，结束时删掉，不碰业务表。
 *
 * 用法：
 *   1. 在 server/.env.tidb 里填连接信息（见下面 ENV 说明）
 *   2. cd server && node scripts/probe-tidb.mjs
 *
 * ENV 需要的键：
 *   DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME（DB_SSL 默认 true）
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

const envPath = path.resolve(process.cwd(), '.env.tidb');
loadEnvFile(envPath);

const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 4000),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: (process.env.DB_SSL ?? 'true') === 'true' ? { rejectUnauthorized: true } : undefined,
  connectTimeout: 15000,
};

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function tryQuery(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

async function main() {
  console.log(`连接 ${config.host}:${config.port} / ${config.database} ...`);
  const conn = await mysql.createConnection(config);

  try {
    const [versionRow] = await tryQuery(conn, 'SELECT VERSION() AS v');
    record('连接成功', true, `版本 ${versionRow.v}`);

    // 1. 排序规则：我们的建表脚本硬编码了 utf8mb4_0900_ai_ci
    for (const collation of ['utf8mb4_0900_ai_ci', 'utf8mb4_unicode_ci', 'utf8mb4_general_ci']) {
      try {
        await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_collation');
        await tryQuery(
          conn,
          `CREATE TABLE _probe_collation (id INT PRIMARY KEY, name VARCHAR(20))
           DEFAULT CHARSET=utf8mb4 COLLATE=${collation}`,
        );
        record(`排序规则 ${collation}`, true);
        await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_collation');
      } catch (err) {
        record(`排序规则 ${collation}`, false, err.message.slice(0, 120));
      }
    }

    // 2. 外键 RESTRICT：分类删除防线的最后一道闸
    try {
      // 顺序很重要：子表先删，父表才能删（上一轮失败时可能留下 _probe_child2）
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_child2');
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_child');
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_parent');
      await tryQuery(conn, 'CREATE TABLE _probe_parent (id INT PRIMARY KEY, name VARCHAR(20)) ENGINE=InnoDB');
      await tryQuery(
        conn,
        `CREATE TABLE _probe_child (
           id INT PRIMARY KEY,
           parent_id INT NOT NULL,
           CONSTRAINT fk_probe FOREIGN KEY (parent_id) REFERENCES _probe_parent(id) ON DELETE RESTRICT
         ) ENGINE=InnoDB`,
      );
      await tryQuery(conn, 'INSERT INTO _probe_parent (id, name) VALUES (1, "p")');
      await tryQuery(conn, 'INSERT INTO _probe_child (id, parent_id) VALUES (1, 1)');

      let blocked = false;
      let code = '';
      try {
        await tryQuery(conn, 'DELETE FROM _probe_parent WHERE id = 1');
      } catch (err) {
        blocked = true;
        code = err.code ?? '';
      }
      record('外键 ON DELETE RESTRICT 真的拦截删除', blocked, blocked ? `错误码 ${code}` : '删除竟然成功了，防线不存在');

      // 级联删除：删文章时标签关联要自动清掉。
      // 用另一条父记录（id=2）来测，避开上面那条被 RESTRICT 子表挡住的记录。
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_child2');
      await tryQuery(
        conn,
        `CREATE TABLE _probe_child2 (
           id INT PRIMARY KEY,
           parent_id INT NOT NULL,
           CONSTRAINT fk_probe2 FOREIGN KEY (parent_id) REFERENCES _probe_parent(id) ON DELETE CASCADE
         ) ENGINE=InnoDB`,
      );
      await tryQuery(conn, 'INSERT INTO _probe_parent (id, name) VALUES (2, "p2")');
      await tryQuery(conn, 'INSERT INTO _probe_child2 (id, parent_id) VALUES (2, 2)');
      await tryQuery(conn, 'DELETE FROM _probe_parent WHERE id = 2');
      const left = await tryQuery(conn, 'SELECT COUNT(*) AS n FROM _probe_child2');
      record('外键 ON DELETE CASCADE 真的级联', Number(left[0].n) === 0, `剩余 ${left[0].n} 行`);

      // 清理：子表先删，父表才能删
      await tryQuery(conn, 'DROP TABLE _probe_child2');
      await tryQuery(conn, 'DROP TABLE _probe_child');
      await tryQuery(conn, 'DROP TABLE _probe_parent');
    } catch (err) {
      record('外键探测', false, err.message.slice(0, 160));
    }

    // 3. ENUM：文章类型、状态都用它
    try {
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_enum');
      await tryQuery(
        conn,
        `CREATE TABLE _probe_enum (id INT PRIMARY KEY, t ENUM('tech','life') NOT NULL)`,
      );
      await tryQuery(conn, 'INSERT INTO _probe_enum (id, t) VALUES (1, "tech")');
      let rejected = false;
      try {
        await tryQuery(conn, 'INSERT INTO _probe_enum (id, t) VALUES (2, "other")');
      } catch {
        rejected = true;
      }
      record('ENUM 拒绝非法值', rejected, rejected ? '非法值被拒' : '非法值被接受了');
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_enum');
    } catch (err) {
      record('ENUM 探测', false, err.message.slice(0, 160));
    }

    // 4. 标签 upsert 依赖的两个写法
    try {
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_tags');
      await tryQuery(
        conn,
        'CREATE TABLE _probe_tags (id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(30) UNIQUE)',
      );
      await tryQuery(
        conn,
        'INSERT INTO _probe_tags (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
        ['a'],
      );
      const first = await tryQuery(conn, 'SELECT id FROM _probe_tags WHERE name = "a"');
      await tryQuery(
        conn,
        'INSERT INTO _probe_tags (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
        ['a'],
      );
      record('LAST_INSERT_ID(id) 取已有 id', true, `id=${first[0]?.id}`);

      await tryQuery(conn, 'INSERT INTO _probe_tags (name) VALUES (?) AS new ON DUPLICATE KEY UPDATE name = new.name', ['b']);
      record('ON DUPLICATE KEY UPDATE ... AS new 语法', true);
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_tags');
    } catch (err) {
      record('upsert 语法探测', false, err.message.slice(0, 160));
    }

    // 5. 降序索引
    try {
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_idx');
      await tryQuery(conn, 'CREATE TABLE _probe_idx (status VARCHAR(20), published_at DATETIME)');
      await tryQuery(conn, 'CREATE INDEX idx_probe ON _probe_idx (status, published_at DESC)');
      record('降序索引 (a, b DESC)', true);
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_idx');
    } catch (err) {
      record('降序索引 (a, b DESC)', false, err.message.slice(0, 160));
    }

    // 6. DATETIME 默认值与 ON UPDATE
    try {
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_time');
      await tryQuery(
        conn,
        `CREATE TABLE _probe_time (
           id INT PRIMARY KEY,
           created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
         )`,
      );
      await tryQuery(conn, 'INSERT INTO _probe_time (id) VALUES (1)');
      const rows = await tryQuery(conn, 'SELECT created_at, updated_at FROM _probe_time WHERE id = 1');
      record('DATETIME 默认 CURRENT_TIMESTAMP', Boolean(rows[0]?.created_at), String(rows[0]?.created_at));
      await tryQuery(conn, 'DROP TABLE IF EXISTS _probe_time');
    } catch (err) {
      record('DATETIME 默认值探测', false, err.message.slice(0, 160));
    }

    // 7. 会话时区设置（我们靠它保证写进去的是 UTC）
    try {
      await tryQuery(conn, "SET time_zone = '+00:00'");
      const rows = await tryQuery(conn, "SELECT NOW() AS now_utc, @@session.time_zone AS tz");
      record('SET time_zone 生效', rows[0].tz === '+00:00' || rows[0].tz === 'UTC', `tz=${rows[0].tz} now=${rows[0].now_utc}`);
    } catch (err) {
      record('SET time_zone', false, err.message.slice(0, 160));
    }
  } finally {
    await conn.end();
  }

  const failed = results.filter((item) => !item.ok);
  console.log('\n===== 汇总 =====');
  console.log(`通过 ${results.length - failed.length} / ${results.length}`);
  if (failed.length > 0) {
    console.log('不通过的项：');
    for (const item of failed) console.log(`- ${item.name}: ${item.detail}`);
  }
}

main().catch((err) => {
  console.error('探测失败：', err.message);
  process.exitCode = 1;
});
