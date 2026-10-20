import express from 'express';
import helmet from 'helmet';

import { config } from './config.js';
import { pool } from './db.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();

// 一组安全响应头（隐藏 X-Powered-By、限制 MIME 嗅探等）
app.use(helmet());

// 限制请求体大小，防止超大 JSON 把内存打满
app.use(express.json({ limit: '256kb' }));

/**
 * 健康检查：顺带执行一次 SELECT 1。
 * 它同时验证了三件事：HTTP 服务活着、.env 的数据库配置对、数据库连得上。
 *
 * Express 5 会自动捕获 async 函数里抛出的错误并交给 errorHandler，
 * 所以这里不需要 try/catch。
 */
app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1 AS ok');
  res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
});

// 404 与错误处理必须挂在所有路由之后
app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  console.log(`[server] API 已启动：http://127.0.0.1:${config.PORT}/api/health`);
});

/**
 * 收到 Ctrl+C 时先关 HTTP 服务、再关连接池，让正在处理的请求有机会完成。
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`[server] 收到 ${signal}，正在关闭…`);
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
