import { app } from './app.js';

/**
 * Serverless / 框架托管模式的入口。
 *
 * 我们本来就把"组装 app"和"启动监听"分开了（`app.ts` 只返回 app，`index.ts` 才 listen），
 * 所以这里只需要把 app 导出，交给平台去调用——不需要自己 listen 端口。
 *
 * 本地开发不受影响：`npm run dev` 走的是 `index.ts`。
 */
export default app;
