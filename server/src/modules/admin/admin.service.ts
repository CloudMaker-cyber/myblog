import { AppError } from '../../lib/http-error.js';
import type { AuthUser, UserStatus } from '../user/user.types.js';
import { bumpTokenVersion } from '../user/user.repository.js';
import {
  countUsers,
  findAdminUserById,
  listUsersForAdmin,
  updateUserStatus,
  type AdminUser,
} from './admin.repository.js';

export type PagedAdminUsers = {
  users: AdminUser[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export async function listUsers(page: number, pageSize: number): Promise<PagedAdminUsers> {
  const [users, total] = await Promise.all([listUsersForAdmin(page, pageSize), countUsers()]);

  return {
    users,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/**
 * 禁用 / 恢复账号。
 *
 * 两个必须拦住的点：
 * 1. 管理员不能禁用自己——否则一次误操作就把管理入口锁死了；
 * 2. 禁用时同时把 token_version + 1，让已发出的 token 立即作废；
 *    否则恢复账号后，旧 token 会"复活"继续可用。
 */
export async function changeUserStatus(
  actor: AuthUser,
  targetId: number,
  status: UserStatus,
): Promise<AdminUser> {
  if (actor.id === targetId) {
    throw new AppError(400, 'CANNOT_MODIFY_SELF', '不能修改自己的账号状态');
  }

  const target = await findAdminUserById(targetId);
  if (!target) {
    throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
  }

  if (target.status !== status) {
    await updateUserStatus(targetId, status);

    if (status === 'disabled') {
      // 让该用户手上所有 token 立刻失效
      await bumpTokenVersion(targetId);
    }
  }

  const updated = await findAdminUserById(targetId);
  if (!updated) {
    throw new AppError(500, 'INTERNAL_ERROR', '更新后读取用户失败');
  }
  return updated;
}
