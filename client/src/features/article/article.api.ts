import { api } from '../../lib/api';

export type ArticleType = 'tech' | 'life';
export type ArticleStatus = 'draft' | 'published';

export type Category = {
  id: number;
  name: string;
};

export type ArticleAuthor = {
  id: number;
  username: string;
};

export type ArticleSummary = {
  id: number;
  title: string;
  /** 正文前 180 字，列表页当导语用 */
  excerpt: string;
  type: ArticleType;
  status: ArticleStatus;
  cover_url: string | null;
  /** 作者是否要求在详情页顶部显示目录 */
  show_toc: boolean;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category: { id: number; name: string };
  author: ArticleAuthor;
  tags: string[];
};

export type ArticleDetail = ArticleSummary & {
  content: string;
};

export type PublicUser = {
  id: number;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PagedArticles = {
  articles: ArticleSummary[];
  pagination: Pagination;
};

export type ArticleQuery = {
  page?: number;
  pageSize?: number;
  type?: ArticleType;
  categoryId?: number;
  q?: string;
  tag?: string;
};

export type ArticleInput = {
  title: string;
  content: string;
  type: ArticleType;
  categoryId: number;
  tags: string[];
  coverUrl: string | null;
  showToc: boolean;
  status: ArticleStatus;
};

export const ARTICLE_TYPE_LABEL: Record<ArticleType, string> = {
  tech: '技术文章',
  life: '日常思考',
};

export const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: '草稿',
  published: '已发布',
};

function toQueryString(query: ArticleQuery): string {
  const params = new URLSearchParams();

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.type) params.set('type', query.type);
  if (query.categoryId !== undefined) params.set('categoryId', String(query.categoryId));
  if (query.q) params.set('q', query.q);
  if (query.tag) params.set('tag', query.tag);

  const text = params.toString();
  return text ? `?${text}` : '';
}

export function listCategories(): Promise<{ categories: Category[] }> {
  return api.get<{ categories: Category[] }>('/categories');
}

export function listPublicArticles(query: ArticleQuery = {}): Promise<PagedArticles> {
  return api.get<PagedArticles>(`/articles${toQueryString(query)}`);
}

export function listMyArticles(status?: ArticleStatus): Promise<{ articles: ArticleSummary[] }> {
  const query = status ? `?status=${status}` : '';
  return api.get<{ articles: ArticleSummary[] }>(`/articles/mine${query}`);
}

export function getArticle(id: number): Promise<{ article: ArticleDetail }> {
  return api.get<{ article: ArticleDetail }>(`/articles/${id}`);
}

export function createArticle(input: ArticleInput): Promise<{ article: ArticleDetail }> {
  return api.post<{ article: ArticleDetail }>('/articles', input);
}

export function updateArticle(
  id: number,
  input: Partial<ArticleInput>,
): Promise<{ article: ArticleDetail }> {
  return api.patch<{ article: ArticleDetail }>(`/articles/${id}`, input);
}

export function deleteArticle(id: number): Promise<void> {
  return api.delete(`/articles/${id}`);
}

export function getUser(id: number): Promise<{ user: PublicUser }> {
  return api.get<{ user: PublicUser }>(`/users/${id}`);
}

export function listAuthorArticles(id: number, query: ArticleQuery = {}): Promise<PagedArticles> {
  return api.get<PagedArticles>(`/users/${id}/articles${toQueryString(query)}`);
}
