import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/http-error.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { findUserById } from '../modules/user/user.repository.js';

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * 认证中间件，做四件事，缺一不可：
 *
 * 1. 验签名 —— 票是不是我们签的、过期没有；
 * 2. 查数据库 —— 拿用户当前的 status / role / token_version；
 * 3. 比对 token_version —— 退出登录或封号后，旧票立刻作废；
 * 4. 检查 status —— 被禁用的账号即使票还没过期，也不能操作。
 *
 * 只做第 1 步是很多教程的写法，代价是"退出登录"在服务端根本不生效，
 * 被禁用的人还能继续发文 7 天。
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readBearerToken(req);
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', '请先登录');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, 'TOKEN_INVALID', '登录状态已失效，请重新登录');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(401, 'TOKEN_INVALID', '登录状态已失效，请重新登录');
    }

    const user = await findUserById(userId);
    if (!user) {
      throw new AppError(401, 'TOKEN_INVALID', '登录状态已失效，请重新登录');
    }
    if (user.token_version !== payload.ver) {
      throw new AppError(401, 'TOKEN_REVOKED', '登录状态已失效，请重新登录');
    }
    if (user.status === 'disabled') {
      throw new AppError(403, 'ACCOUNT_DISABLED', '该账号已被禁用');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError(401, 'UNAUTHORIZED', '请先登录'));
    return;
  }
  if (req.user.role !== 'admin') {
    next(new AppError(403, 'FORBIDDEN', '需要管理员权限'));
    return;
  }
  next();
}
