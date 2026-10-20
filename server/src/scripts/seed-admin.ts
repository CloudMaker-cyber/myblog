import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';

import { execute, pool, query } from '../db.js';

type SeedRow = RowDataPacket & {
  id: number;
  username: string;
  email: string;
  role: string;
};

/**
 * 创建 / 重置管理员账号。
 *
 * 密码只从命令行参数读，不写死在代码或 SQL 里，
 * 因此它不会出现在仓库、也不会出现在 git 历史中。
 *
 * 用法：
 *   npm run seed:admin -- <用户名> <邮箱> <密码>
 */
async function main(): Promise<void> {
  const [username, email, password] = process.argv.slice(2);

  if (!username || !email || !password) {
    console.error('用法：npm run seed:admin -- <用户名> <邮箱> <密码>');
    process.exitCode = 1;
    return;
  }

  if (password.length < 8 || password.length > 64) {
    console.error('密码长度需在 8–64 位之间（bcrypt 只认可前 72 字节）');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // 用户名或邮箱已存在时，直接覆盖密码与角色，便于反复执行
  await execute(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES (?, ?, ?, 'admin') AS new
     ON DUPLICATE KEY UPDATE password_hash = new.password_hash, role = 'admin'`,
    [username, email, passwordHash],
  );

  const rows = await query<SeedRow[]>(
    'SELECT id, username, email, role FROM users WHERE username = ? OR email = ? LIMIT 1',
    [username, email],
  );

  const row = rows[0];
  if (!row) {
    console.error('写入后没有查到账号，请检查数据库连接');
    process.exitCode = 1;
    return;
  }

  console.log(`管理员已就绪：id=${row.id} 用户名=${row.username} 邮箱=${row.email} 角色=${row.role}`);
  console.log('密码不在任何地方输出，请用你刚才输入的那个登录。');
}

main()
  .catch((error: unknown) => {
    console.error('[seed:admin] 失败：', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
