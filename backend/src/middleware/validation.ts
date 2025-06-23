import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationError extends Error {
  isValidationError: true;
  details: any[];
}

export const validateRequest = (
  schema: Joi.ObjectSchema,
  property: 'body' | 'params' | 'query' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const validationError: ValidationError = new Error(error.message) as ValidationError;
      validationError.isValidationError = true;
      validationError.details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationError.details,
        },
      });
      return;
    }

    // Replace the request property with the validated value
    req[property] = value;
    next();
  };
};

export default validateRequest; 