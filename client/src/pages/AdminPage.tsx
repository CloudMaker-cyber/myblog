import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';
import {
  changeUserStatus,
  createCategory,
  deleteArticleAsAdmin,
  deleteCategory,
  listAdminArticles,
  listAdminCategories,
  listAdminUsers,
  renameCategory,
  type AdminArticleQuery,
  type AdminCategory,
  type AdminUser,
} from '../features/admin/admin.api';
import {
  ARTICLE_STATUS_LABEL,
  ARTICLE_TYPE_LABEL,
  type ArticleSummary,
} from '../features/article/article.api';
import { formatDateTime } from '../lib/format';

type Tab = 'categories' | 'articles' | 'users';

const TABS: { label: string; value: Tab }[] = [
  { label: '分类管理', value: 'categories' },
  { label: '全部文章', value: 'articles' },
  { label: '用户管理', value: 'users' },
];

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('categories');

  return (
    <div className="wrap admin-page">
      <header className="admin-head">
        <span className="kicker">管理 / ADMIN</span>
        <h1>站点管理</h1>
        <div className="filter-row">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={tab === item.value ? 'filter-link is-active' : 'filter-link'}
              onClick={() => setTab(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'categories' && <CategoriesPanel />}
      {tab === 'articles' && <ArticlesPanel />}
      {tab === 'users' && <UsersPanel />}
    </div>
  );
}

/* ---------------- 分类 ---------------- */

function CategoriesPanel() {
  const [items, setItems] = useState<AdminCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listAdminCategories();
        if (!cancelled) setItems(result.categories);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(err instanceof Error ? err.message : '加载失败');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleCreate(): Promise<void> {
    const value = name.trim();
    if (!value) return;

    setPending(true);
    setError(null);
    try {
      await createCategory(value);
      setName('');
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失败');
    } finally {
      setPending(false);
    }
  }

  async function handleRename(): Promise<void> {
    if (!editing) return;

    setPending(true);
    setError(null);
    try {
      await renameCategory(editing.id, editing.name.trim());
      setEditing(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(category: AdminCategory): Promise<void> {
    if (!window.confirm(`确定删除分类「${category.name}」吗？`)) return;

    setError(null);
    try {
      await deleteCategory(category.id);
      setReloadKey((key) => key + 1);
    } catch (err) {
      // 分类下有文章时后端返回 409，这里把原因原样展示，不吞掉
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  const loading = items === null;

  return (
    <section>
      <div className="admin-form">
        <input
          className="field-input"
          type="text"
          placeholder="新分类名称，例如「性能优化」"
          maxLength={30}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={pending || !name.trim()}
          onClick={() => void handleCreate()}
        >
          添加分类
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="admin-empty">加载中…</p>}

      {(items ?? []).map((category) => (
        <div className="admin-row" key={category.id}>
          {editing?.id === category.id ? (
            <div className="admin-rename">
              <input
                className="field-input"
                type="text"
                maxLength={30}
                value={editing.name}
                onChange={(event) => setEditing({ id: category.id, name: event.target.value })}
              />
              <button type="button" className="link-quiet" onClick={() => void handleRename()}>
                保存
              </button>
              <button type="button" className="link-quiet" onClick={() => setEditing(null)}>
                取消
              </button>
            </div>
          ) : (
            <div>
              <h3>{category.name}</h3>
              <p className="admin-meta">{category.article_count} 篇文章</p>
            </div>
          )}

          {editing?.id !== category.id && (
            <div className="admin-actions">
              <button
                type="button"
                className="link-quiet"
                onClick={() => setEditing({ id: category.id, name: category.name })}
              >
                重命名
              </button>
              <button
                type="button"
                className="link-quiet"
                onClick={() => void handleDelete(category)}
              >
                删除
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

/* ---------------- 文章 ---------------- */

function ArticlesPanel() {
  const [status, setStatus] = useState<'all' | 'draft' | 'published'>('all');
  const [items, setItems] = useState<ArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const query: AdminArticleQuery = { pageSize: 50 };
        if (status !== 'all') query.status = status;

        const result = await listAdminArticles(query);
        if (cancelled) return;
        setItems(result.articles);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(err instanceof Error ? err.message : '加载失败');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, reloadKey]);

  async function handleDelete(article: ArticleSummary): Promise<void> {
    if (!window.confirm(`删除「${article.title}」后无法恢复，确定吗？`)) return;

    setError(null);
    try {
      await deleteArticleAsAdmin(article.id);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  const loading = items === null;

  return (
    <section>
      <div className="filter-row">
        {(['all', 'draft', 'published'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={status === value ? 'filter-link is-active' : 'filter-link'}
            onClick={() => setStatus(value)}
          >
            {value === 'all' ? '全部' : ARTICLE_STATUS_LABEL[value]}
          </button>
        ))}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="admin-empty">加载中…</p>}

      {(items ?? []).map((article) => (
        <div className="admin-row" key={article.id}>
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
              <Link to={`/articles/${article.id}`}>{article.title}</Link>
            </h3>
            <p className="admin-meta">
              {article.author.username} · 更新于 {formatDateTime(article.updated_at)} ·{' '}
              {article.view_count} 次阅读
            </p>
          </div>

          <div className="admin-actions">
            <Link to={`/articles/${article.id}`} className="link-quiet">
              查看
            </Link>
            <button type="button" className="link-quiet" onClick={() => void handleDelete(article)}>
              删除
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------------- 用户 ---------------- */

function UsersPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listAdminUsers();
        if (cancelled) return;
        setItems(result.users);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(err instanceof Error ? err.message : '加载失败');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function toggle(target: AdminUser): Promise<void> {
    const nextStatus = target.status === 'active' ? 'disabled' : 'active';

    if (nextStatus === 'disabled' && !window.confirm(`禁用「${target.username}」后，他将无法登录和发文。确定吗？`)) {
      return;
    }

    setError(null);
    try {
      await changeUserStatus(target.id, nextStatus);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  }

  const loading = items === null;

  return (
    <section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="admin-empty">加载中…</p>}

      {(items ?? []).map((item) => (
        <div className="admin-row" key={item.id}>
          <div>
            <h3>
              {item.username}
              {item.role === 'admin' && <span className="badge">管理员</span>}
              <span
                className={
                  item.status === 'active' ? 'badge badge-published' : 'badge badge-draft'
                }
              >
                {item.status === 'active' ? '正常' : '已禁用'}
              </span>
            </h3>
            <p className="admin-meta">
              {item.email} · {item.article_count} 篇文章 · 加入于 {formatDateTime(item.created_at)}
            </p>
          </div>

          <div className="admin-actions">
            {item.id !== user?.id && (
              <button type="button" className="link-quiet" onClick={() => void toggle(item)}>
                {item.status === 'active' ? '禁用' : '恢复'}
              </button>
            )}
            {item.id === user?.id && <span className="admin-self">当前账号</span>}
          </div>
        </div>
      ))}
    </section>
  );
}
