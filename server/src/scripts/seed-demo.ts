import type { RowDataPacket } from 'mysql2';

import { pool, query } from '../db.js';
import { createArticle } from '../modules/article/article.service.js';
import type { CreateArticleInput } from '../modules/article/article.schema.js';
import { findUserById, findUserWithPassword } from '../modules/user/user.repository.js';
import { register } from '../modules/user/user.service.js';
import type { AuthUser } from '../modules/user/user.types.js';

/**
 * 演示数据：两位示例作者 + 8 篇文章（含 1 篇草稿）。
 *
 * 设计要点：
 * - 标签故意做成"近似但不同"（缓存 / 缓存设计 / 本地缓存 / Redis 缓存），
 *   这样点任一标签都能看到相关度排序的效果；
 * - 部分文章开启目录（show_toc），正文带 ## / ### 标题；
 * - 可重复执行：用户按用户名查重，文章按"作者 + 标题"查重，已存在就跳过，不会重复插入。
 *
 * 用法：npm run seed:demo
 */
const DEMO_PASSWORD = 'Demo12345';

const AUTHORS = [
  { username: '示例作者', email: 'demo-author@example.com' },
  { username: '另一位作者', email: 'demo-author2@example.com' },
];

type DemoArticle = {
  authorIndex: 0 | 1;
  title: string;
  type: 'tech' | 'life';
  categoryName: string;
  tags: string[];
  showToc: boolean;
  status: 'draft' | 'published';
  content: string;
};

const ARTICLES: DemoArticle[] = [
  {
    authorIndex: 0,
    title: '把缓存当缓存用：我踩过的三个坑',
    type: 'tech',
    categoryName: '工程实践',
    tags: ['缓存', '性能'],
    showToc: true,
    status: 'published',
    content: `缓存最容易失败的地方，不是它不生效，而是它"看起来生效了"。

## 第一个坑：把缓存当数据库

只要缓存的过期时间设得足够长，你就会开始假设它一直在。于是某天缓存被清空，接口直接返回空数据，而所有测试都是绿的。

缓存必须是可以随时消失的：**消失后系统仍然正确，只是变慢**。做不到这一点，就不该叫缓存。

## 第二个坑：缓存键里带了不该带的东西

把用户 id 拼进键里，命中率会掉到地板；把时间戳拼进键里，等于没有缓存。

### 判断标准

问自己一句：这个键变化的时候，结果真的会变吗？如果不会，它就不该在键里。

## 第三个坑：只测命中的情况

大多数缓存 bug 出现在第一次请求（未命中）和缓存失效（过期）这两个瞬间，而这两个瞬间恰恰最容易被漏测。

> 上线前手动清一次缓存，不是为了制造事故，而是为了确认它扛得住。
`,
  },
  {
    authorIndex: 0,
    title: '缓存设计里的失效策略：先想清楚谁负责',
    type: 'tech',
    categoryName: '工程实践',
    tags: ['缓存设计', '架构'],
    showToc: true,
    status: 'published',
    content: `失效策略的争论，表面上是"先删缓存还是先写库"，本质上是"谁对数据一致性负责"。

## 三种常见做法

### 写后删缓存

最常见，也最容易出错：删缓存失败怎么办？重试几次？重试也失败呢？

### 过期兜底

给所有缓存一个过期时间，把"最终一致"变成时间问题。代价是一段时间内的脏读。

### 版本号

数据带版本，缓存键里带版本。写操作只递增版本，不删缓存，旧版本自然过期。复杂度上升，但一致性最可控。

## 我的建议

先明确业务能容忍多长时间的脏数据。超过这个时间的方案都不合格；在一堆合格方案里挑最简单的那一个。
`,
  },
  {
    authorIndex: 0,
    title: '本地缓存与分布式缓存，到底该选哪个',
    type: 'tech',
    categoryName: '工程实践',
    tags: ['本地缓存', '缓存设计'],
    showToc: false,
    status: 'published',
    content: `本地缓存快，但每台机器一份，更新时要所有机器同时失效。

分布式缓存只有一份，但每次读都要一次网络往返。

一个粗糙但够用的判断：

- 数据量小、变更少、能容忍短暂不一致 → 本地缓存
- 数据量大、变更频繁、必须一致 → 分布式缓存
- 两者都要？本地缓存做一级，分布式做二级，但要接受多一层失效逻辑

不要因为"本地缓存快"就默认选它，网络往返在同一个机房通常只有零点几毫秒。
`,
  },
  {
    authorIndex: 0,
    title: '用 Redis 做缓存前，先想清楚这三件事',
    type: 'tech',
    categoryName: '数据库',
    tags: ['Redis 缓存', '数据库'],
    showToc: true,
    status: 'published',
    content: `Redis 不是"更快的数据库"，它是一块可选的、会丢的内存。

## 一、数据丢了会怎样

如果 Redis 重启后你的服务无法工作，那你把它当成了数据库，而不是缓存。

## 二、内存上限是多少

不设上限，某天它会因为内存打满被系统杀掉。设了上限，就要选淘汰策略：是丢最久没用的，还是拒绝写入？

### 一个常见错误

把大 key 存进 Redis。单个 key 几 MB 时，一次读取就会卡住整个实例的事件循环。

## 三、监控什么

命中率、内存占用、慢查询。前两个掉下去说明设计有问题，第三个是事故的前兆。
`,
  },
  {
    authorIndex: 0,
    title: '索引为什么会失效：四个真实场景',
    type: 'tech',
    categoryName: '数据库',
    tags: ['索引', 'MySQL', '数据库'],
    showToc: true,
    status: 'published',
    content: `索引失效不是一个神秘现象，它只是"数据库没法用上你建的那个顺序"。

## 场景一：列上做了运算

WHERE DATE(created_at) = '2026-10-21' 会让索引失效，因为数据库要先对每一行算一次 DATE。

改成范围查询即可。

## 场景二：用了前导通配

LIKE '%关键词%' 无法走索引，只能全表扫。LIKE '关键词%' 可以。

## 场景三：类型不一致

字符串列用数字比较，会发生隐式转换，索引失效。

## 场景四：联合索引的最左前缀

索引 (a, b, c) 只能被 a、a+b、a+b+c 用上。直接查 b 用不上。

> 建索引前先想清楚查询长什么样，而不是建完再猜。
`,
  },
  {
    authorIndex: 0,
    title: '写文档这件事，比写代码更难',
    type: 'life',
    categoryName: '生活',
    tags: ['写作', '效率'],
    showToc: false,
    status: 'published',
    content: `代码写错了，测试会告诉你。文档写错了，没人会告诉你，它只是安静地误导后来的人。

我最近在改一个半年前写的模块，注释里写着"这里不需要处理并发"，而代码里有一把锁。我花了二十分钟才想明白，是注释过时了。

后来我给自己定了一条规矩：改代码时如果发现注释和代码对不上，先改注释，再改代码。

不是因为注释更重要，而是因为"发现不一致"这个瞬间很珍贵，一旦错过，下次可能就是三个月后。
`,
  },
  {
    authorIndex: 1,
    title: '前端状态管理的取舍：别急着引库',
    type: 'tech',
    categoryName: '工程实践',
    tags: ['React', '前端'],
    showToc: false,
    status: 'published',
    content: `大多数项目的状态没有复杂到需要专门的状态管理库。

先问三个问题：

1. 这些状态需要跨页面共享吗？
2. 它们的更新频率高吗？
3. 团队里有人能说清楚数据流向吗？

三个都答"是"，再考虑引库。否则 useState + 一层 Context 就够了。

引库的成本不是安装包的体积，而是新人要多学一套心智模型。
`,
  },
  {
    authorIndex: 0,
    title: '还没写完的草稿：关于重构的一些碎片',
    type: 'tech',
    categoryName: '工程实践',
    tags: ['重构', '草稿'],
    showToc: false,
    status: 'draft',
    content: `这篇只是演示用草稿，不会出现在任何公开列表里。

## 待补

- 重构的触发条件
- 什么时候该停
`,
  },
];

