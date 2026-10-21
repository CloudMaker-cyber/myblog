import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';
import {
  ARTICLE_STATUS_LABEL,
  ARTICLE_TYPE_LABEL,
  createArticle,
  deleteArticle,
  getArticle,
  listCategories,
  updateArticle,
  type ArticleStatus,
  type ArticleType,
  type Category,
} from '../features/article/article.api';
import { ApiError } from '../lib/api';
import { parseFormError, type FieldErrors } from '../lib/form-errors';
import { formatDateTime } from '../lib/format';

const MAX_TAGS = 8;

type Blocked = {
  title: string;
  description: string;
};

function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of text.split(/[,，、]/)) {
    const name = raw.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
  }

  return result.slice(0, MAX_TAGS);
}

export function WritePage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const articleId = id ? Number(id) : null;
  const isEditing = articleId !== null && Number.isInteger(articleId);

  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<ArticleType>('tech');
  const [categoryId, setCategoryId] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [status, setStatus] = useState<ArticleStatus>('draft');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const categoryResult = await listCategories();
        if (cancelled) return;
        setCategories(categoryResult.categories);

        if (!isEditing) {
          setCategoryId(String(categoryResult.categories[0]?.id ?? ''));
          return;
        }

        const articleResult = await getArticle(articleId);
        if (cancelled) return;

        const article = articleResult.article;

        /**
         * 归属校验必须在"渲染编辑态之前"做。
         * 接口本身按规则放行了（已发布文章谁都能读），
         * 但"能读"不等于"能编辑"——把别人的文章塞进编辑框，
         * 用户会以为可以改，直到点保存才被后端拦下。
         */
        if (user && article.author.id !== user.id) {
          setBlocked({
            title: '这篇不是你写的',
            description: '已发布的文章任何人都能读，但只有作者本人可以编辑。',
          });
          return;
        }

        setTitle(article.title);
        setContent(article.content);
        setType(article.type);
        setCategoryId(String(article.category.id));
        setTagsText(article.tags.join(', '));
        setCoverUrl(article.cover_url ?? '');
        setShowToc(article.show_toc);
        setStatus(article.status);
        setUpdatedAt(article.updated_at);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 404) {
          setBlocked({
            title: '文章不存在或你无权访问',
            description: '草稿只有作者本人能打开；如果这篇文章已被删除，也会看到这个提示。',
          });
        } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setBlocked({ title: '无权访问', description: err.message });
        } else {
          setError(err instanceof Error ? err.message : '加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [articleId, isEditing, user]);

  async function handleSave(nextStatus: ArticleStatus): Promise<void> {
    setPending(true);
    setError(null);
    setFieldErrors({});
    setNotice(null);

    const payload = {
      title: title.trim(),
      content,
      type,
      categoryId: Number(categoryId),
      tags: parseTags(tagsText),
      coverUrl: coverUrl.trim() ? coverUrl.trim() : null,
      showToc,
      status: nextStatus,
    };

    try {
      if (isEditing) {
        const { article } = await updateArticle(articleId, payload);
        setStatus(article.status);
        setUpdatedAt(article.updated_at);
        setNotice(article.status === 'published' ? '已更新发布' : '已转为草稿');
      } else {
        const { article } = await createArticle(payload);
        navigate(`/articles/${article.id}/edit`, { replace: true });
      }
    } catch (err) {
      const parsed = parseFormError(err);
      setFieldErrors(parsed.fields);
      setError(parsed.message);
    } finally {
      setPending(false);
    }
  }

  async function handleUnpublish(): Promise<void> {
    const confirmed = window.confirm(
      '转为草稿后，这篇文章会从公开列表中移除，访客将无法访问。确定吗？',
    );
    if (!confirmed) return;
    await handleSave('draft');
  }

  async function handleDelete(): Promise<void> {
    if (!isEditing) return;
    if (!window.confirm('删除后无法恢复，确定删除这篇文章吗？')) return;

    try {
      await deleteArticle(articleId);
      navigate('/me/articles', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  if (loading) {
    return <p className="wrap page-loading">正在加载…</p>;
  }

  if (blocked) {
    return (
      <div className="wrap blocked-state">
        <span className="kicker">写作台 / WRITE</span>
        <h1>{blocked.title}</h1>
        <p className="blocked-desc">{blocked.description}</p>
        <div className="blocked-actions">
          <Link to="/me/articles" className="btn-primary">
            回到我的文章
          </Link>
          <Link to="/" className="link-quiet">
            回首页
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="wrap editor">
      <div className="editor-bar">
        <div>
          <span className="kicker">写作台 / WRITE</span>
          <p className="editor-state">
            {isEditing
              ? `${ARTICLE_STATUS_LABEL[status]} · 更新于 ${formatDateTime(updatedAt)}`
              : '新文章'}
          </p>
        </div>
        <div className="editor-actions">
          <Link to="/me/articles" className="link-quiet">
            我的文章
          </Link>
          {isEditing && (
            <button type="button" className="link-quiet" onClick={() => void handleDelete()}>
              删除
            </button>
          )}

          {status === 'published' ? (
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => void handleUnpublish()}
              >
                转为草稿
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending}
                onClick={() => void handleSave('published')}
              >
                {pending ? '处理中…' : '更新发布'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => void handleSave('draft')}
              >
                {pending ? '处理中…' : '保存草稿'}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pending}
                onClick={() => void handleSave('published')}
              >
                发布
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="form-notice">{notice}</p>}

      <div className="editor-field">
        <label className="field-label" htmlFor="article-title">
          标题
        </label>
        <input
          id="article-title"
          className="editor-title"
          type="text"
          placeholder="给这篇文章起个标题"
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {fieldErrors.title && <p className="field-error">{fieldErrors.title}</p>}
      </div>

      <div className="editor-meta">
        <div className="editor-field">
          <span className="field-label">文章类型</span>
          <div className="type-switch">
            {(['tech', 'life'] as ArticleType[]).map((value) => (
              <button
                key={value}
                type="button"
                className={type === value ? 'type-option is-active' : 'type-option'}
                aria-pressed={type === value}
                onClick={() => setType(value)}
              >
                {ARTICLE_TYPE_LABEL[value]}
              </button>
            ))}
          </div>
          {fieldErrors.type && <p className="field-error">{fieldErrors.type}</p>}
        </div>

        <div className="editor-field">
          <label className="field-label" htmlFor="article-category">
            分类
          </label>
          <select
            id="article-category"
            className="field-select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId && <p className="field-error">{fieldErrors.categoryId}</p>}
        </div>

        <div className="editor-field">
          <label className="field-label" htmlFor="article-tags">
            标签
          </label>
          <input
            id="article-tags"
            className="field-input"
            type="text"
            placeholder="用逗号分隔，最多 8 个"
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
          />
          {fieldErrors.tags && <p className="field-error">{fieldErrors.tags}</p>}
        </div>

        <div className="editor-field">
          <label className="field-label" htmlFor="article-cover">
            封面图链接
          </label>
          <input
            id="article-cover"
            className="field-input"
            type="url"
            placeholder="留空则不显示封面"
            value={coverUrl}
            onChange={(event) => setCoverUrl(event.target.value)}
          />
          <p className="field-hint">
            填了会显示在标题下方；想把封面放进正文，直接用 Markdown 图片语法。
          </p>
          {fieldErrors.coverUrl && <p className="field-error">{fieldErrors.coverUrl}</p>}
        </div>

        <div className="editor-field">
          <span className="field-label">文章目录</span>
          <label className="checkbox-row" htmlFor="article-show-toc">
            <input
              id="article-show-toc"
              type="checkbox"
              checked={showToc}
              onChange={(event) => setShowToc(event.target.checked)}
            />
            <span>在文章开头显示目录（由正文里的 ## 和 ### 标题自动生成）</span>
          </label>
        </div>
      </div>

      <div className="editor-field">
        <label className="field-label" htmlFor="article-content">
          正文（Markdown）
        </label>
        <textarea
          id="article-content"
          className="editor-content"
          placeholder={'# 小标题\n\n在这里写正文。支持 Markdown 语法。'}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        {fieldErrors.content && <p className="field-error">{fieldErrors.content}</p>}
      </div>
    </div>
  );
}
