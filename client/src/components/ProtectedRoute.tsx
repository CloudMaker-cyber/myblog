import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../features/auth/AuthContext';

/**
 * 需要登录的页面外面套一层。
 * 注意：这里只是"界面层面的拦截"，真正的权限判断永远在后端——
 * 前端隐藏按钮挡不住直接拿 token 调接口的人。
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <p className="wrap page-loading">正在确认登录状态…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
