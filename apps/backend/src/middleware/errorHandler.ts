import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  // Handle specific error types
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
      statusCode: 401,
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token expired',
      statusCode: 401,
    });
    return;
  }

  // Default to 500
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    statusCode: 500,
  });
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    statusCode: 404,
  });
};
