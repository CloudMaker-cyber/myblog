import type { ErrorRequestHandler, Request, Response } from 'express';

/**
 * 没命中任何路由时走到这里。
 */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `接口不存在：${req.method} ${req.originalUrl}`,
  });
}

/**
 * 全局错误出口。必须声明 4 个参数，Express 靠参数个数识别"这是错误中间件"。
 *
 * 原则：服务端日志留全量信息（栈、SQL 报错），给客户端的只给裁剪过的内容，
 * 否则数据库表名、字段名、甚至 SQL 语句都会顺着报错泄露出去。
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[error]', err);

  const isProduction = process.env.NODE_ENV === 'production';
  const message = err instanceof Error ? err.message : '服务器内部错误';

  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: isProduction ? '服务器内部错误' : message,
  });
};
