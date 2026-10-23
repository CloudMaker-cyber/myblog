import express from 'express';

import { app } from './app.js';

/**
 * Serverless / 框架托管模式的入口（EdgeOne Makers）。
 *
 * 两个平台差异都在这里兜住，业务代码不用知道：
 *
 * 1. 平台把函数挂在 `cloud-functions/api/[[default]].js`，
 *    调用时**会剥掉 `/api` 前缀**——Express 收到的是 `/v1/articles`。
 *    本地和常规部署收到的却是 `/api/v1/articles`，所以这里补回去。
 * 2. 平台在 CDN 后面，真实访客 IP 在 X-Forwarded-For 里。
 *    不声明 trust proxy，登录限流会把所有访客当成同一个 IP。
 *
 * 本地开发不受影响：`npm run dev` 走的是 `index.ts`。
 */
const edgeApp = express();

edgeApp.set('trust proxy', true);

edgeApp.use((req, _res, next) => {
  if (!req.url.startsWith('/api/')) {
    req.url = `/api${req.url}`;
  }
  next();
});

edgeApp.use(app);

export default edgeApp;
