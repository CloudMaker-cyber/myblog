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
  /** 作者可选：是否在详情页顶部显示由正文标题生成的目录 */
  showToc: z.boolean().default(false),
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

/**
 * 公开列表的查询参数。z.coerce 负责把字符串转成数字：
 * 查询串里的一切都是字符串，`page=2` 拿到的是 "2" 而不是 2。
 */
export const listArticlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1, '页码至少为 1').default(1),
  pageSize: z.coerce.number().int().min(1, '每页至少 1 条').max(50, '每页最多 50 条').default(10),
  type: z.enum(['tech', 'life']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100, '搜索词最多 100 个字符').optional(),
  tag: z.string().trim().min(1, '标签不能为空').max(20, '标签最多 20 个字符').optional(),
});

export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;
