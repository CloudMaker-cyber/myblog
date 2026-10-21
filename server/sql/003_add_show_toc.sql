-- 文章目录开关：由作者决定是否在详情页顶部显示目录
-- 默认 0（不显示），作者在写作台勾选后才会出现在文章开头

ALTER TABLE articles
  ADD COLUMN show_toc TINYINT(1) NOT NULL DEFAULT 0 AFTER cover_url;
