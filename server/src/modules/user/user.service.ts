import bcrypt from 'bcryptjs';

import { AppError } from '../../lib/http-error.js';
import { signAccessToken } from '../../lib/jwt.js';
import type { RegisterInput, UpdateProfileInput } from './user.schema.js';
import { createUser, findConflict, findUserById, updateUserProfile } from './user.repository.js';
import { toSelfUser, type AuthUser, type SelfUser } from './user.types.js';

/**
 * 成本因子 10：一次哈希约 100ms。
 * 这个"慢"是故意的——攻击者每试一个密码都要付出同样的代价。
 */
export const BCRYPT_COST = 10;

export type AuthResult = {
  token: string;
  user: SelfUser;
};

export async function register(input: RegisterInput): Promise<AuthResult> {
  const conflict = await findConflict(input.username, input.email);
  if (conflict) {
    if (conflict.username === input.username) {
      throw new AppError(409, 'USERNAME_TAKEN', '该用户名已被占用');
    }
    throw new AppError(409, 'EMAIL_TAKEN', '该邮箱已被注册');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const userId = await createUser({
    username: input.username,
    email: input.email,
    passwordHash,
  });

  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(500, 'INTERNAL_ERROR', '注册失败，请稍后重试');
  }

  return {
    token: signAccessToken(user.id, user.token_version),
    user: toSelfUser(user),
  };
}

/**
 * 更新个人资料。
 *
 * 三个字段都是"不传就不改"：只有显式传了才覆盖。
 * null 表示清空（比如把简介删掉），空字符串按 null 处理，
 * 否则数据库里会留下一个看起来有值、其实什么都没有的空串。
 */
export async function updateProfile(
  user: AuthUser,
  input: UpdateProfileInput,
): Promise<SelfUser> {
  const nextBio =
    input.bio === undefined ? user.bio : input.bio && input.bio.length > 0 ? input.bio : null;

  const nextAvatar =
    input.avatarUrl === undefined ? user.avatar_url : (input.avatarUrl ?? null);

  await updateUserProfile(user.id, { avatarUrl: nextAvatar, bio: nextBio });

  const updated = await findUserById(user.id);
  if (!updated) {
    throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
  }

  return toSelfUser(updated);
}