async function ensureUser(username: string, email: string): Promise<AuthUser> {
  const existing = await findUserWithPassword(username);
  if (existing) {
    const user = await findUserById(existing.id);
    if (user) return user;
  }

  const result = await register({ username, email, password: DEMO_PASSWORD });
  const user = await findUserById(result.user.id);
  if (!user) throw new Error(`创建用户失败：${username}`);
  return user;
}

async function findCategoryId(name: string): Promise<number> {
  const rows = await query<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM categories WHERE name = ? LIMIT 1',
    [name],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`分类不存在：${name}，请先执行 sql/002_seed_categories.sql`);
  return id;
}

async function articleExists(authorId: number, title: string): Promise<boolean> {
  const rows = await query<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM articles WHERE author_id = ? AND title = ? LIMIT 1',
    [authorId, title],
  );
  return rows.length > 0;
}

async function main(): Promise<void> {
  const authors: AuthUser[] = [];
  for (const item of AUTHORS) {
    authors.push(await ensureUser(item.username, item.email));
  }

  let created = 0;
  let skipped = 0;

  for (const item of ARTICLES) {
    const author = authors[item.authorIndex];
    if (!author) continue;

    if (await articleExists(author.id, item.title)) {
      skipped += 1;
      continue;
    }

    const categoryId = await findCategoryId(item.categoryName);
    const input: CreateArticleInput = {
      title: item.title,
      content: item.content,
      type: item.type,
      categoryId,
      tags: item.tags,
      coverUrl: null,
      showToc: item.showToc,
      status: item.status,
    };

    await createArticle(author, input);
    created += 1;
  }

  console.log(`演示数据就绪：新建 ${created} 篇，跳过已存在 ${skipped} 篇。`);
  console.log(`示例账号：${AUTHORS.map((item) => item.username).join(' / ')}`);
  console.log(`密码统一为：${DEMO_PASSWORD}（仅本地演示用）`);
}

main()
  .catch((error: unknown) => {
    console.error('[seed:demo] 失败：', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
