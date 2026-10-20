import type { AuthUser } from '../modules/user/user.types.js';

/**
 * 给 Express 的 Request 增加 user 字段。
 * 这样中间件里 `req.user = ...`、路由里 `req.user!.id` 都有类型，不需要到处断言。
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
