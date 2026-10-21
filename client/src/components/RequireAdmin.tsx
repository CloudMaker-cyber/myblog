import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';

/** 管理页守卫：未登录去登录，登录了但不是管理员就明说，不偷偷跳走 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <p className="wrap page-loading">正在确认登录状态…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== 'admin') {
    return (
      <div className="wrap blocked-state">
        <span className="kicker">管理 / ADMIN</span>
        <h1>需要管理员权限</h1>
        <p className="blocked-desc">
          这个页面只有管理员能进。如果你认为这是误判，请联系站点管理员调整账号角色。
        </p>
        <div className="blocked-actions">
          <Link to="/" className="btn-primary">
            回首页
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
