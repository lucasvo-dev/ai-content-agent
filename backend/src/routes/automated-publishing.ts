import { Router, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AutomatedPublishingController } from '../controllers/AutomatedPublishingController.js';
import { validateRequest } from '../middleware/validation.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();
const publishingController = new AutomatedPublishingController();

// Validation schemas
const automatedPublishingSchema = Joi.object({
  contentIds: Joi.array()
    .items(Joi.string().required())
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.base': 'Content IDs must be an array',
      'array.min': 'At least 1 content ID is required',
      'array.max': 'Maximum 50 content IDs allowed',
      'any.required': 'Content IDs are required'
    }),
  wpCredentials: Joi.object({
    siteUrl: Joi.string().uri().required().messages({
      'string.uri': 'WordPress site URL must be a valid URL',
      'any.required': 'WordPress site URL is required'
    }),
    username: Joi.string().min(1).max(100).required().messages({
      'string.min': 'WordPress username cannot be empty',
      'string.max': 'WordPress username cannot exceed 100 characters',
      'any.required': 'WordPress username is required'
    }),
    applicationPassword: Joi.string().min(1).required().messages({
      'string.min': 'WordPress application password cannot be empty',
      'any.required': 'WordPress application password is required'
    })
  }).required().messages({
    'any.required': 'WordPress credentials are required'
  }),
  settings: Joi.object({
    status: Joi.string().valid('draft', 'publish', 'private').default('draft').messages({
      'any.only': 'Publishing status must be draft, publish, or private'
    }),
    categories: Joi.array().items(Joi.string()).default([]).messages({
      'array.base': 'Categories must be an array of strings'
    }),
    tags: Joi.array().items(Joi.string()).default([]).messages({
      'array.base': 'Tags must be an array of strings'
    }),
    scheduledDate: Joi.date().iso().greater('now').messages({
      'date.base': 'Scheduled date must be a valid date',
      'date.iso': 'Scheduled date must be in ISO format',
      'date.greater': 'Scheduled date must be in the future'
    }),
    delayBetweenPosts: Joi.number().integer().min(10000).max(300000).default(30000).messages({
      'number.base': 'Delay between posts must be a number',
      'number.integer': 'Delay between posts must be an integer',
      'number.min': 'Delay between posts must be at least 10 seconds (10000ms)',
      'number.max': 'Delay between posts cannot exceed 5 minutes (300000ms)'
    }),
    enablePerformanceTracking: Joi.boolean().default(true),
    autoOptimization: Joi.boolean().default(true),
    seoTitle: Joi.string().max(60).messages({
      'string.max': 'SEO title cannot exceed 60 characters'
    }),
    seoDescription: Joi.string().max(160).messages({
      'string.max': 'SEO description cannot exceed 160 characters'
    }),
    featuredImageUrl: Joi.string().uri().messages({
      'string.uri': 'Featured image URL must be a valid URL'
    })
  }).default()
});

const jobIdSchema = Joi.object({
  jobId: Joi.string().pattern(/^autopub_\d+_[a-z0-9]+$/).required().messages({
    'string.pattern.base': 'Invalid automated publishing job ID format',
    'any.required': 'Job ID is required'
  })
});

const contentIdSchema = Joi.object({
  contentId: Joi.string().required().messages({
    'any.required': 'Content ID is required'
  })
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  status: Joi.string().valid('all', 'success', 'failed').default('all')
});

const fineTuningQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50).messages({
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100'
  })
});

/**
 * @route POST /api/v1/publishing/automated/schedule
 * @desc Schedule automated publishing for approved content
 * @access Private
 * @body {contentIds: string[], wpCredentials: WordPressCredentials, settings?: PublishingSettings}
 */
router.post(
  '/schedule',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(automatedPublishingSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await publishingController.scheduleAutomatedPublishing(req, res, next);
  }
);

/**
 * @route GET /api/v1/publishing/automated/jobs/:jobId
 * @desc Get automated publishing job status and progress
 * @access Private
 */
router.get(
  '/jobs/:jobId',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(jobIdSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await publishingController.getPublishingJobStatus(req, res, next);
  }
);

