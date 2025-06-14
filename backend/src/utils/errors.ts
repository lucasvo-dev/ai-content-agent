export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503);
  }
}

// AI-specific errors
export class AIServiceError extends AppError {
  constructor(message: string = 'AI service error') {
    super(message, 502);
  }
}

export class ContentGenerationError extends AppError {
  constructor(message: string = 'Content generation failed') {
    super(message, 500);
  }
}

// Platform integration errors
export class PlatformAPIError extends AppError {
  public readonly platform: string;
  public readonly originalError?: any;

  constructor(platform: string, message: string, originalError?: any) {
    super(`${platform} API error: ${message}`, 503);
    this.platform = platform;
    this.originalError = originalError;
  }
}

export class WordPressError extends PlatformAPIError {
  constructor(message: string, originalError?: any) {
    super('WordPress', message, originalError);
  }
}

export class FacebookError extends PlatformAPIError {
  constructor(message: string, originalError?: any) {
    super('Facebook', message, originalError);
  }
}

// Database errors
export class DatabaseError extends AppError {
  constructor(message: string = 'Database error') {
    super(message, 500, false);
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(message: string = 'Database connection failed') {
    super(message);
  }
}

// Utility functions
export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
};

export const getErrorStack = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
};

// Error response formatter
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

export const formatErrorResponse = (
  error: AppError,
  requestId?: string,
  details?: any
): ErrorResponse => {
  return {
    success: false,
    error: {
      code: error.constructor.name.replace('Error', '').toUpperCase(),
      message: error.message,
      details,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
};

// Error codes mapping
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  CONTENT_GENERATION_ERROR: 'CONTENT_GENERATION_ERROR',
  PLATFORM_API_ERROR: 'PLATFORM_API_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]; 