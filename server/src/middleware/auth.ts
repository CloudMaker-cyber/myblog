import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/http-error.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { findUserById } from '../modules/user/user.repository.js';
import type { AuthUser } from '../modules/user/user.types.js';

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * 把一张票换成"当前用户"。做四件事，缺一不可：
 *
 * 1. 验签名 —— 票是不是我们签的、过期没有；
 * 2. 查数据库 —— 拿用户当前的 status / role / token_version；
 * 3. 比对 token_version —— 退出登录或封号后，旧票立刻作废；
 * 4. 检查 status —— 被禁用的账号即使票还没过期，也不能操作。
 */
async function resolveUser(token: string): Promise<AuthUser> {
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

  return user;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readBearerToken(req);
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', '请先登录');
    }

    req.user = await resolveUser(token);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 可选登录：有票就识别身份，没票或票无效也放行。
 * 用在"已发布文章任何人能看、草稿只有作者能看"这类接口上。
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.user = await resolveUser(token);
  } catch {
    // 身份不认，就当访客处理；真正的权限判断交给路由层
  }
  next();
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
