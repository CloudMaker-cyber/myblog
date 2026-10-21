import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { updateProfileRequest } from '../features/auth/auth.api';
import { useAuth } from '../features/auth/AuthContext';
import { parseFormError, type FieldErrors } from '../lib/form-errors';
import { formatDateTime } from '../lib/format';

export function ProfilePage() {
  const { user, refresh, signOut } = useAuth();

  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  /** 记录加载失败的那个头像地址：换了地址就重新尝试 */
  const [brokenAvatar, setBrokenAvatar] = useState<string | null>(null);

  // ProtectedRoute 已经保证登录；这里只是让类型收窄
  if (!user) return null;

  const showAvatar = Boolean(user.avatar_url) && brokenAvatar !== user.avatar_url;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    setNotice(null);

    try {
      await updateProfileRequest({
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
        bio: bio.trim() ? bio.trim() : null,
      });
      // 保存后重新拉一次：导航栏、作者主页、本地快照都跟着更新
      await refresh();
      setNotice('资料已保存');
    } catch (err) {
      const parsed = parseFormError(err);
      setFieldErrors(parsed.fields);
      setError(parsed.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wrap profile-page">
      <header className="profile-head">
        {showAvatar ? (
          <img
            className="profile-avatar"
            src={user.avatar_url ?? ''}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBrokenAvatar(user.avatar_url)}
          />
        ) : (
          <div className="profile-avatar profile-avatar--fallback" aria-hidden="true">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <span className="kicker">个人中心 / ACCOUNT</span>
          <h1>{user.username}</h1>
          <p className="profile-meta">
            {user.email} · 加入于 {formatDateTime(user.created_at)}
          </p>
        </div>
      </header>

      <div className="profile-grid">
        <form className="profile-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="form-notice">{notice}</p>}

          <div className="field">
            <label className="field-label" htmlFor="profile-avatar">
              头像链接
            </label>
            <input
              id="profile-avatar"
              className="field-input"
              type="url"
              placeholder="https://example.com/avatar.png"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
            {fieldErrors.avatarUrl ? (
              <p className="field-error">{fieldErrors.avatarUrl}</p>
            ) : (
              <p className="field-hint">留空则显示用户名首字母。第一版不提供图片上传。</p>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="profile-bio">
              个人简介
            </label>
            <textarea
              id="profile-bio"
              className="editor-content profile-bio"
              maxLength={300}
              placeholder="一两句话介绍自己，会显示在作者主页。"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
            {fieldErrors.bio ? (
              <p className="field-error">{fieldErrors.bio}</p>
            ) : (
              <p className="field-hint">{bio.length} / 300</p>
            )}
          </div>

          <button className="btn-submit" type="submit" disabled={pending}>
            {pending ? '保存中…' : '保存修改'}
          </button>
        </form>

        <aside className="profile-side">
          <p className="side-title">我的内容</p>
          <Link className="side-link" to="/me/articles">
            我的文章
            <span>管理草稿与已发布</span>
          </Link>
          <Link className="side-link" to="/write">
            写新文章
            <span>技术文章或日常思考</span>
          </Link>
          <Link className="side-link" to={`/users/${user.id}`}>
            我的主页
            <span>别人看到的作者页</span>
          </Link>
          <button className="side-link" type="button" onClick={() => void signOut()}>
            退出登录
            <span>退出后需要重新登录</span>
          </button>
        </aside>
      </div>
    </div>
  );
}
