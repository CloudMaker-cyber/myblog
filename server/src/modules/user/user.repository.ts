import type { RowDataPacket } from 'mysql2';

import { execute, query } from '../../db.js';
import type { AuthUser } from './user.types.js';

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  email: string;
  role: AuthUser['role'];
  status: AuthUser['status'];
  token_version: number;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

type UserRowWithPassword = UserRow & { password_hash: string };

// 显式列出字段，而不是 SELECT *：新增敏感列时不会意外把它返回出去
const PUBLIC_COLUMNS = 'id, username, email, role, status, token_version, avatar_url, bio, created_at';

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    token_version: row.token_version,
    avatar_url: row.avatar_url,
    bio: row.bio,
    created_at: row.created_at,
  };
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  const rows = await query<UserRow[]>(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  const row = rows[0];
  return row ? toAuthUser(row) : null;
}

/** 登录时用：用户名或邮箱都能登录，所以两个条件都查 */
export async function findUserWithPassword(identifier: string): Promise<(AuthUser & { password_hash: string }) | null> {
  const rows = await query<UserRowWithPassword[]>(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = ? OR username = ? LIMIT 1`,
    [identifier, identifier],
  );
  const row = rows[0];
  if (!row) return null;
  return { ...toAuthUser(row), password_hash: row.password_hash };
}

/** 注册前查重，返回已存在的那一行，便于告诉前端到底是用户名还是邮箱冲突 */
export async function findConflict(username: string, email: string): Promise<{ username: string; email: string } | null> {
  const rows = await query<UserRow[]>(
    'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
    [username, email],
  );
  const row = rows[0];
  return row ? { username: row.username, email: row.email } : null;
}

export async function createUser(input: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<number> {
  const result = await execute(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [input.username, input.email, input.passwordHash],
  );
  return result.insertId;
}

/** 退出登录 / 封号时调用：版本号 +1，此前签发的票全部作废 */
export async function bumpTokenVersion(userId: number): Promise<void> {
  await execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
}

export async function updateUserProfile(
  userId: number,
  input: { avatarUrl: string | null; bio: string | null },
): Promise<void> {
  await execute('UPDATE users SET avatar_url = ?, bio = ? WHERE id = ?', [
    input.avatarUrl,
    input.bio,
    userId,
  ]);
}
