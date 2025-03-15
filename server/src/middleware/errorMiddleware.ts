import { Request, Response, NextFunction } from 'express';

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Middleware to handle 404 Not Found errors
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
  next(error);
};

// Global error handler middleware
export const errorHandler = (
  err: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // If the error is an instance of ApiError, use its properties
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      message: err.message,
      status: 'error',
      statusCode: err.statusCode,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
  } else {
    // For unexpected errors, log them and return a generic 500 error
    console.error(err);

    res.status(500).json({
      message: 'Internal Server Error',
      status: 'error',
      statusCode: 500,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
  }
};