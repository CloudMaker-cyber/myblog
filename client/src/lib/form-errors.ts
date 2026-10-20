import { ApiError } from './api';

export type FieldErrors = Record<string, string>;

export type ParsedFormError = {
  /** 需要显示在表单顶部的整体错误；字段级错误存在时为空 */
  message: string | null;
  fields: FieldErrors;
};

/**
 * 把接口错误翻译成"能贴在输入框下面"的字段错误。
 *
 * 后端返回的 details 形如 [{ field: 'password', message: '密码至少 8 位' }]，
 * 同一个字段可能有多条（密码既短又没数字），用「；」合并成一句。
 */
export function parseFormError(error: unknown): ParsedFormError {
  if (error instanceof ApiError) {
    // 后端没带字段明细、但我们知道该贴到哪个输入框的错误码
    const codeToField: Record<string, string> = {
      EMAIL_TAKEN: 'email',
      USERNAME_TAKEN: 'username',
    };
    const mappedField = codeToField[error.code];
    if (mappedField) {
      return { message: null, fields: { [mappedField]: error.message } };
    }

    if (error.details.length > 0) {
      const fields: FieldErrors = {};

      for (const detail of error.details) {
        if (!detail.field || detail.field === '(body)') continue;
        const existing = fields[detail.field];
        fields[detail.field] = existing ? `${existing}；${detail.message}` : detail.message;
      }

      if (Object.keys(fields).length > 0) {
        return { message: null, fields };
      }
    }
  }

  return {
    message: error instanceof Error ? error.message : '提交失败，请稍后重试',
    fields: {},
  };
}
