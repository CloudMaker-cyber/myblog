import bcrypt from 'bcryptjs';

import { AppError } from '../../lib/http-error.js';
import { signAccessToken } from '../../lib/jwt.js';
import type { LoginInput } from '../user/user.schema.js';
import { bumpTokenVersion, findUserWithPassword } from '../user/user.repository.js';
import { toSelfUser } from '../user/user.types.js';
import type { AuthResult } from '../user/user.service.js';

/**
 * 用户不存在时也要跑一次 bcrypt 比较。
 * 否则"这个邮箱不存在"会比"密码错了"返回得更快，
 * 攻击者能靠响应时间判断出哪些邮箱已经注册过。
 */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function login(input: LoginInput): Promise<AuthResult> {
  const record = await findUserWithPassword(input.identifier);
  const passwordHash = record?.password_hash ?? DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(input.password, passwordHash);

  // 不区分"用户不存在"和"密码错误"：统一一句话，避免被用来枚举账号
  if (!record || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', '用户名或密码错误');
  }

  if (record.status === 'disabled') {
    throw new AppError(403, 'ACCOUNT_DISABLED', '该账号已被禁用');
  }

  return {
    token: signAccessToken(record.id, record.token_version),
    user: toSelfUser(record),
  };
}

/** 退出登录：token_version + 1，此前签发的票全部作废 */
export async function logout(userId: number): Promise<void> {
  await bumpTokenVersion(userId);
}
