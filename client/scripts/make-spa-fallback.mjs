/**
 * 构建后把 index.html 复制成 404.html。
 *
 * 为什么需要：这是单页应用（SPA），前端路由由 React Router 在浏览器里接管。
 * 但静态托管平台会先去磁盘找 `/login` 对应的文件，找不到就返回 404。
 * 放一个内容相同的 404.html，平台在"找不到文件"时就会返回它，
 * 于是 SPA 有机会加载并把 URL 交给 React Router 处理。
 *
 * 注意：这里的 404.html 必须是 index.html 的副本，而不是一个"抱歉页面"。
 */
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
await copyFile(resolve(distDir, "index.html"), resolve(distDir, "404.html"));
console.log("[build] 已生成 dist/404.html（SPA 回退）");
