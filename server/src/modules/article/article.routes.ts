import { Router } from 'express';

import { AppError } from '../../lib/http-error.js';
import { parseQueryParams, validateBody } from '../../lib/validate.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import {
  createArticleSchema,
  listArticlesQuerySchema,
  updateArticleSchema,
  type CreateArticleInput,
  type UpdateArticleInput,
} from './article.schema.js';
import {
  createArticle,
  deleteArticle,
  getArticle,
  listMyArticles,
  listPublicArticles,
  updateArticle,
} from './article.service.js';
import type { ArticleStatus } from './article.types.js';

export const articleRouter = Router();

function parseId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'INVALID_ID', '文章 id 不合法');
  }
  return id;
}

/** GET /api/v1/articles —— 公开列表（分页 + 类型 + 分类 + 标题搜索 + 作者） */
articleRouter.get('/', async (req, res) => {
  const query = parseQueryParams(listArticlesQuerySchema, req.query);
  const result = await listPublicArticles(query);
  res.json(result);
});

/** POST /api/v1/articles —— 新建文章（草稿或直接发布） */
articleRouter.post('/', requireAuth, validateBody(createArticleSchema), async (req, res) => {
  const article = await createArticle(req.user!, req.body as CreateArticleInput);
  res.status(201).json({ article });
});

/**
 * GET /api/v1/articles/mine —— 我的文章
 * 必须排在 /:id 之前，否则 "mine" 会被当成 id。
 */
articleRouter.get('/mine', requireAuth, async (req, res) => {
  const raw = req.query.status;
  let status: ArticleStatus | undefined;

  if (raw !== undefined) {
    if (raw !== 'draft' && raw !== 'published') {
      throw new AppError(400, 'VALIDATION_FAILED', 'status 只能是 draft 或 published');
    }
    status = raw;
  }

  const articles = await listMyArticles(req.user!.id, status);
  res.json({ articles });
});

/** GET /api/v1/articles/:id —— 已发布文章公开；草稿仅作者与管理员可见 */
articleRouter.get('/:id', optionalAuth, async (req, res) => {
  const article = await getArticle(parseId(req.params.id), req.user);
  res.json({ article });
});

/** PATCH /api/v1/articles/:id —— 部分更新 */
articleRouter.patch('/:id', requireAuth, validateBody(updateArticleSchema), async (req, res) => {
  const article = await updateArticle(req.user!, parseId(req.params.id), req.body as UpdateArticleInput);
  res.json({ article });
});

/** DELETE /api/v1/articles/:id —— 作者或管理员 */
articleRouter.delete('/:id', requireAuth, async (req, res) => {
  await deleteArticle(req.user!, parseId(req.params.id));
  res.status(204).end();
});
