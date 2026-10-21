-- 初始分类种子数据
-- 分类由管理员维护（M5 做管理界面），这里先给出四个能用的起点。
-- 用 INSERT IGNORE：重复执行不会报错，已存在的分类名会被跳过（name 上有唯一键）。

INSERT IGNORE INTO categories (name) VALUES
  ('工程实践'),
  ('数据库'),
  ('学习记录'),
  ('生活');
