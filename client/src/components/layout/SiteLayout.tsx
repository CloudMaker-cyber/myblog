import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../features/auth/AuthContext';

export function SiteLayout() {
  const { user, status, signOut } = useAuth();

  async function handleSignOut(): Promise<void> {
    await signOut();
  }

  return (
    <>
      <header className="masthead">
        <div className="wrap masthead-inner">
          <Link to="/" className="masthead-name">
            MyBlog
          </Link>
          <p className="masthead-meta">技术文章与日常思考</p>
        </div>
      </header>

      <div className="wrap">
        <div className="rule-double" />
      </div>

      <div className="nav-bar">
        <div className="wrap nav-inner">
          <nav className="nav-links">
            <NavLink to="/" end>
              首页
            </NavLink>
            {user && (
              <>
                <NavLink to="/write">写文章</NavLink>
                <NavLink to="/me/articles">我的文章</NavLink>
              </>
            )}
          </nav>

          <div className="nav-actions">
            {status === 'loading' ? (
              // 刷新页面时登录态还在恢复：先占位，避免先闪一下「登录/注册」再跳成用户名
              <span className="nav-loading" aria-hidden="true" />
            ) : user ? (
              <>
                <span className="nav-user">{user.username}</span>
                <button type="button" className="link-quiet" onClick={() => void handleSignOut()}>
                  退出
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="link-quiet">
                  登录
                </Link>
                <Link to="/register" className="btn-primary">
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <main>
        <Outlet />
      </main>

      <footer className="site-foot wrap">
        <span>MyBlog · 多用户博客平台</span>
        <span>第一版</span>
      </footer>
    </>
  );
}
