// An error with an HTTP status. Services throw it; the error handler turns it into a JSON reply.
// This keeps services free of req/res, so they can be tested and reused without Express.
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = message => new AppError(400, message);
export const unauthorized = message => new AppError(401, message);
export const notFound = message => new AppError(404, message);
export const conflict = message => new AppError(409, message);
export const tooMany = message => new AppError(429, message);
