export type ErrorDetail = {
  field: string;
  message: string;
};

/**
 * 业务错误。所有"预期之内"的失败（参数错、未登录、无权限、资源不存在、重名）
 * 都用它抛出，由统一错误出口翻译成 { error: { code, message, details } }。
 *
 * 不把状态码散落在各处 if/else 里，是让"返回什么"变成一处可查的约定。
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];

  constructor(status: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
