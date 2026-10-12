import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
import { zodIssuesToFieldIssues } from '../utils/validation.js';
import { isDuplicateKeyError } from '../utils/mongo.js';

interface HttpParserError {
  type: string;
  status: number;
}

function isHttpParserError(error: unknown): error is HttpParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof error.type === 'string' &&
    'status' in error &&
    typeof error.status === 'number'
  );
}


/** Converts any thrown value into an AppError that is safe to send to the client. */
export function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;
  if (error instanceof z.ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', zodIssuesToFieldIssues(error));
  }
  if (isHttpParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
    }
    if (error.type === 'entity.too.large') {
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
  }
  if (error instanceof mongoose.Error.CastError) {
    return new AppError(400, 'VALIDATION_ERROR', `Invalid value for ${error.path}`);
  }
  if (isDuplicateKeyError(error)) {
    return new AppError(409, 'CONFLICT', 'A resource with the same unique value already exists');
  }
  return undefined;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = toAppError(error);
  if (!appError) {
    req.log.error({ err: error }, 'Unhandled error');
  } else if (appError.status >= 500) {
    req.log.error({ err: error }, appError.message);
  }

  const status = appError?.status ?? 500;
  res.status(status).json({
    error: {
      code: appError?.code ?? 'INTERNAL_ERROR',
      message: appError?.message ?? 'An unexpected error occurred',
      ...(appError?.details ? { details: appError.details } : {}),
      ...(typeof req.id === 'object' ? {} : { requestId: String(req.id) }),
    },
  });
};
