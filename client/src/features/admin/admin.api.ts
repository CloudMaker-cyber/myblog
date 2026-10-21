import { api } from '../../lib/api';
import type { ArticleSummary, Category, Pagination } from '../article/article.api';

export type AdminCategory = Category & {
  article_count: number;
};

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  created_at: string;
  article_count: number;
};

export type AdminArticleQuery = {
  page?: number;
  pageSize?: number;
  status?: 'draft' | 'published';
  q?: string;
};

export function listAdminCategories(): Promise<{ categories: AdminCategory[] }> {
  return api.get<{ categories: AdminCategory[] }>('/admin/categories');
}

export function createCategory(name: string): Promise<{ category: Category }> {
  return api.post<{ category: Category }>('/admin/categories', { name });
}

export function renameCategory(id: number, name: string): Promise<{ category: Category }> {
  return api.patch<{ category: Category }>(`/admin/categories/${id}`, { name });
}

export function deleteCategory(id: number): Promise<void> {
  return api.delete(`/admin/categories/${id}`);
}

export function listAdminArticles(
  query: AdminArticleQuery = {},
): Promise<{ articles: ArticleSummary[]; pagination: Pagination }> {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.q) params.set('q', query.q);

  const text = params.toString();
  return api.get<{ articles: ArticleSummary[]; pagination: Pagination }>(
    `/admin/articles${text ? `?${text}` : ''}`,
  );
}

export function listAdminUsers(
  page = 1,
  pageSize = 50,
): Promise<{ users: AdminUser[]; pagination: Pagination }> {
  return api.get<{ users: AdminUser[]; pagination: Pagination }>(
    `/admin/users?page=${page}&pageSize=${pageSize}`,
  );
}

export function changeUserStatus(
  id: number,
  status: 'active' | 'disabled',
): Promise<{ user: AdminUser }> {
  return api.patch<{ user: AdminUser }>(`/admin/users/${id}/status`, { status });
}

export function deleteArticleAsAdmin(id: number): Promise<void> {
  return api.delete(`/articles/${id}`);
}
