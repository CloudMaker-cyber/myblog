import type { ExecuteValues, ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

import { execute, query } from '../../db.js';
import type { ArticleDetail, ArticleStatus, ArticleSummary } from './article.types.js';

type Ctx = PoolConnection | undefined;

type ArticleRow = RowDataPacket & {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  type: ArticleSummary['type'];
  status: ArticleStatus;
  cover_url: string | null;
  show_toc: number;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: number;
  author_username: string;
  category_id: number;
  category_name: string;
};

const ARTICLE_COLUMNS = `
  a.id, a.title, a.content, SUBSTRING(a.content, 1, 180) AS excerpt,
  a.type, a.status, a.cover_url, a.show_toc, a.view_count,
  a.published_at, a.created_at, a.updated_at,
  a.author_id, u.username AS author_username,
  a.category_id, c.name AS category_name
`;

const ARTICLE_JOINS = `
  FROM articles a
  JOIN users u ON u.id = a.author_id
  JOIN categories c ON c.id = a.category_id
`;

async function x(ctx: Ctx, sql: string, params: ExecuteValues[] = []): Promise<ResultSetHeader> {
  if (!ctx) return execute(sql, params);
  const [result] = await ctx.execute<ResultSetHeader>(sql, params);
  return result;
}

export type ArticleFilters = {
  type?: ArticleSummary['type'];
  categoryId?: number;
  authorId?: number;
  q?: string;
};

/** LIKE 里的 % 和 _ 是通配符，用户输入的这两个字符要转义，否则搜 "100%" 会匹配到一切 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function buildPublishedWhere(filters: ArticleFilters): { clause: string; params: ExecuteValues[] } {
  const conditions = ["a.status = 'published'"];
  const params: ExecuteValues[] = [];

  if (filters.type) {
    conditions.push('a.type = ?');
    params.push(filters.type);
  }
  if (filters.categoryId !== undefined) {
    conditions.push('a.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.authorId !== undefined) {
    conditions.push('a.author_id = ?');
    params.push(filters.authorId);
  }
  if (filters.q) {
    conditions.push("a.title LIKE ? ESCAPE '\\\\'");
    params.push(`%${escapeLike(filters.q)}%`);
  }

  return { clause: `WHERE ${conditions.join(' AND ')}`, params };
}

export type AdminArticleFilters = {
  status?: ArticleStatus;
  type?: ArticleSummary['type'];
  q?: string;
};

/**
 * 管理员的文章列表：不过滤状态，草稿也看得到。
 * 与公开列表分开写，是为了让"公开 = 只读已发布"这条规则不被一个可选参数绕过去。
 */
function buildAdminWhere(filters: AdminArticleFilters): { clause: string; params: ExecuteValues[] } {
  const conditions: string[] = [];
  const params: ExecuteValues[] = [];

  if (filters.status) {
    conditions.push('a.status = ?');
    params.push(filters.status);
  }
  if (filters.type) {
    conditions.push('a.type = ?');
    params.push(filters.type);
  }
  if (filters.q) {
    conditions.push("a.title LIKE ? ESCAPE '\\\\'");
    params.push(`%${escapeLike(filters.q)}%`);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export async function listAllArticles(
  filters: AdminArticleFilters,
  page: number,
  pageSize: number,
): Promise<ArticleSummary[]> {
  const { clause, params } = buildAdminWhere(filters);
  const offset = (page - 1) * pageSize;

  const rows = await query<ArticleRow[]>(
    `SELECT ${ARTICLE_COLUMNS} ${ARTICLE_JOINS} ${clause}
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const tagsByArticle = await loadTagsFor(rows.map((row) => row.id));
  return rows.map((row) => toSummary(row, tagsByArticle.get(row.id) ?? []));
}

export async function countAllArticles(filters: AdminArticleFilters): Promise<number> {
  const { clause, params } = buildAdminWhere(filters);
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM articles a ${clause}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

export type TagWeight = { id: number; weight: number };

export async function listAllTags(): Promise<{ id: number; name: string }[]> {
  const rows = await query<(RowDataPacket & { id: number; name: string })[]>(
    'SELECT id, name FROM tags ORDER BY id ASC',
  );
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

/**
 * 把"标签权重表"拼成一个临时派生表，供 SQL 关联。
 * 权重由 Node 算好再传进来（MySQL 没有字符串相似度函数），
 * 但仍然全部走占位符，不把数值拼进 SQL 文本。
 */
function buildWeightTable(weights: TagWeight[]): { sql: string; params: ExecuteValues[] } {
  const selects: string[] = [];
  const params: ExecuteValues[] = [];

  weights.forEach((item, index) => {
    selects.push(index === 0 ? 'SELECT ? AS tag_id, ? AS weight' : 'SELECT ?, ?');
    params.push(item.id, item.weight);
  });

  return { sql: selects.join(' UNION ALL '), params };
}

/**
 * 按标签相关度查文章。
 *
 * 每个候选标签有一个权重（1 = 完全相同，0.5~0.9 = 包含关系，更低 = 拼写接近），
 * 一篇文章的相关度取它命中的候选标签里**最高**的那个权重（MAX，不是求和），
 * 这样分数始终在 0~1 之间，也便于解释"为什么这篇排在前面"。
 */
export async function listPublishedByTags(
  filters: ArticleFilters,
  weights: TagWeight[],
  page: number,
  pageSize: number,
): Promise<ArticleSummary[]> {
  const { clause, params } = buildPublishedWhere(filters);
  const weightTable = buildWeightTable(weights);
  const offset = (page - 1) * pageSize;

  const rows = await query<ArticleRow[]>(
    `SELECT ${ARTICLE_COLUMNS}
     ${ARTICLE_JOINS}
     JOIN (
       SELECT atg.article_id, MAX(m.weight) AS score
         FROM article_tags atg
         JOIN (${weightTable.sql}) m ON m.tag_id = atg.tag_id
        GROUP BY atg.article_id
     ) s ON s.article_id = a.id
     ${clause}
     ORDER BY s.score DESC, a.published_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [...weightTable.params, ...params, pageSize, offset],
  );

  const tagsByArticle = await loadTagsFor(rows.map((row) => row.id));
  return rows.map((row) => toSummary(row, tagsByArticle.get(row.id) ?? []));
}

export async function countPublishedByTags(
  filters: ArticleFilters,
  weights: TagWeight[],
): Promise<number> {
  const { clause, params } = buildPublishedWhere(filters);
  const weightTable = buildWeightTable(weights);

  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total
       FROM articles a
       JOIN (
         SELECT atg.article_id
           FROM article_tags atg
           JOIN (${weightTable.sql}) m ON m.tag_id = atg.tag_id
          GROUP BY atg.article_id
       ) s ON s.article_id = a.id
       ${clause}`,
    [...weightTable.params, ...params],
  );

  return rows[0]?.total ?? 0;
}

export async function listPublishedArticles(
  filters: ArticleFilters,
  page: number,
  pageSize: number,
): Promise<ArticleSummary[]> {
  const { clause, params } = buildPublishedWhere(filters);
  const offset = (page - 1) * pageSize;

  const rows = await query<ArticleRow[]>(
    `SELECT ${ARTICLE_COLUMNS} ${ARTICLE_JOINS} ${clause}
      ORDER BY a.published_at DESC, a.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const tagsByArticle = await loadTagsFor(rows.map((row) => row.id));
  return rows.map((row) => toSummary(row, tagsByArticle.get(row.id) ?? []));
}

export async function countPublishedArticles(filters: ArticleFilters): Promise<number> {
  const { clause, params } = buildPublishedWhere(filters);
  const rows = await query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM articles a ${clause}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

/**
 * 浏览量 +1。
 * 必须显式写 `updated_at = updated_at`：该列有 ON UPDATE CURRENT_TIMESTAMP，
 * 不这么写的话，每有人看一次文章，"更新于"的时间都会被刷新。
 */
export async function incrementViewCount(id: number): Promise<void> {
  await execute(
    'UPDATE articles SET view_count = view_count + 1, updated_at = updated_at WHERE id = ?',
    [id],
  );
}

function toSummary(row: ArticleRow, tags: string[]): ArticleSummary {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    type: row.type,
    status: row.status,
    cover_url: row.cover_url,
    // TINYINT(1) 取出来是 0/1，转成布尔再交给前端
    show_toc: Boolean(row.show_toc),
    view_count: row.view_count,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: { id: row.category_id, name: row.category_name },
    author: { id: row.author_id, username: row.author_username },
    tags,
  };
}

/** 一次查出多篇文章的标签，避免 N+1 查询 */
async function loadTagsFor(articleIds: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (articleIds.length === 0) return result;

  const placeholders = articleIds.map(() => '?').join(', ');
  const rows = await query<(RowDataPacket & { article_id: number; name: string })[]>(
    `SELECT atg.article_id, t.name
       FROM article_tags atg
       JOIN tags t ON t.id = atg.tag_id
      WHERE atg.article_id IN (${placeholders})
      ORDER BY t.name ASC`,
    articleIds,
  );

  for (const row of rows) {
    const list = result.get(row.article_id) ?? [];
    list.push(row.name);
    result.set(row.article_id, list);
  }
  return result;
}

export async function findArticleById(id: number): Promise<ArticleDetail | null> {
  const rows = await query<ArticleRow[]>(
    `SELECT ${ARTICLE_COLUMNS} ${ARTICLE_JOINS} WHERE a.id = ? LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;

  const tagRows = await query<(RowDataPacket & { name: string })[]>(
    `SELECT t.name FROM article_tags atg JOIN tags t ON t.id = atg.tag_id
      WHERE atg.article_id = ? ORDER BY t.name ASC`,
    [id],
  );

  return {
    ...toSummary(row, tagRows.map((item) => item.name)),
    content: row.content,
  };
}

export async function listArticlesByAuthor(
  authorId: number,
  status?: ArticleStatus,
): Promise<ArticleSummary[]> {
  const params: ExecuteValues[] = [authorId];
  let where = 'WHERE a.author_id = ?';
  if (status) {
    where += ' AND a.status = ?';
    params.push(status);
  }

  const rows = await query<ArticleRow[]>(
    `SELECT ${ARTICLE_COLUMNS} ${ARTICLE_JOINS} ${where} ORDER BY a.updated_at DESC, a.id DESC`,
    params,
  );

  const tagsByArticle = await loadTagsFor(rows.map((row) => row.id));
  return rows.map((row) => toSummary(row, tagsByArticle.get(row.id) ?? []));
}

export async function insertArticle(
  ctx: Ctx,
  input: {
    authorId: number;
    categoryId: number;
    title: string;
    content: string;
    type: ArticleSummary['type'];
    coverUrl: string | null;
    showToc: boolean;
    status: ArticleStatus;
    publishedAt: string | null;
  },
): Promise<number> {
  const result = await x(
    ctx,
    `INSERT INTO articles (author_id, category_id, title, content, type, cover_url, show_toc, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.authorId,
      input.categoryId,
      input.title,
      input.content,
      input.type,
      input.coverUrl,
      input.showToc,
      input.status,
      input.publishedAt,
    ],
  );
  return result.insertId;
}

export async function updateArticleRow(
  ctx: Ctx,
  id: number,
  input: {
    title: string;
    content: string;
    type: ArticleSummary['type'];
    categoryId: number;
    coverUrl: string | null;
    showToc: boolean;
    status: ArticleStatus;
    publishedAt: string | null;
  },
): Promise<void> {
  await x(
    ctx,
    `UPDATE articles
        SET title = ?, content = ?, type = ?, category_id = ?, cover_url = ?, show_toc = ?, status = ?, published_at = ?
      WHERE id = ?`,
    [
      input.title,
      input.content,
      input.type,
      input.categoryId,
      input.coverUrl,
      input.showToc,
      input.status,
      input.publishedAt,
      id,
    ],
  );
}

export async function deleteArticleRow(id: number): Promise<void> {
  // article_tags 上有级联删除，关联行会跟着消失
  await execute('DELETE FROM articles WHERE id = ?', [id]);
}

/**
 * 标签同步：先清空该文章的关联，再按名字逐个 upsert。
 *
 * `ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)` 是 MySQL 的常用写法：
 * 名字已存在时也会把它的 id 放进 insertId，于是"新建或取已有"用一条语句就够了。
 */
export async function replaceArticleTags(
  ctx: Ctx,
  articleId: number,
  tagNames: string[],
): Promise<void> {
  await x(ctx, 'DELETE FROM article_tags WHERE article_id = ?', [articleId]);

  for (const name of tagNames) {
    const result = await x(
      ctx,
      'INSERT INTO tags (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
      [name],
    );
    await x(ctx, 'INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)', [articleId, result.insertId]);
  }
}
