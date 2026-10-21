import { AppError } from '../../lib/http-error.js';
import { withTransaction } from '../../db.js';
import { tagSimilarity } from '../../lib/tag-similarity.js';
import type { AuthUser } from '../user/user.types.js';
import { findCategoryById } from '../category/category.repository.js';
import {
  countAllArticles,
  countPublishedArticles,
  countPublishedByTags,
  deleteArticleRow,
  findArticleById,
  incrementViewCount,
  insertArticle,
  listAllArticles,
  listAllTags,
  listArticlesByAuthor,
  listPublishedArticles,
  listPublishedByTags,
  replaceArticleTags,
  updateArticleRow,
} from './article.repository.js';
import type { CreateArticleInput, UpdateArticleInput } from './article.schema.js';
import type { ArticleDetail, ArticleStatus, ArticleSummary } from './article.types.js';

function nowSql(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

/** 去空、去重、最多 8 个；标签是作者自由填写的，只做必要的收拢 */
function normalizeTags(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(name);
  }

  return result.slice(0, 8);
}

async function assertCategoryExists(categoryId: number): Promise<void> {
  const category = await findCategoryById(categoryId);
  if (!category) {
    throw new AppError(400, 'CATEGORY_NOT_FOUND', '所选分类不存在');
  }
}

export async function createArticle(
  user: AuthUser,
  input: CreateArticleInput,
): Promise<ArticleDetail> {
  await assertCategoryExists(input.categoryId);

  const tags = normalizeTags(input.tags);
  const publishedAt = input.status === 'published' ? nowSql() : null;

  const articleId = await withTransaction(async (conn) => {
    const id = await insertArticle(conn, {
      authorId: user.id,
      categoryId: input.categoryId,
      title: input.title,
      content: input.content,
      type: input.type,
      coverUrl: input.coverUrl ?? null,
      showToc: input.showToc,
      status: input.status,
      publishedAt,
    });

    await replaceArticleTags(conn, id, tags);
    return id;
  });

  const article = await findArticleById(articleId);
  if (!article) {
    throw new AppError(500, 'INTERNAL_ERROR', '文章创建后读取失败');
  }
  return article;
}

export async function updateArticle(
  user: AuthUser,
  articleId: number,
  input: UpdateArticleInput,
): Promise<ArticleDetail> {
  const existing = await findArticleById(articleId);
  if (!existing) {
    throw new AppError(404, 'ARTICLE_NOT_FOUND', '文章不存在');
  }
  if (existing.author.id !== user.id) {
    throw new AppError(403, 'FORBIDDEN', '只能编辑自己的文章');
  }

  if (input.categoryId !== undefined) {
    await assertCategoryExists(input.categoryId);
  }

  const nextStatus: ArticleStatus = input.status ?? existing.status;
  // 发布时间只在"第一次发布"时写入；已发布文章再编辑不动它
  const publishedAt = existing.published_at ?? (nextStatus === 'published' ? nowSql() : null);

  await withTransaction(async (conn) => {
    await updateArticleRow(conn, articleId, {
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      type: input.type ?? existing.type,
      categoryId: input.categoryId ?? existing.category.id,
      coverUrl: input.coverUrl === undefined ? existing.cover_url : (input.coverUrl ?? null),
      showToc: input.showToc ?? existing.show_toc,
      status: nextStatus,
      publishedAt,
    });

    // 只有明确传了 tags 才动标签；不传表示"保持原样"
    if (input.tags !== undefined) {
      await replaceArticleTags(conn, articleId, normalizeTags(input.tags));
    }
  });

  const updated = await findArticleById(articleId);
  if (!updated) {
    throw new AppError(500, 'INTERNAL_ERROR', '文章更新后读取失败');
  }
  return updated;
}

/**
 * 草稿对外一律返回 404，而不是 403。
 * 403 等于告诉别人"这篇文章存在，只是你看不到"，等于泄露了草稿的存在。
 */
export async function getArticle(
  articleId: number,
  viewer?: AuthUser,
): Promise<ArticleDetail> {
  const article = await findArticleById(articleId);
  if (!article) {
    throw new AppError(404, 'ARTICLE_NOT_FOUND', '文章不存在');
  }

  if (article.status === 'draft') {
    const isOwner = viewer?.id === article.author.id;
    const isAdmin = viewer?.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError(404, 'ARTICLE_NOT_FOUND', '文章不存在');
    }
  } else {
    // 每次浏览详情 +1（PRD 要求；第一版不做防刷）
    await incrementViewCount(article.id);
    article.view_count += 1;
  }

  return article;
}

export async function listMyArticles(
  userId: number,
  status?: ArticleStatus,
): Promise<ArticleSummary[]> {
  return listArticlesByAuthor(userId, status);
}

export type PublicListParams = {
  page: number;
  pageSize: number;
  type?: ArticleSummary['type'];
  categoryId?: number;
  authorId?: number;
  q?: string;
  tag?: string;
};

export type PagedArticles = {
  articles: ArticleSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

/** 公开列表：只返回已发布文章，草稿永远不进这里 */
export async function listPublicArticles(params: PublicListParams): Promise<PagedArticles> {
  const filters = {
    type: params.type,
    categoryId: params.categoryId,
    authorId: params.authorId,
    q: params.q,
  };

  let articles: ArticleSummary[] = [];
  let total = 0;

  if (params.tag) {
    /**
     * 标签检索：先算出"每个标签跟目标标签有多像"，再按相关度排序。
     *
     * 相似度在 Node 里算，是因为 MySQL 没有字符串相似度函数；
     * 标签总量很小（几十到几百），一次全取出来算完全够用。
     */
    const allTags = await listAllTags();
    const weights = allTags
      .map((tag) => ({ id: tag.id, weight: tagSimilarity(params.tag ?? '', tag.name) }))
      .filter((item) => item.weight > 0);

    if (weights.length > 0) {
      [articles, total] = await Promise.all([
        listPublishedByTags(filters, weights, params.page, params.pageSize),
        countPublishedByTags(filters, weights),
      ]);
    }
  } else {
    [articles, total] = await Promise.all([
      listPublishedArticles(filters, params.page, params.pageSize),
      countPublishedArticles(filters),
    ]);
  }

  return {
    articles,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export type AdminListParams = {
  page: number;
  pageSize: number;
  status?: ArticleStatus;
  type?: ArticleSummary['type'];
  q?: string;
};

/** 管理员视角：所有作者、所有状态的文章 */
export async function listArticlesForAdmin(params: AdminListParams): Promise<PagedArticles> {
  const filters = { status: params.status, type: params.type, q: params.q };

  const [articles, total] = await Promise.all([
    listAllArticles(filters, params.page, params.pageSize),
    countAllArticles(filters),
  ]);

  return {
    articles,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

/** 作者可以删自己的；管理员可以删任何人的（PRD：删除违规或异常文章） */export async function deleteArticle(user: AuthUser, articleId: number): Promise<void> {
  const existing = await findArticleById(articleId);
  if (!existing) {
    throw new AppError(404, 'ARTICLE_NOT_FOUND', '文章不存在');
  }

  const isOwner = existing.author.id === user.id;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError(403, 'FORBIDDEN', '只能删除自己的文章');
  }

  await deleteArticleRow(articleId);
}
