import 'dotenv/config';
import { z } from 'zod';

/**
 * 环境变量的唯一入口。
 * 这里用 zod 校验一旦失败就直接退出，而不是让服务带着半截配置跑起来，
 * 然后在某个请求里报“Cannot read properties of undefined”。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_NAME: z.string().min(1),
  // 允许空字符串，但要求 .env 里必须显式写出这一行，避免“忘了配”和“密码为空”被混淆
  DB_PASSWORD: z.string(),
  /** 连接池上限。常驻服务用 10 够；Serverless 部署要调到 2–3，否则实例一多会打满数据库连接数 */
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  /** 云数据库通常要求加密连接，线上置为 true */
  DB_SSL: z.enum(['true', 'false']).default('false'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少 32 个字符'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`环境变量配置有误，服务无法启动：\n${details}`);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
