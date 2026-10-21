import { Router } from 'express';

import { listCategories } from './category.repository.js';

export const categoryRouter = Router();

/** GET /api/v1/categories —— 分类是公开数据，未登录也能读 */
categoryRouter.get('/', async (_req, res) => {
  const categories = await listCategories();
  res.json({ categories });
});
