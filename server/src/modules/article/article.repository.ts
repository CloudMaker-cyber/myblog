import type { ExecuteValues, ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

import { execute, query } from '../../db.js';
import type { ArticleDetail, ArticleStatus, ArticleSummary } from './article.types.js';

type Ctx = PoolConnection | undefined;

type ArticleRow = RowDataPacket & {
  id: number;
  title: string;
  content: string;
  type: ArticleSummary['type'];
  status: ArticleStatus;
  cover_url: string | null;
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
  a.id, a.title, a.content, a.type, a.status, a.cover_url, a.view_count,
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

function toSummary(row: ArticleRow, tags: string[]): ArticleSummary {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    cover_url: row.cover_url,
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
    status: ArticleStatus;
    publishedAt: string | null;
  },
): Promise<number> {
  const result = await x(
    ctx,
    `INSERT INTO articles (author_id, category_id, title, content, type, cover_url, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.authorId,
      input.categoryId,
      input.title,
      input.content,
      input.type,
      input.coverUrl,
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
    status: ArticleStatus;
    publishedAt: string | null;
  },
): Promise<void> {
  await x(
    ctx,
    `UPDATE articles
        SET title = ?, content = ?, type = ?, category_id = ?, cover_url = ?, status = ?, published_at = ?
      WHERE id = ?`,
    [
      input.title,
      input.content,
      input.type,
      input.categoryId,
      input.coverUrl,
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
