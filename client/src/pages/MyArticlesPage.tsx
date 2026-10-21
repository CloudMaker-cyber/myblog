import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  ARTICLE_STATUS_LABEL,
  ARTICLE_TYPE_LABEL,
  deleteArticle,
  listMyArticles,
  type ArticleStatus,
  type ArticleSummary,
} from '../features/article/article.api';
import { formatDateTime } from '../lib/format';

type Filter = ArticleStatus | 'all';

const FILTERS: { label: string; value: Filter }[] = [
  { label: '全部', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
];

export function MyArticlesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  // null 表示"还没拿到数据"。用它代替单独的 loading 布尔值，
  // 可以避免在 effect 里同步调用 setState（那样会触发级联渲染）。
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listMyArticles(filter === 'all' ? undefined : filter);
        if (cancelled) return;
        setArticles(result.articles);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setArticles([]);
        setError(err instanceof Error ? err.message : '加载失败');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  function changeFilter(next: Filter): void {
    if (next === filter) return;
    setFilter(next);
    setArticles(null);
  }

  async function handleDelete(article: ArticleSummary): Promise<void> {
    if (!window.confirm(`删除「${article.title}」后无法恢复，确定吗？`)) return;

    try {
      await deleteArticle(article.id);
      setArticles((prev) => (prev ? prev.filter((item) => item.id !== article.id) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  const loading = articles === null;

  return (
    <div className="wrap listing">
      <div className="list-head">
        <h2>我的文章</h2>
        <span>{loading ? '加载中…' : `共 ${articles.length} 篇`}</span>
        <Link to="/write" className="btn-primary list-head-action">
          写文章
        </Link>
      </div>

      <div className="filter-row">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? 'filter-link is-active' : 'filter-link'}
            onClick={() => changeFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!loading && articles.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">这里还没有文章</p>
          <p className="empty-desc">
            写第一篇吧，草稿不会出现在公开列表里。
            <Link to="/write" className="empty-link">
              去写文章
            </Link>
          </p>
        </div>
      )}

      {(articles ?? []).map((article) => (
        <article className="my-row" key={article.id}>
          <div>
            <div className="kicker">
              {ARTICLE_TYPE_LABEL[article.type]} · {article.category.name}
              <span
                className={
                  article.status === 'published' ? 'badge badge-published' : 'badge badge-draft'
                }
              >
                {ARTICLE_STATUS_LABEL[article.status]}
              </span>
            </div>
            <h3>
              <Link to={`/articles/${article.id}/edit`}>{article.title}</Link>
            </h3>
            <div className="my-meta">
              更新于 {formatDateTime(article.updated_at)}
              {article.status === 'published' && ` · ${article.view_count} 次阅读`}
              {article.tags.length > 0 && ` · ${article.tags.join(' / ')}`}
            </div>
          </div>
          <div className="my-actions">
            <Link to={`/articles/${article.id}/edit`} className="link-quiet">
              编辑
            </Link>
            <button type="button" className="link-quiet" onClick={() => void handleDelete(article)}>
              删除
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