/**
 * @route GET /api/v1/publishing/automated/results/:jobId
 * @desc Get automated publishing job results with pagination
 * @access Private
 * @query {page?: number, limit?: number, status?: string}
 */
router.get(
  '/results/:jobId',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(jobIdSchema, 'params'),
  validateRequest(paginationSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await publishingController.getPublishingJobResults(req, res, next);
  }
);

/**
 * @route GET /api/v1/publishing/automated/performance/:contentId
 * @desc Get content performance metrics
 * @access Private
 */
router.get(
  '/performance/:contentId',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(contentIdSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await publishingController.getContentPerformance(req, res, next);
  }
);

/**
 * @route GET /api/v1/publishing/automated/finetuning/dataset
 * @desc Get fine-tuning dataset from high-performing content
 * @access Private (Admin only)
 * @query {limit?: number}
 */
router.get(
  '/finetuning/dataset',
  /* authMiddleware, */ // Temporarily disabled for testing
  /* requireAdmin, */ // Admin access only
  validateRequest(fineTuningQuerySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await publishingController.getFineTuningDataset(req, res, next);
  }
);

/**
 * @route PUT /api/v1/publishing/automated/jobs/:jobId/cancel
 * @desc Cancel a running automated publishing job
 * @access Private
 */
router.put(
  '/jobs/:jobId/cancel',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(jobIdSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await publishingController.cancelPublishingJob(req, res, next);
  }
);

/**
 * @route GET /api/v1/publishing/automated/health
 * @desc Get automated publishing service health status
 * @access Public
 */
router.get('/health', async (req, res, next) => {
  await publishingController.getHealthStatus(req, res, next);
});

/**
 * @route GET /api/v1/publishing/automated/capabilities
 * @desc Get automated publishing service capabilities and features
 * @access Public
 */
router.get('/capabilities', async (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'AutomatedPublishingService',
      version: '1.0.0',
      capabilities: {
        automatedPublishing: {
          description: 'Automated WordPress content publishing with queue management',
          maxBatchSize: 50,
          supportedPlatforms: ['wordpress'],
          averagePublishTime: '30 seconds per post',
          delayRange: '10 seconds - 5 minutes',
          retryMechanism: true
        },
        performanceTracking: {
          description: 'Real-time content performance monitoring and analytics',
          trackingIntervals: ['24h', '7d', '30d'],
          metricsCollected: [
            'views', 'comments', 'shares', 'engagement rate',
            'average time on page', 'organic traffic',
            'click-through rate', 'bounce rate'
          ],
          retentionPeriod: '30 days',
          realTimeUpdates: true
        },
        aiLearning: {
          description: 'AI model improvement from performance data',
          fineTuningDataset: true,
          performanceBasedOptimization: true,
          qualityRatingSystem: '1-10 scale',
          highPerformanceCriteria: {
            views: '> 500',
            engagementRate: '> 5%',
            qualityScore: '> 80'
          }
        },
        queueManagement: {
          description: 'Redis-based job queue with monitoring',
          concurrentPublishing: 3,
          concurrentPerformanceTracking: 2,
          retryMechanism: true,
          exponentialBackoff: true,
          jobRetention: '2 hours'
        },
        wordpress: {
          description: 'WordPress REST API integration',
          supportedFeatures: [
            'post creation', 'post updates', 'category management',
            'tag management', 'featured images', 'SEO meta fields',
            'scheduled publishing', 'draft/publish status'
          ],
          authentication: 'Application Passwords',
          rateLimiting: 'Respectful API usage'
        }
      },
      limits: {
        maxBatchSize: 50,
        maxConcurrentJobs: 10,
        minDelayBetweenPosts: '10 seconds',
        maxDelayBetweenPosts: '5 minutes',
        performanceRetention: '30 days',
        fineTuningDatasetSize: 'Unlimited',
        maxContentIdLength: 255
      },
      integrations: {
        redis: 'Queue management and caching',
        wordpress: 'Content publishing and management',
        adminReview: 'Approved content retrieval',
        aiServices: 'Performance-based optimization'
      }
    }
  });
});

export default router; 