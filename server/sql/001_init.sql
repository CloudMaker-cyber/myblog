-- MyBlog 第一版数据库结构
-- 执行方式（MySQL 8.0+）：
--   mysql -u myblog_app -p myblog < sql/001_init.sql
-- 或在 MySQL Workbench 里打开本文件直接执行。
-- 所有语句都带 IF NOT EXISTS，可以重复执行，不会因为已存在而中断。

-- ---------------------------------------------------------------------------
-- 1. 用户
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(30)   NOT NULL,
  email         VARCHAR(120)  NOT NULL,
  -- 只存 bcrypt 哈希（60 字符），明文密码永不入库
  password_hash VARCHAR(100)  NOT NULL,
  avatar_url    VARCHAR(500)  NULL,
  bio           VARCHAR(300)  NULL,
  role          ENUM('user', 'admin')      NOT NULL DEFAULT 'user',
  status        ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  -- 退出登录 / 封号时 +1，使旧 JWT 立即失效
  token_version INT UNSIGNED  NOT NULL DEFAULT 0,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_username (username),
  UNIQUE KEY uk_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 2. 分类（管理员维护）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(30) NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_categories_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 3. 文章
--    type   = 文章类型（技术文章 / 日常思考），必选
--    status = 草稿 / 已发布
--    published_at 只在“首次发布”时写入，之后编辑不改，首页排序以它为准
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  author_id    BIGINT UNSIGNED NOT NULL,
  category_id  BIGINT UNSIGNED NOT NULL,
  title        VARCHAR(120)  NOT NULL,
  content      MEDIUMTEXT    NOT NULL,
  type         ENUM('tech', 'life')           NOT NULL,
  cover_url    VARCHAR(500)  NULL,
  status       ENUM('draft', 'published')     NOT NULL DEFAULT 'draft',
  view_count   INT UNSIGNED  NOT NULL DEFAULT 0,
  published_at DATETIME      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_articles_author
    FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
  -- RESTRICT：分类下还有文章时，删除分类会被数据库直接拒绝，
  -- 这就是“有文章的分类不允许删除”的最终防线
  CONSTRAINT fk_articles_category
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  -- 公开列表永远带 status = 'published'，所以把 status 放在索引最左边
  KEY idx_articles_home     (status, published_at DESC),
  KEY idx_articles_type     (status, type, published_at DESC),
  KEY idx_articles_category (status, category_id, published_at DESC),
  KEY idx_articles_author   (author_id, status, published_at DESC)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 4. 标签（作者自由填写）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
  id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  UNIQUE KEY uk_tags_name (name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 5. 文章-标签（多对多；两边的级联删除保证不留下孤儿记录）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS article_tags (
  article_id BIGINT UNSIGNED NOT NULL,
  tag_id     BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  CONSTRAINT fk_at_article FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE,
  CONSTRAINT fk_at_tag     FOREIGN KEY (tag_id)     REFERENCES tags (id)     ON DELETE CASCADE,
  -- 反查“某个标签下有哪些文章”要按 tag_id 走索引，主键只覆盖 article_id 开头
  KEY idx_at_tag (tag_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
