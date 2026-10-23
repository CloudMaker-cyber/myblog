/**
 * EdgeOne Makers（Node Functions）的入口约定：
 * - 目录固定为 cloud-functions/
 * - 用 Express 时文件名必须是 [[default]].js
 * - 必须 default 导出一个 Express 实例，不要自己 listen
 *
 * 真正实现在编译产物里（src/edge.ts → dist/edge.js）。
 * 部署前先在本目录执行 `npm run build`，这样 dist/ 才是最新的。
 */
export { default } from '../dist/edge.js';
