import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

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
