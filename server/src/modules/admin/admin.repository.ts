import type { RowDataPacket } from 'mysql2';

import { execute, query } from '../../db.js';
import { limitClause } from '../../lib/pagination-sql.js';
import type { UserRole, UserStatus } from '../user/user.types.js';

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  article_count: number;
};

type AdminUserRow = RowDataPacket & {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  article_count: number;
};

const USER_COLUMNS = `
  u.id, u.username, u.email, u.role, u.status, u.created_at,
  COUNT(a.id) AS article_count
`;

const USER_GROUP_BY = 'GROUP BY u.id, u.username, u.email, u.role, u.status, u.created_at';

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    article_count: Number(row.article_count ?? 0),
  };
}

export async function listUsersForAdmin(page: number, pageSize: number): Promise<AdminUser[]> {
  const offset = (page - 1) * pageSize;

  const rows = await query<AdminUserRow[]>(
    `SELECT ${USER_COLUMNS}
       FROM users u
       LEFT JOIN articles a ON a.author_id = u.id
       ${USER_GROUP_BY}
       ORDER BY u.id ASC
       ${limitClause(pageSize, offset)}`,
  );

  return rows.map(toAdminUser);
}

export async function countUsers(): Promise<number> {
  const rows = await query<(RowDataPacket & { total: number })[]>(
    'SELECT COUNT(*) AS total FROM users',
  );
  return rows[0]?.total ?? 0;
}

export async function findAdminUserById(id: number): Promise<AdminUser | null> {
  const rows = await query<AdminUserRow[]>(
    `SELECT ${USER_COLUMNS}
       FROM users u
       LEFT JOIN articles a ON a.author_id = u.id
      WHERE u.id = ?
      ${USER_GROUP_BY}`,
    [id],
  );

  const row = rows[0];
  return row ? toAdminUser(row) : null;
}

export async function updateUserStatus(id: number, status: UserStatus): Promise<void> {
  await execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
}
