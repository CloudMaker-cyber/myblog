# 接口文档

> 本文档随每轮开发更新。约定见 [项目规范](../AGENTS.md) 第七节。
> 所有业务接口都在 `/api/v1` 下，健康检查除外。

## 通用约定

**认证**：需要登录的接口在请求头带 `Authorization: Bearer <token>`。token 由注册/登录接口返回，有效期 7 天。

**错误响应**统一为一种形状：

```json
{
  "error": {
    "code": "EMAIL_TAKEN",
    "message": "该邮箱已被注册",
    "details": [{ "field": "email", "message": "该邮箱已被注册" }]
  }
}
```

| 状态码 | 含义 |
|---|---|
| 200 | 查询或更新成功 |
| 201 | 创建成功 |
| 204 | 删除成功，无响应体 |
| 400 | 参数格式错误（`VALIDATION_FAILED` 等） |
| 401 | 未登录或凭据失效（`UNAUTHORIZED` / `TOKEN_INVALID` / `TOKEN_REVOKED` / `INVALID_CREDENTIALS`） |
| 403 | 已登录但无权限（`FORBIDDEN` / `ACCOUNT_DISABLED`） |
| 404 | 资源不存在（草稿对非作者一律返回 404，避免泄露存在性） |
| 409 | 唯一性冲突（`USERNAME_TAKEN` / `EMAIL_TAKEN`） |
| 413 | 请求体过大（上限 1MB） |
| 429 | 请求过于频繁（登录/注册 15 分钟 20 次） |

## 系统

### GET /api/health

不需要认证。返回 `{ "status": "ok", "db": "ok", "time": "..." }`，内部会执行一次 `SELECT 1`。

## 账号

### POST /api/v1/users — 注册

请求体：

```json
{ "username": "lawliet", "email": "a@example.com", "password": "Test12345" }
```

| 字段 | 规则 |
|---|---|
| username | 3–30 字符，中文/字母/数字/下划线，唯一且不可修改 |
| email | 合法邮箱，最多 120 字符，唯一 |
| password | 8–64 位，必须同时含字母和数字 |

成功：`201`，返回 `{ "token": "...", "user": { ... } }`。

### POST /api/v1/sessions — 登录

请求体：`{ "identifier": "邮箱或用户名", "password": "..." }`

成功：`200`，返回 `{ "token": "...", "user": { ... } }`。

失败统一返回 `401 INVALID_CREDENTIALS`（不区分"用户不存在"和"密码错误"）。

### DELETE /api/v1/sessions/current — 退出

需要认证。成功：`204`。服务端把该用户的 `token_version + 1`，此前签发的所有 token 立即失效。

### GET /api/v1/users/me — 当前登录用户

需要认证。成功：`200`，返回 `{ "user": { id, username, email, role, avatar_url, bio, created_at } }`。

### PATCH /api/v1/users/me — 修改头像与简介

需要认证。请求体（两个字段都可单独传）：

```json
{ "avatarUrl": "https://example.com/a.png", "bio": "一两句话介绍自己" }
```

| 字段 | 规则 |
|---|---|
| avatarUrl | 合法 URL，≤500 字符；传 `null` 或空串表示清空（界面回落成用户名首字母） |
| bio | ≤300 字符；传 `null` 或空串表示清空 |

只传其中一个字段时，另一个保持不变。成功：`200`，返回更新后的 `{ "user": { ... } }`。

### GET /api/v1/users/:id — 作者公开资料

不需要认证。成功：`200`，返回 `{ "user": { id, username, avatar_url, bio, created_at } }`，**不含邮箱**。

### GET /api/v1/users/:id/articles — 作者的已发布文章

不需要认证。支持分页参数（见下）。返回结构与文章列表相同。

## 分类

### GET /api/v1/categories

不需要认证。成功：`200`，返回 `{ "categories": [{ "id": 2, "name": "工程实践" }] }`，按 id 升序（即创建顺序）。

## 文章

### GET /api/v1/articles — 公开列表

不需要认证。只返回 `status = published` 的文章，按 `published_at` 倒序。

| 查询参数 | 说明 | 默认 |
|---|---|---|
| page | 页码，≥1 | 1 |
| pageSize | 每页条数，1–50 | 10 |
| type | `tech` / `life` | 不限 |
| categoryId | 分类 id | 不限 |
| q | 标题关键词，≤100 字符（只匹配标题） | 不限 |
| tag | 标签名（≤20 字符）。按**标签相关度**检索：完全相同的排最前，名称包含关系（如「缓存」与「缓存设计」）次之，拼写接近的再次；同分按发布时间倒序 | 不限 |

成功：`200`

