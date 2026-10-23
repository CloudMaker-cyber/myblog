-- 把历史数据从"服务器本地时间（+08）"转换成 UTC。**只执行一次。**
--
-- 背景：第一版写入时间时用的是服务器本地时间，数据库统一按 UTC 之后，
-- 老数据会被当成 UTC 显示，结果整体晚 8 小时。
--
-- 如果你不打算保留现有数据（比如部署时全新库），这个脚本不需要执行。
-- 重复执行会再次减 8 小时，请勿重复跑。

UPDATE users
   SET created_at = DATE_SUB(created_at, INTERVAL 8 HOUR),
       updated_at = DATE_SUB(updated_at, INTERVAL 8 HOUR);

UPDATE categories
   SET created_at = DATE_SUB(created_at, INTERVAL 8 HOUR);

UPDATE articles
   SET created_at = DATE_SUB(created_at, INTERVAL 8 HOUR),
       updated_at = DATE_SUB(updated_at, INTERVAL 8 HOUR),
       published_at = DATE_SUB(published_at, INTERVAL 8 HOUR)
 WHERE published_at IS NOT NULL;
