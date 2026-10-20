import type { ErrorRequestHandler, Request, Response } from 'express';

import { AppError } from '../lib/http-error.js';

/**
 * 没命中任何路由时走到这里。
 * 返回 JSON 而不是 Express 默认的 HTML 页面，前端只需要一套解析逻辑。
 */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `接口不存在：${req.method} ${req.originalUrl}`,
      details: [],
    },
  });
}

/**
 * 全局错误出口。必须声明 4 个参数，Express 靠参数个数识别"这是错误中间件"。
 *
 * 原则：服务端日志留全量信息（栈、SQL 报错），给客户端的只给裁剪过的内容，
 * 否则数据库表名、字段名、甚至 SQL 语句都会顺着报错泄露出去。
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  /**
   * express.json() 解析失败时抛的是带 type 的 SyntaxError。
   * 这属于"客户端发错了"，必须返回 400 而不是 500——
   * 500 会被监控当成服务端故障，也会让前端误以为是我们的问题。
   */
  const bodyError = err as { type?: string };
  if (bodyError.type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: '请求体不是合法的 JSON', details: [] },
    });
    return;
  }
  if (bodyError.type === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: '请求体过大', details: [] },
    });
    return;
  }

  console.error('[error]', err);

  const isProduction = process.env.NODE_ENV === 'production';
  const message = err instanceof Error ? err.message : '服务器内部错误';

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? '服务器内部错误' : message,
      details: [],
    },
  });
};
