import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ArticleRow } from '../components/article/ArticleRow';
import {
  getUser,
  listAuthorArticles,
  type ArticleSummary,
  type PublicUser,
} from '../features/article/article.api';
import { formatDateTime } from '../lib/format';

export function AuthorPage() {
  const { id } = useParams<{ id: string }>();
  const authorId = Number(id);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [userResult, articleResult] = await Promise.all([
          getUser(authorId),
          listAuthorArticles(authorId, { pageSize: 50 }),
        ]);
        if (cancelled) return;
        setUser(userResult.user);
        setArticles(articleResult.articles);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载失败');
        setArticles([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorId]);

  if (error) {
    return (
      <div className="wrap blocked-state">
        <span className="kicker">作者 / AUTHOR</span>
        <h1>找不到这位作者</h1>
        <p className="blocked-desc">{error}</p>
        <div className="blocked-actions">
          <Link to="/" className="btn-primary">
            回首页
          </Link>
        </div>
      </div>
    );
  }

  if (!user || articles === null) {
    return <p className="wrap page-loading">正在加载…</p>;
  }

  const initial = user.username.slice(0, 1).toUpperCase();

  return (
    <div className="wrap author-page">
      <header className="author-head">
        {user.avatar_url ? (
          <img className="author-avatar" src={user.avatar_url} alt="" />
        ) : (
          <div className="author-avatar author-avatar--fallback" aria-hidden="true">
            {initial}
          </div>
        )}
        <div>
          <span className="kicker">作者 / AUTHOR</span>
          <h1>{user.username}</h1>
          {user.bio && <p className="author-bio">{user.bio}</p>}
          <p className="author-meta">
            共 {articles.length} 篇已发布文章 · 加入于 {formatDateTime(user.created_at)}
          </p>
        </div>
      </header>

      <div className="list-head">
        <h2>已发布文章</h2>
        <span>{articles.length} 篇</span>
      </div>

      {articles.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">这位作者还没有发布文章</p>
          <p className="empty-desc">草稿不会出现在这里。</p>
        </div>
      )}

      {articles.map((article) => (
        <ArticleRow key={article.id} article={article} />
      ))}
    </div>
  );
}
