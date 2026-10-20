import type { AuthUser } from './auth.api';

const USER_KEY = 'myblog.user';

/**
 * 把当前用户的一份"快照"存在本地，用于刷新时立刻渲染登录态。
 *
 * 它只是显示用的缓存，不是权威数据：
 * 每次启动仍会请求 /users/me 核对，服务端说了算。
 * 所以这里只存非敏感字段——邮箱、token_version、账号状态都不进来。
 */
export function saveCachedUser(user: AuthUser): void {
  try {
    const snapshot = {
      id: user.id,
      username: user.username,
      role: user.role,
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at,
      email: '',
    };
    window.localStorage.setItem(USER_KEY, JSON.stringify(snapshot));
  } catch {
    // 存不进去就退回"等 /me 返回"的老路，不影响功能
  }
}

export function readCachedUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const candidate = parsed as Partial<AuthUser>;
    if (typeof candidate.id !== 'number' || typeof candidate.username !== 'string') {
      return null;
    }

    return {
      id: candidate.id,
      username: candidate.username,
      email: typeof candidate.email === 'string' ? candidate.email : '',
      role: candidate.role === 'admin' ? 'admin' : 'user',
      avatar_url: typeof candidate.avatar_url === 'string' ? candidate.avatar_url : null,
      bio: typeof candidate.bio === 'string' ? candidate.bio : null,
      created_at: typeof candidate.created_at === 'string' ? candidate.created_at : '',
    };
  } catch {
    return null;
  }
}

export function clearCachedUser(): void {
  try {
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // 忽略
  }
}
