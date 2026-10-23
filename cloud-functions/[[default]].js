/**
 * EdgeOne Makers（Node Functions）的入口约定：
 * - 目录固定在项目根部的 cloud-functions/
 * - 用 Express 时文件名必须是 [[default]].js
 * - 必须 default 导出一个 Express 实例，不要自己 listen
 *
 * 真正实现在服务端的编译产物里（server/src/edge.ts → server/dist/edge.js）。
 * 部署时先执行根目录的 `npm run build`，它会把后端和前端都构建好。
 */
export { default } from '../server/dist/edge.js';
