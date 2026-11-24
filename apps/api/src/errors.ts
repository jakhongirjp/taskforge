export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found`);
export const forbidden = (message = "You do not have permission to do this") =>
  new AppError(403, "forbidden", message);
export const unauthorized = (message = "Authentication required") =>
  new AppError(401, "unauthorized", message);
export const conflict = (message: string) => new AppError(409, "conflict", message);
export const badRequest = (message: string) => new AppError(400, "bad_request", message);
