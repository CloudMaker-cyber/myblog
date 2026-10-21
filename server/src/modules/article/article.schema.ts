import { z } from 'zod';

/**
 * 标签由作者自由填写，所以这里只约束"数量与长度"，不约束内容。
 * 去重与空值处理放在 service 里做，schema 只管形状。
 */
const tagsSchema = z
  .array(z.string().trim().min(1, '标签不能为空').max(20, '单个标签最多 20 个字符'))
  .max(8, '标签最多 8 个')
  .default([]);

const baseArticleSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题最多 120 个字符'),
  content: z.string().min(1, '正文不能为空').max(100000, '正文过长，请控制在 10 万字符以内'),
  type: z.enum(['tech', 'life']),
  categoryId: z.number().int().positive('请选择一个分类'),
  tags: tagsSchema,
  coverUrl: z.string().trim().max(500).url('封面图必须是合法链接').nullish(),
  status: z.enum(['draft', 'published']),
});

export const createArticleSchema = baseArticleSchema;
export type CreateArticleInput = z.infer<typeof createArticleSchema>;

/**
 * PATCH 允许只改一部分字段。
 * 注意 `.partial()` 之后 `tags` 的默认值不再生效——没传就是没传，
 * 服务层据此区分"不改标签"和"清空标签"。
 */
export const updateArticleSchema = baseArticleSchema.partial();
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
