import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors.js'
import { env } from '../config/env.js'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
      },
    })
    return
  }

  console.error('Unhandled error:', err)

  res.status(500).json({
    error: {
      message: env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
      statusCode: 500,
    },
  })
}
