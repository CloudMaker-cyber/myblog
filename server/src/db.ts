import type { ExecuteValues, RowDataPacket } from 'mysql2';
import { createPool } from 'mysql2/promise';

import { config } from './config.js';

/**
 * 连接池：进程启动时创建，复用连接。
 * 不要每次请求都 createConnection，那会在高并发下把数据库连接数打满。
 *
 * dateStrings: true —— 让 DATETIME 以字符串形式返回。
 * 否则 mysql2 会把它转成 JS Date，再按进程时区做一次换算，
 * 前端显示的时间可能莫名差 8 小时。
 */
export const pool = createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

/**
 * 统一的查询入口。
 * 所有 SQL 都走参数化占位符 ?，绝不把用户输入拼进字符串——这是防 SQL 注入的根本。
 */
export async function query<T extends RowDataPacket[]>(
  sql: string,
  params: ExecuteValues[] = [],
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}