```json
{
  "articles": [
    {
      "id": 8,
      "title": "...",
      "excerpt": "正文前 180 字",
      "type": "life",
      "status": "published",
      "cover_url": null,
      "show_toc": false,
      "view_count": 4,
      "published_at": "2026-10-21 12:04:11",
      "created_at": "...",
      "updated_at": "...",
      "category": { "id": 2, "name": "工程实践" },
      "author": { "id": 4, "username": "lawliet" },
      "tags": ["数据库"]
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "total": 2, "totalPages": 1 }
}
```

### POST /api/v1/articles — 新建文章

需要认证。请求体：

```json
{
  "title": "标题",
  "content": "Markdown 正文",
  "type": "tech",
  "categoryId": 2,
  "tags": ["数据库", "约束"],
  "coverUrl": null,
  "showToc": false,
  "status": "draft"
}
```

| 字段 | 规则 |
|---|---|
| title | 1–120 字符 |
| content | 1–100000 字符 |
| type | `tech` / `life`，必选 |
| categoryId | 必须是已存在的分类 |
| tags | 最多 8 个，每个 ≤20 字符；相同标签自动复用 |
| coverUrl | 可空；填写时必须是合法 URL，≤500 字符 |
| showToc | 布尔，默认 `false`。为 `true` 时详情页在正文前渲染目录（由正文的 `##`、`###` 自动生成） |
| status | `draft` / `published` |

成功：`201`，返回 `{ "article": { ...含 content... } }`。首次发布时写入 `published_at`。

### GET /api/v1/articles/mine — 我的文章

需要认证。可选参数 `status=draft|published`。返回 `{ "articles": [...] }`（不含 `content`），按更新时间倒序。

### GET /api/v1/articles/:id — 文章详情

不需要认证（可选带 token）。草稿只有作者本人和管理员能看，其他人一律 `404`。

已发布文章每次请求使 `view_count + 1`（第一版不做防刷）。

### PATCH /api/v1/articles/:id — 部分更新

需要认证，且必须是作者本人。请求体字段与新建相同，但**全部可选**。

- 不传 `tags` 表示"保持原标签不变"，传 `[]` 表示"清空标签"。
- `published_at` 只在首次发布时写入，之后编辑不会变。
- 已发布文章改成 `draft` 等于下线，公开列表立刻看不到。

成功：`200`，返回更新后的 `article`。

### DELETE /api/v1/articles/:id — 删除

需要认证。作者可删自己的，管理员可删任何人的。物理删除，关联标签关系级联删除。

成功：`204`。

## 管理（仅管理员）

整个 `/api/v1/admin` 命名空间都要求认证且 `role = admin`：未登录返回 `401`，非管理员返回 `403`。

### GET /api/v1/admin/categories — 分类列表（带文章数）

返回 `{ "categories": [{ "id": 2, "name": "工程实践", "article_count": 8 }] }`。`article_count` 用于在删除前给出有依据的提示。

### POST /api/v1/admin/categories — 新增分类

请求体 `{ "name": "性能优化" }`，1–30 字符且唯一。

成功：`201`。重名返回 `409 CATEGORY_TAKEN`。

### PATCH /api/v1/admin/categories/:id — 重命名

请求体同上。成功：`200`。分类不存在 `404`，重名 `409`。

### DELETE /api/v1/admin/categories/:id — 删除分类

成功：`204`。

分类下还有文章时返回 `409 CATEGORY_IN_USE`，消息里带上文章数量。数据库外键本身是 `RESTRICT`，这一层只是为了把"数据库拒绝"翻译成人话。

### GET /api/v1/admin/articles — 全部文章

| 查询参数 | 说明 | 默认 |
|---|---|---|
| page / pageSize | 分页，pageSize 上限 50 | 1 / 10 |
| status | `draft` / `published` | 不限（草稿也返回） |
| type | `tech` / `life` | 不限 |
| q | 标题关键词 | 不限 |

返回结构与公开列表相同，按更新时间倒序。

### GET /api/v1/admin/users — 全部用户

查询参数：`page`、`pageSize`（上限 100，默认 20）。

返回 `{ "users": [{ id, username, email, role, status, created_at, article_count }], "pagination": {...} }`。

### PATCH /api/v1/admin/users/:id/status — 禁用 / 恢复账号

请求体 `{ "status": "disabled" }` 或 `{ "status": "active" }`。

- 成功：`200`，返回更新后的 user。
- 禁用自己返回 `400 CANNOT_MODIFY_SELF`。
- 禁用会把该用户的 `token_version + 1`，其已登录的会话立即失效；恢复账号不会让旧 token 复活。
- 被禁用账号的已发布文章**仍然公开可见**（PRD 要求）。
