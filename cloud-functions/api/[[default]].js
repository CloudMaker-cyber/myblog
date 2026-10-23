/**
 * EdgeOne Makers 的路由规则：`cloud-functions/api/[[default]].js` 匹配 `/api/*`。
 * 根目录下的 `[[default]].js` 不在官方映射表里，不会被注册成路由。
 *
 * Express 实例内部挂的是 `/api/v1/...`，平台把原始路径透传进来，所以这里
 * 只要导出 app 即可，不需要自己 listen。
 */
export { default } from '../../server/dist/edge.js';
