import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../../lib/http-error.js';
import { parseQueryParams, validateBody } from '../../lib/validate.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { adminArticlesQuerySchema } from '../article/article.schema.js';
import { listArticlesForAdmin } from '../article/article.service.js';
import { categoryNameSchema, type CategoryNameInput } from '../category/category.schema.js';
import {
  createCategory,
  deleteCategory,
  listForAdmin,
  renameCategory,
} from '../category/category.service.js';
import {
  updateUserStatusSchema,
  type UpdateUserStatusInput,
} from '../user/user.schema.js';
import { changeUserStatus, listUsers } from './admin.service.js';

export const adminRouter = Router();

// 整个 /admin 命名空间都必须先登录、再确认是管理员。
// 放在最前面统一挂载，避免某个路由漏加守卫。
adminRouter.use(requireAuth, requireAdmin);

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100, '每页最多 100 条').default(20),
});

function parseId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'INVALID_ID', 'id 不合法');
  }
  return id;
}

/** GET /api/v1/admin/categories —— 分类列表，附带每个分类下的文章数 */
adminRouter.get('/categories', async (_req, res) => {
  const categories = await listForAdmin();
  res.json({ categories });
});

/** POST /api/v1/admin/categories */
adminRouter.post('/categories', validateBody(categoryNameSchema), async (req, res) => {
  const category = await createCategory(req.body as CategoryNameInput);
  res.status(201).json({ category });
});

/** PATCH /api/v1/admin/categories/:id */
adminRouter.patch('/categories/:id', validateBody(categoryNameSchema), async (req, res) => {
  const category = await renameCategory(parseId(req.params.id), req.body as CategoryNameInput);
  res.json({ category });
});

/** DELETE /api/v1/admin/categories/:id —— 分类下有文章时返回 409 */
adminRouter.delete('/categories/:id', async (req, res) => {
  await deleteCategory(parseId(req.params.id));
  res.status(204).end();
});

/** GET /api/v1/admin/articles —— 全部文章，含草稿 */
adminRouter.get('/articles', async (req, res) => {
  const query = parseQueryParams(adminArticlesQuerySchema, req.query);
  const result = await listArticlesForAdmin(query);
  res.json(result);
});

/** GET /api/v1/admin/users —— 全部用户，附带文章数 */
adminRouter.get('/users', async (req, res) => {
  const query = parseQueryParams(paginationSchema, req.query);
  const result = await listUsers(query.page, query.pageSize);
  res.json(result);
});

/** PATCH /api/v1/admin/users/:id/status —— 禁用 / 恢复账号 */
adminRouter.patch('/users/:id/status', validateBody(updateUserStatusSchema), async (req, res) => {
  const input = req.body as UpdateUserStatusInput;
  const user = await changeUserStatus(req.user!, parseId(req.params.id), input.status);
  res.json({ user });
});
