import { Request, Response, NextFunction } from "express";
import { logger } from "@/utils/logger";
import type { AppError as IAppError } from "@/types";

export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  stack?: string;
  timestamp: string;
}

export class AppError extends Error implements IAppError {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  return new AppError(message, statusCode);
};

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default error values
  let statusCode = 500;
  let message = "Internal Server Error";
  let isOperational = false;

  // Handle custom AppError
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  }

  // Handle specific error types
  if (error.name === "ValidationError") {
    statusCode = 400;
    message = error.message;
    isOperational = true;
  }

  if (error.name === "UnauthorizedError" || error.message.includes("unauthorized")) {
    statusCode = 401;
    message = "Unauthorized access";
    isOperational = true;
  }

  if (error.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    isOperational = true;
  }

  if (error.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    isOperational = true;
  }

  // Handle Supabase errors
  if (error.message.includes("duplicate key value")) {
    statusCode = 409;
    message = "Resource already exists";
    isOperational = true;
  }

  if (error.message.includes("foreign key constraint")) {
    statusCode = 400;
    message = "Invalid reference to related resource";
    isOperational = true;
  }

  // Log error
  if (!isOperational || statusCode >= 500) {
    logger.error("Unhandled error occurred", {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
  } else {
    logger.warn("Operational error occurred", {
      error: error.message,
      url: req.url,
      method: req.method,
      statusCode,
    });
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  // Include error details in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.error = error.message;
    errorResponse.stack = error.stack;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorResponse.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// 404 Not Found handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const message = `Route ${req.originalUrl} not found`;
  
  logger.warn("Route not found", {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}; 