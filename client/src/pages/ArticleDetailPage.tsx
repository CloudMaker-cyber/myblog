import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { MarkdownContent } from '../components/article/MarkdownContent';
import { TableOfContents } from '../components/article/TableOfContents';
import {
  ARTICLE_TYPE_LABEL,
  getArticle,
  type ArticleDetail,
} from '../features/article/article.api';
import { ApiError } from '../lib/api';
import { articleNo, formatDateTime } from '../lib/format';
import { saveResume } from '../lib/reading';
import { extractToc } from '../lib/toc';

function readingMinutes(content: string): number {
  // 中文阅读速度按每分钟 400 字估算，够用就行
  return Math.max(1, Math.round(content.replace(/\s/g, '').length / 400));
}

export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const articleId = Number(id);

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // 目录从正文里现算，作者不需要手写一遍
  const tocItems = useMemo(() => (article ? extractToc(article.content) : []), [article]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  /**
   * 同一个 articleId 只发一次请求。
   *
   * 原因：开发模式下 <StrictMode> 会把 effect 执行两次（挂载→卸载→再挂载），
   * 每次都会发 GET /articles/:id，而该接口会 view_count + 1，
   * 于是一次打开文章会被记成两次浏览。用这个 ref 缓存请求本身，
   * 第二次执行直接复用同一个 promise，网络请求只发一次。
   */
  const requestRef = useRef<{ id: number; promise: Promise<ArticleDetail> } | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!requestRef.current || requestRef.current.id !== articleId) {
      requestRef.current = {
        id: articleId,
        promise: getArticle(articleId).then((result) => result.article),
      };
    }

    requestRef.current.promise
      .then((loaded) => {
        if (!cancelled) setArticle(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setBlocked('文章不存在或已被删除');
        } else {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  /** 阅读进度：只影响左侧那根标尺和本地记录的进度，不做任何网络请求 */
  useEffect(() => {
    if (!article) return;

    let frame = 0;

    function measure(): void {
      const node = bodyRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const value = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

      progressRef.current = value;
      setProgress(value);
    }

    function onScroll(): void {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [article]);

  /** 每隔几秒记一次进度；离开页面时再记最后一次，供首页的「继续阅读」使用 */
  useEffect(() => {
    if (!article) return;
    // 取一个局部常量：TS 不会把外层的 null 收窄带进下面这个"可能稍后才调用"的函数
    const current = article;

    function persist(): void {
      if (progressRef.current < 0.03) return;
      saveResume({
        articleId: current.id,
        title: current.title,
        progress: progressRef.current,
        updatedAt: Date.now(),
      });
    }

    const timer = window.setInterval(persist, 4000);
    return () => {
      window.clearInterval(timer);
      persist();
    };
  }, [article]);

  if (blocked) {
    return (
      <div className="wrap blocked-state">
        <span className="kicker">文章 / ARTICLE</span>
        <h1>{blocked}</h1>
        <p className="blocked-desc">它可能被作者删除了，或者从未发布过。</p>
        <div className="blocked-actions">
          <Link to="/" className="btn-primary">
            回首页
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wrap blocked-state">
        <span className="kicker">文章 / ARTICLE</span>
        <h1>打不开这篇文章</h1>
        <p className="blocked-desc">{error}</p>
      </div>
    );
  }

  if (!article) {
    return <p className="wrap page-loading">正在加载…</p>;
  }

  return (
    <>
      <article className={`article-detail article-detail--${article.type}`}>
        <div className="wrap article-wrap">
          <header className="article-head">
            <div className="kicker">
              {ARTICLE_TYPE_LABEL[article.type]} · {article.category.name}
              <span className="no"> · No. {articleNo(article.id)}</span>
            </div>
            <h1>{article.title}</h1>
            <div className="byline">
              <Link to={`/users/${article.author.id}`} className="author">
                {article.author.username}
              </Link>
              <span>{formatDateTime(article.published_at ?? article.created_at)}</span>
              <span className="grow" />
              <span>约 {readingMinutes(article.content)} 分钟</span>
              <span>{article.view_count} 次阅读</span>
            </div>
          </header>

          {/* 封面由作者决定：填了 cover_url 才显示；想放在正文里，就不填这个字段，直接用 Markdown 图片 */}
          {article.cover_url && (
            <img className="article-cover" src={article.cover_url} alt="" loading="lazy" />
          )}

          {article.show_toc && (
            <TableOfContents
              items={tocItems}
              onJump={(index) => {
                const node = bodyRef.current?.querySelectorAll('h2, h3').item(index);
                if (!node) return;
                const top = node.getBoundingClientRect().top + window.scrollY - 24;
                window.scrollTo({ top, behavior: 'smooth' });
              }}
            />
          )}

          <div className="article-body" ref={bodyRef}>
            <MarkdownContent content={article.content} />
          </div>

          <footer className="signoff">
            <strong>No. {articleNo(article.id)}</strong>
            <br />
            分类 {article.category.name}
            {article.tags.length > 0 && (
              <>
                {' · 标签 '}
                {article.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/?tag=${encodeURIComponent(tag)}`}
                    className="tag-link tag-link--inline"
                  >
                    #{tag}
                  </Link>
                ))}
              </>
            )}
          </footer>
        </div>
      </article>

      <div className="reading-rail" aria-hidden="true">
        <div className="reading-rail-track">
          <div className="reading-rail-fill" style={{ height: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="reading-rail-percent">{String(Math.round(progress * 100)).padStart(2, '0')}</span>
      </div>
    </>
  );
}
