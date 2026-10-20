import express from 'express';
import helmet from 'helmet';

import { pool } from './db.js';
import { errorHandler, notFound } from './middleware/error.js';
import { sessionRouter } from './modules/session/session.routes.js';
import { userRouter } from './modules/user/user.routes.js';

/**
 * 只负责"组装"，不负责"启动"。
 * 分开的好处是以后写接口测试时可以只拿 app，不用真的占端口。
 */
export function createApp() {
  const app = express();

  // 一组安全响应头（隐藏 X-Powered-By、限制 MIME 嗅探等）
  app.use(helmet());

  // 限制请求体大小，防止超大 JSON 把内存打满
  app.use(express.json({ limit: '256kb' }));

  /**
   * 健康检查：顺带执行一次 SELECT 1，
   * 同时验证 HTTP 服务活着、.env 的数据库配置对、数据库连得上。
   */
  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
  });

  // 业务路由：按资源挂载，新增模块只需要在这里加一行
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/sessions', sessionRouter);

  // 404 与错误处理必须挂在所有路由之后
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
