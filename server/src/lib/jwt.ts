import jwt, { type SignOptions } from 'jsonwebtoken';

import { config } from '../config.js';

export type AccessTokenPayload = {
  /** 用户 id，JWT 规范要求是字符串 */
  sub: string;
  /** 签发时的 token_version，用于让旧票立即失效 */
  ver: number;
};

export function signAccessToken(userId: number, tokenVersion: number): string {
  const payload: AccessTokenPayload = { sub: String(userId), ver: tokenVersion };
  const options: SignOptions = {
    expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

/**
 * 只验签名和过期时间。用户是否被禁用、token_version 是否过期，
 * 必须再查一次数据库才能判断——签名有效不代表账号还能用。
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as AccessTokenPayload;
}
