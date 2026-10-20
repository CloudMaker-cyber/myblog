import { Router } from 'express';

import { validateBody } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { loginSchema, type LoginInput } from '../user/user.schema.js';
import { login, logout } from './session.service.js';

export const sessionRouter = Router();

/** POST /api/v1/sessions —— 登录（创建会话） */
sessionRouter.post('/', authLimiter, validateBody(loginSchema), async (req, res) => {
  const result = await login(req.body as LoginInput);
  res.status(200).json(result);
});

/** DELETE /api/v1/sessions/current —— 退出（销毁当前会话） */
sessionRouter.delete('/current', requireAuth, async (req, res) => {
  await logout(req.user!.id);
  res.status(204).end();
});
