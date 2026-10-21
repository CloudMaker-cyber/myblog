/* eslint-disable react-refresh/only-export-components -- 这个文件同时导出 Provider 和 useAuth，两者必须共享同一个 context 实例 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, UNAUTHORIZED_EVENT, clearToken, getToken, setToken } from '../../lib/api';
import {
  fetchMe,
  loginRequest,
  logoutRequest,
  registerRequest,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from './auth.api';
import { clearCachedUser, readCachedUser, saveCachedUser } from './session-storage';

type AuthStatus = 'loading' | 'ready';

export type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** 重新从服务端拉一次用户信息（改完资料后用，保证导航栏和缓存同步） */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  /**
   * 两处初始化都要读本地：
   * - 有 token 且有用户快照 → 立刻以登录态渲染（不再等 /me，消除刷新闪烁）；
   * - 有 token 但没有快照 → 只能等 /me，status 留在 loading；
   * - 没有 token → 直接 ready，未登录用户不该看到任何占位。
   */
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? readCachedUser() : null));
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!getToken()) return 'ready';
    return readCachedUser() ? 'ready' : 'loading';
  });

  /**
   * 后台核对：快照只是显示用的，账号是否被禁用、是否已退出、角色有没有变，
   * 一律以服务端返回为准。
   */
  useEffect(() => {
    // 没有 token 时 status 初始化已经是 ready，这里什么都不用做
    if (!getToken()) return;

    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchMe();
        if (cancelled) return;
        setUser(result.user);
        saveCachedUser(result.user);
      } catch (error) {
        if (cancelled) return;

        // 只有"身份不认了"才清空；网络抖动时保留缓存，不能因为一次失败就把人踢下线
        const rejected = error instanceof ApiError && (error.status === 401 || error.status === 403);
        if (rejected) {
          clearToken();
          clearCachedUser();
          setUser(null);
        }
      } finally {
        if (!cancelled) setStatus('ready');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** 任意请求返回 401 时，api 层广播事件，这里统一清空登录态与快照 */
  useEffect(() => {
    function handleUnauthorized(): void {
      clearToken();
      clearCachedUser();
      setUser(null);
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const signIn = useCallback(async (input: LoginInput) => {
    const result = await loginRequest(input);
    setToken(result.token);
    saveCachedUser(result.user);
    setUser(result.user);
  }, []);

  const signUp = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input);
    setToken(result.token);
    saveCachedUser(result.user);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // 即使请求失败也要清本地：用户点了退出，界面就该退出
      clearToken();
      clearCachedUser();
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const result = await fetchMe();
    setUser(result.user);
    saveCachedUser(result.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, signIn, signUp, signOut, refresh }),
    [user, status, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 <AuthProvider> 内部使用');
  }
  return context;
}
