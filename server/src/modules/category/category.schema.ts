import { z } from 'zod';

/** 分类名：管理员维护，1–30 字符，唯一 */
export const categoryNameSchema = z.object({
  name: z.string().trim().min(1, '分类名不能为空').max(30, '分类名最多 30 个字符'),
});

export type CategoryNameInput = z.infer<typeof categoryNameSchema>;
