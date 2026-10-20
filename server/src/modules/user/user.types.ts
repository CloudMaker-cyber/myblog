export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'disabled';

/** 数据库里查出来的完整用户行（含内部字段，绝不直接返回给前端） */
export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  token_version: number;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

/** 本人视角：包含邮箱，不包含状态与版本号 */
export type SelfUser = Omit<AuthUser, 'status' | 'token_version'>;

/** 公开视角：不含邮箱（PRD 要求邮箱不对其他用户公开） */
export type PublicUser = Pick<AuthUser, 'id' | 'username' | 'avatar_url' | 'bio' | 'created_at'>;

export function toSelfUser(user: AuthUser): SelfUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url,
    bio: user.bio,
    created_at: user.created_at,
  };
}

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
    bio: user.bio,
    created_at: user.created_at,
  };
}
