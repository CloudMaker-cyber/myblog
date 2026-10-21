import type { RowDataPacket } from 'mysql2';

import { query } from '../../db.js';

export type Category = {
  id: number;
  name: string;
};

type CategoryRow = RowDataPacket & {
  id: number;
  name: string;
};

export async function listCategories(): Promise<Category[]> {
  // 按 id 排（即创建顺序），而不是按名字排：
  // utf8mb4_0900_ai_ci 对中文按码点排序，结果看起来是随机的，用户会以为下拉框乱了
  const rows = await query<CategoryRow[]>(
    'SELECT id, name FROM categories ORDER BY id ASC',
  );
  return rows.map((row) => ({ id: row.id, name: row.name }));
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
