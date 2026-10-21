import { z } from 'zod';

/**
 * 密码规则：8–64 位，必须同时含字母和数字。
 *
 * 上限 64 不是随意的：bcrypt 只处理前 72 字节，超过部分会被静默截断，
 * 意味着 80 位和 72 位其实是同一个密码。与其让人误以为更长更安全，
 * 不如在入口就限制住。
 */
const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(64, '密码最多 64 位')
  .regex(/[A-Za-z]/, '密码需要包含字母')
  .regex(/[0-9]/, '密码需要包含数字');

const usernameSchema = z
  .string()
  .trim()
  .min(3, '用户名至少 3 个字符')
  .max(30, '用户名最多 30 个字符')
  .regex(/^[\p{L}\p{N}_]+$/u, '用户名只能包含中文、字母、数字或下划线');

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.email('邮箱格式不正确').max(120, '邮箱最多 120 个字符'),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, '请输入用户名或邮箱').max(120),
  password: z.string().min(1, '请输入密码').max(64),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * 个人资料：两个字段都可以单独改。
 * 字段名用 camelCase，与其他接口（coverUrl、showToc）保持一致，
 * 到 repository 里再映射成数据库的 snake_case 列名。
 */
export const updateProfileSchema = z.object({
  avatarUrl: z.url('头像必须是合法的 URL').max(500, '头像链接最多 500 个字符').nullish(),
  bio: z.string().trim().max(300, '简介最多 300 个字符').nullish(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
