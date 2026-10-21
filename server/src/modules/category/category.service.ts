import { AppError } from '../../lib/http-error.js';
import {
  countArticlesInCategory,
  deleteCategoryById,
  findCategoryById,
  findCategoryByName,
  insertCategory,
  listCategoriesWithCount,
  updateCategoryName,
  type Category,
  type CategoryWithCount,
} from './category.repository.js';
import type { CategoryNameInput } from './category.schema.js';

export async function listForAdmin(): Promise<CategoryWithCount[]> {
  return listCategoriesWithCount();
}

export async function createCategory(input: CategoryNameInput): Promise<Category> {
  const existing = await findCategoryByName(input.name);
  if (existing) {
    throw new AppError(409, 'CATEGORY_TAKEN', '该分类名已存在');
  }

  const id = await insertCategory(input.name);
  const created = await findCategoryById(id);
  if (!created) {
    throw new AppError(500, 'INTERNAL_ERROR', '分类创建后读取失败');
  }
  return created;
}

export async function renameCategory(id: number, input: CategoryNameInput): Promise<Category> {
  const category = await findCategoryById(id);
  if (!category) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', '分类不存在');
  }

  const conflict = await findCategoryByName(input.name);
  if (conflict && conflict.id !== id) {
    throw new AppError(409, 'CATEGORY_TAKEN', '该分类名已存在');
  }

  await updateCategoryName(id, input.name);
  return { id, name: input.name };
}

/**
 * 删除分类。
 *
 * 数据库外键设了 RESTRICT，就算这里漏判也删不掉；但直接把 MySQL 的 1451 抛给用户
 * 等于让人对着 "Cannot delete or update a parent row" 发呆。
 * 所以先查一次数量，给出"还有 N 篇文章"这种能行动的信息。
 */
export async function deleteCategory(id: number): Promise<void> {
  const category = await findCategoryById(id);
  if (!category) {
    throw new AppError(404, 'CATEGORY_NOT_FOUND', '分类不存在');
  }

  const articleCount = await countArticlesInCategory(id);
  if (articleCount > 0) {
    throw new AppError(
      409,
      'CATEGORY_IN_USE',
      `该分类下还有 ${articleCount} 篇文章，先把它们移到别的分类再删除`,
    );
  }

  await deleteCategoryById(id);
}
