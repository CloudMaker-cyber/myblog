import rateLimit from 'express-rate-limit';

/**
 * 登录、注册这类接口必须限流：否则攻击者可以无限次试密码。
 *
 * 15 分钟 20 次，是给正常用户留足余量（输错几次密码很常见），
 * 同时把暴力破解的成本抬高到不可行。
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: '尝试过于频繁，请 15 分钟后再试',
      details: [],
    },
  },
});
