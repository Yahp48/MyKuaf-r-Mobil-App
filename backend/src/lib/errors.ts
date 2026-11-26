// Uygulama genelinde tek tip hata. İstemci her zaman { error: { code, message, details? } } alır.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Oturum açmanız gerekiyor") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Bu işlem için yetkiniz yok") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Kayıt bulunamadı") => new AppError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
