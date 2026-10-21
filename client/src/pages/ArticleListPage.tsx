import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ArticleRow } from '../components/article/ArticleRow';
import { Pagination } from '../components/article/Pagination';
import {
  listCategories,
  listPublicArticles,
  type ArticleType,
  type Category,
  type PagedArticles,
} from '../features/article/article.api';
import { getResume } from '../lib/reading';

type ArticleListPageProps = {
  title: string;
  type?: ArticleType;
  showResume?: boolean;
};

export function ArticleListPage({ title, type, showResume = false }: ArticleListPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const categoryParam = searchParams.get('categoryId');
  const q = searchParams.get('q') ?? '';
  const activeCategoryId = categoryParam ? Number(categoryParam) : null;

  const [data, setData] = useState<PagedArticles | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const resume = showResume ? getResume() : null;

  useEffect(() => {
    void (async () => {
      try {
        const result = await listCategories();
        setCategories(result.categories);
      } catch {
        // 分类加载失败不影响文章列表，静默处理
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listPublicArticles({
          page,
          pageSize: 10,
          type,
          categoryId: activeCategoryId ?? undefined,
          q: q || undefined,
        });
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setData({ articles: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
        setError(err instanceof Error ? err.message : '加载失败');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, type, activeCategoryId, q]);

  function updateParams(next: Record<string, string | undefined>): void {
    const params = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    setSearchParams(params);
    setData(null);
  }

  const isLoading = data === null;

  return (
    <div className="wrap listing">
      {resume && (
        <div className="resume">
          <span className="resume-kicker">继续阅读</span>
          <span className="resume-title">{resume.title}</span>
          <span className="resume-meta">{Math.round(resume.progress * 100)}%</span>
          <Link to={`/articles/${resume.articleId}`} className="resume-link">
            接着读
          </Link>
          <div className="resume-bar">
            <i style={{ width: `${Math.round(resume.progress * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="list-head">
        <h2>{title}</h2>
        <span>{isLoading ? '加载中…' : `共 ${data.pagination.total} 篇`}</span>

        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            const keyword = searchRef.current?.value.trim() ?? '';
            updateParams({ q: keyword || undefined, page: '1' });
          }}
        >
          <input
            key={q}
            ref={searchRef}
            className="search-input"
            type="search"
            placeholder="搜索标题"
            defaultValue={q}
            aria-label="按标题搜索"
          />
          <button type="submit" className="search-submit">
            搜索
          </button>
        </form>
      </div>

      {categories.length > 0 && (
        <div className="chip-row">
          <button
            type="button"
            className={activeCategoryId === null ? 'chip is-active' : 'chip'}
            onClick={() => updateParams({ categoryId: undefined, page: '1' })}
          >
            全部分类
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={activeCategoryId === category.id ? 'chip is-active' : 'chip'}
              onClick={() => updateParams({ categoryId: String(category.id), page: '1' })}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!isLoading && data.articles.length === 0 && (
        <div className="empty-state">
          <p className="empty-title">{q ? '没有匹配的文章' : '还没有文章'}</p>
          <p className="empty-desc">
            {q ? '换个关键词试试，搜索只匹配标题。' : '第一篇文章发布后，会按时间倒序出现在这里。'}
          </p>
        </div>
      )}

      {(data?.articles ?? []).map((article) => (
        <ArticleRow key={article.id} article={article} />
      ))}

      {data && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onChange={(nextPage) => updateParams({ page: String(nextPage) })}
        />
      )}
    </div>
  );
}
