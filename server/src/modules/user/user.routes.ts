import { Router } from 'express';

import { validateBody } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { registerSchema, type RegisterInput } from './user.schema.js';
import { register } from './user.service.js';
import { toSelfUser } from './user.types.js';

export const userRouter = Router();

/** POST /api/v1/users —— 注册（创建用户资源） */
userRouter.post('/', authLimiter, validateBody(registerSchema), async (req, res) => {
  const result = await register(req.body as RegisterInput);
  res.status(201).json(result);
});

/** GET /api/v1/users/me —— 当前登录用户 */
userRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toSelfUser(req.user!) });
});
