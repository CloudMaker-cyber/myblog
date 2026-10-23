/**
 * EdgeOne Makers 的路由规则：`cloud-functions/api/[[default]].js` 匹配 `/api/*`。
 *
 * 注意这里必须写成「先 import、再 export default」。
 * 平台靠静态分析识别入口：`export { default } from '...'` 这种转导出不会被识别，
 * 结果就是函数不上线、/api/* 全部 404（已实测踩过）。
 */
import app from "../../server/dist/edge.js";

export default app;
