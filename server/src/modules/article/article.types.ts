export type ArticleType = 'tech' | 'life';
export type ArticleStatus = 'draft' | 'published';

export type ArticleAuthor = {
  id: number;
  username: string;
};

export type ArticleSummary = {
  id: number;
  title: string;
  type: ArticleType;
  status: ArticleStatus;
  cover_url: string | null;
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

export const ARTICLE_TYPE_LABEL: Record<ArticleType, string> = {
  tech: '技术文章',
  life: '日常思考',
};
