import { Router } from 'express';

import { AppError } from '../../lib/http-error.js';
import { parseQueryParams, validateBody } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { listArticlesQuerySchema } from '../article/article.schema.js';
import { listPublicArticles } from '../article/article.service.js';
import { registerSchema, updateProfileSchema, type RegisterInput, type UpdateProfileInput } from './user.schema.js';
import { findUserById } from './user.repository.js';
import { register, updateProfile } from './user.service.js';
import { toPublicUser, toSelfUser } from './user.types.js';

export const userRouter = Router();

function parseUserId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'INVALID_ID', '用户 id 不合法');
  }
  return id;
}

/** POST /api/v1/users —— 注册（创建用户资源） */
userRouter.post('/', authLimiter, validateBody(registerSchema), async (req, res) => {
  const result = await register(req.body as RegisterInput);
  res.status(201).json(result);
});

/** GET /api/v1/users/me —— 当前登录用户（必须排在 /:id 之前） */
userRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toSelfUser(req.user!) });
});

/** PATCH /api/v1/users/me —— 修改头像与简介 */
userRouter.patch('/me', requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  const user = await updateProfile(req.user!, req.body as UpdateProfileInput);
  res.json({ user });
});

/** GET /api/v1/users/:id —— 作者公开资料，不含邮箱 */
userRouter.get('/:id', async (req, res) => {
  const user = await findUserById(parseUserId(req.params.id));
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
  }
  res.json({ user: toPublicUser(user) });
});

/** GET /api/v1/users/:id/articles —— 该作者的已发布文章 */
userRouter.get('/:id/articles', async (req, res) => {
  const authorId = parseUserId(req.params.id);

  const user = await findUserById(authorId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
  }

  const query = parseQueryParams(listArticlesQuerySchema, req.query);
  const result = await listPublicArticles({ ...query, authorId });
  res.json(result);
});
