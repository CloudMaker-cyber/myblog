import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

import { AppError } from './http-error.js';

/**
 * 请求体校验中间件。
 * 校验通过后把 req.body 替换成"经过 zod 清洗后的数据"，
 * 这样后续代码拿到的字段类型是确定的，多余的字段也已经被丢掉（防批量赋值）。
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(body)',
        message: issue.message,
      }));
      next(new AppError(400, 'VALIDATION_FAILED', '请求参数有误', details));
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * 查询参数的校验。
 *
 * 不用中间件是因为 Express 5 把 req.query 改成了只读的 getter，
 * 想"校验后再写回去"会报错。所以直接在路由里取校验结果用。
 */
export function parseQueryParams<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(query)',
      message: issue.message,
    }));
    throw new AppError(400, 'VALIDATION_FAILED', '查询参数有误', details);
  }

  return result.data;
}
