import type { RowDataPacket } from 'mysql2';

import { execute, query } from '../../db.js';

export type Category = {
  id: number;
  name: string;
};

export type CategoryWithCount = Category & {
  article_count: number;
};

type CategoryRow = RowDataPacket & {
  id: number;
  name: string;
  article_count?: number;
};

export async function listCategories(): Promise<Category[]> {
  // 按 id 排（即创建顺序），而不是按名字排：
  // utf8mb4_0900_ai_ci 对中文按码点排序，结果看起来是随机的，用户会以为下拉框乱了
  const rows = await query<CategoryRow[]>(
    'SELECT id, name FROM categories ORDER BY id ASC',
  );
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** 管理页用：带"该分类下有多少篇文章"，删除前能给出有依据的提示 */
export async function listCategoriesWithCount(): Promise<CategoryWithCount[]> {
  const rows = await query<CategoryRow[]>(
    `SELECT c.id, c.name, COUNT(a.id) AS article_count
       FROM categories c
       LEFT JOIN articles a ON a.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.id ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    article_count: Number(row.article_count ?? 0),
  }));
}

/** 写文章时校验分类是否存在：外键错误是"数据库拒绝"，先查一次能给出人话 */
export async function findCategoryById(id: number): Promise<Category | null> {
  const rows = await query<CategoryRow[]>(
    'SELECT id, name FROM categories WHERE id = ? LIMIT 1',
    [id],
  );
  const row = rows[0];
  return row ? { id: row.id, name: row.name } : null;
}

export async function findCategoryByName(name: string): Promise<Category | null> {
  const rows = await query<CategoryRow[]>(
    'SELECT id, name FROM categories WHERE name = ? LIMIT 1',
    [name],
  );
  const row = rows[0];
  return row ? { id: row.id, name: row.name } : null;
}

export async function insertCategory(name: string): Promise<number> {
  const result = await execute('INSERT INTO categories (name) VALUES (?)', [name]);
  return result.insertId;
}

export async function updateCategoryName(id: number, name: string): Promise<boolean> {
  const result = await execute('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
  return result.affectedRows > 0;
}

export async function deleteCategoryById(id: number): Promise<void> {
  await execute('DELETE FROM categories WHERE id = ?', [id]);
}

export async function countArticlesInCategory(id: number): Promise<number> {
  const rows = await query<(RowDataPacket & { total: number })[]>(
    'SELECT COUNT(*) AS total FROM articles WHERE category_id = ?',
    [id],
  );
  return rows[0]?.total ?? 0;
}
