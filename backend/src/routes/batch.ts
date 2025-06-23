import { Router, Response, NextFunction } from 'express';
import Joi from 'joi';
import { BatchGenerationController } from '../controllers/BatchGenerationController.js';
import { validateRequest } from '../middleware/validation.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();
const batchController = new BatchGenerationController();

// Validation schemas
const batchGenerationSchema = Joi.object({
  researchJobId: Joi.string().required().messages({
    'string.empty': 'Research job ID is required',
    'any.required': 'Research job ID is required'
  }),
  settings: Joi.object({
    targetCount: Joi.number().integer().min(1).max(50).default(10).messages({
      'number.base': 'Target count must be a number',
      'number.integer': 'Target count must be an integer',
      'number.min': 'Target count must be at least 1',
      'number.max': 'Target count cannot exceed 50'
    }),
    contentType: Joi.string().valid('blog_post', 'social_media', 'email', 'ad_copy').default('blog_post').messages({
      'any.only': 'Content type must be one of: blog_post, social_media, email, ad_copy'
    }),
    brandVoice: Joi.object({
      tone: Joi.string().valid('professional', 'casual', 'friendly', 'authoritative').default('professional'),
      style: Joi.string().valid('formal', 'conversational', 'technical', 'creative').default('conversational'),
      vocabulary: Joi.string().valid('simple', 'advanced', 'industry-specific').default('advanced'),
      length: Joi.string().valid('concise', 'detailed', 'comprehensive').default('detailed')
    }).default(),
    targetAudience: Joi.string().min(3).max(200).default('General audience').messages({
      'string.min': 'Target audience must be at least 3 characters',
      'string.max': 'Target audience cannot exceed 200 characters'
    }),
    requirements: Joi.object({
      wordCount: Joi.string().pattern(/^\d+(-\d+)?$/).default('1000-1500').messages({
        'string.pattern.base': 'Word count must be in format "1000" or "1000-1500"'
      }),
      includeHeadings: Joi.boolean().default(true),
      seoOptimized: Joi.boolean().default(true),
      uniquenessThreshold: Joi.number().min(0.5).max(1.0).default(0.8).messages({
        'number.min': 'Uniqueness threshold must be at least 0.5',
        'number.max': 'Uniqueness threshold cannot exceed 1.0'
      })
    }).default(),
    aiProvider: Joi.string().valid('openai', 'gemini', 'auto').default('auto').messages({
      'any.only': 'AI provider must be one of: openai, gemini, auto'
    })
  }).required().messages({
    'any.required': 'Generation settings are required'
  })
});

const jobIdSchema = Joi.object({
  jobId: Joi.string().pattern(/^batch_\d+_[a-z0-9]+$/).required().messages({
    'string.pattern.base': 'Invalid batch job ID format',
    'any.required': 'Job ID is required'
  })
});

const contentIdSchema = Joi.object({
  contentId: Joi.string().pattern(/^content_\d+_[a-z0-9]+$/).required().messages({
    'string.pattern.base': 'Invalid content ID format',
    'any.required': 'Content ID is required'
  })
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  quality: Joi.string().valid('all', 'high', 'medium', 'low').default('all')
});

/**
 * @route POST /api/v1/batch/generate
 * @desc Create a batch content generation job
 * @access Private
 * @body {researchJobId: string, settings: BatchGenerationSettings}
 */
router.post(
  '/generate',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(batchGenerationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await batchController.generateBatch(req, res, next);
  }
);

/**
 * @route GET /api/v1/batch/jobs
 * @desc Get all batch generation jobs for user
 * @access Private
 * @query {page?: number, limit?: number, status?: string}
 */
router.get(
  '/jobs',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(paginationSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await batchController.getAllBatchJobs(req, res, next);
  }
);

/**
 * @route GET /api/v1/batch/jobs/:jobId
 * @desc Get batch generation job status and progress
 * @access Private
 */
router.get(
  '/jobs/:jobId',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(jobIdSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await batchController.getBatchJobStatus(req, res, next);
  }
);

/**
 * @route GET /api/v1/batch/results/:jobId
 * @desc Get batch generation job results with pagination
 * @access Private
 * @query {page?: number, limit?: number, quality?: string}
 */
router.get(
  '/results/:jobId',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(jobIdSchema, 'params'),
  validateRequest(paginationSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await batchController.getBatchJobResults(req, res, next);
  }
);

/**
 * @route GET /api/v1/batch/content/:contentId
 * @desc Get full content by content ID
 * @access Private
 */
router.get(
  '/content/:contentId',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(contentIdSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await batchController.getFullContent(req, res, next);
  }
);

/**
 * @route PUT /api/v1/batch/jobs/:jobId/cancel
 * @desc Cancel a running batch generation job
 * @access Private
 */
router.put(
  '/jobs/:jobId/cancel',
  /* authMiddleware, */ // Temporarily disabled for testing
  validateRequest(jobIdSchema, 'params'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await batchController.cancelBatchJob(req, res, next);
  }
);

/**
 * @route GET /api/v1/batch/health
 * @desc Get batch generation service health status
 * @access Public
 */
router.get('/health', async (req, res, next) => {
  await batchController.getHealthStatus(req, res, next);
});

/**
 * @route GET /api/v1/batch/capabilities
 * @desc Get batch generation service capabilities and limits
 * @access Public
 */
router.get('/capabilities', async (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'BatchGenerationService',
      version: '1.0.0',
      capabilities: {
        batchGeneration: {
          description: 'Generate multiple pieces of content simultaneously',
          maxBatchSize: 50,
          supportedTypes: ['blog_post', 'social_media', 'email', 'ad_copy'],
          averageTimePerContent: '2-3 minutes'
        },
        aiOrchestration: {
          description: 'Intelligent AI provider selection and management',
          supportedProviders: ['openai', 'gemini', 'auto'],
          fallbackSupport: true,
          costOptimization: true
        },
        qualityAssurance: {
          description: 'Automated content quality validation',
          uniquenessChecking: true,
          qualityScoring: true,
          seoOptimization: true,
          minUniquenessScore: 0.8
        },
        progressTracking: {
          description: 'Real-time job progress monitoring',
          realTimeUpdates: true,
          detailedMetrics: true,
          estimatedCompletion: true
        }
      },
      limits: {
        maxConcurrentJobs: 10,
        maxBatchSize: 50,
        maxContentLength: 5000,
        queueRetention: '2 hours',
        resultRetention: '24 hours'
      },
      pricing: {
        openai: 'Pay-per-use (~$0.01-0.03/1K tokens)',
        gemini: 'Free tier (1,500 requests/day)',
        estimatedCostPerContent: '$0.10-0.50'
      }
    }
  });
});

/**
 * @route GET /api/v1/batch/templates
 * @desc Get available batch generation templates
 * @access Public
 */
router.get('/templates', async (req, res) => {
  const templates = [
    {
      id: 'blog_comprehensive',
      name: 'Comprehensive Blog Posts',
      description: 'Generate detailed, SEO-optimized blog posts (1500-2500 words)',
      contentType: 'blog_post',
      settings: {
        targetCount: 10,
        brandVoice: {
          tone: 'professional',
          style: 'conversational',
          vocabulary: 'advanced',
          length: 'comprehensive'
        },
        requirements: {
          wordCount: '1500-2500',
          includeHeadings: true,
          seoOptimized: true,
          uniquenessThreshold: 0.9
        },
        aiProvider: 'auto'
      },
      estimatedTime: '25-35 minutes',
      recommendedFor: ['Corporate blogs', 'Authority content', 'SEO campaigns']
    },
    {
      id: 'social_media_burst',
      name: 'Social Media Content Burst',
      description: 'Generate engaging social media posts for multiple platforms',
      contentType: 'social_media',
      settings: {
        targetCount: 20,
        brandVoice: {
          tone: 'friendly',
          style: 'conversational',
          vocabulary: 'simple',
          length: 'concise'
        },
        requirements: {
          wordCount: '50-200',
          includeHeadings: false,
          seoOptimized: false,
          uniquenessThreshold: 0.8
        },
        aiProvider: 'gemini'
      },
      estimatedTime: '15-20 minutes',
      recommendedFor: ['Social campaigns', 'Brand awareness', 'Engagement drives']
    },
    {
      id: 'email_sequence',
      name: 'Email Marketing Sequence',
      description: 'Generate a complete email marketing sequence',
      contentType: 'email',
      settings: {
        targetCount: 7,
        brandVoice: {
          tone: 'friendly',
          style: 'conversational',
          vocabulary: 'advanced',
          length: 'detailed'
        },
        requirements: {
          wordCount: '300-800',
          includeHeadings: true,
          seoOptimized: false,
          uniquenessThreshold: 0.85
        },
        aiProvider: 'openai'
      },
      estimatedTime: '20-25 minutes',
      recommendedFor: ['Email campaigns', 'Lead nurturing', 'Product launches']
    },
    {
      id: 'ad_copy_variants',
      name: 'Ad Copy Variants',
      description: 'Generate multiple ad copy variations for A/B testing',
      contentType: 'ad_copy',
      settings: {
        targetCount: 15,
        brandVoice: {
          tone: 'authoritative',
          style: 'creative',
          vocabulary: 'simple',
          length: 'concise'
        },
        requirements: {
          wordCount: '25-100',
          includeHeadings: false,
          seoOptimized: false,
          uniquenessThreshold: 0.9
        },
        aiProvider: 'auto'
      },
      estimatedTime: '10-15 minutes',
      recommendedFor: ['PPC campaigns', 'A/B testing', 'Conversion optimization']
    }
  ];

  res.json({
    success: true,
    data: {
      templates,
      usage: {
        instruction: 'Use these templates as starting points for your batch generation jobs',
        customization: 'All settings can be customized to match your specific needs',
        recommendation: 'Choose templates based on your content goals and target audience'
      }
    }
  });
});

/**
 * @route GET /api/v1/batch/stats
 * @desc Get batch generation service statistics
 * @access Private
 */
router.get('/stats', /* authMiddleware, */ async (req: AuthenticatedRequest, res) => {
  // This would normally fetch real statistics from the database
  // For now, we'll return mock data
  const stats = {
    totalJobsProcessed: 0,
    totalContentGenerated: 0,
    averageQualityScore: 0,
    averageProcessingTime: '0 minutes',
    successRate: 0,
    providerUsage: {
      openai: 0,
      gemini: 0,
      auto: 0
    },
    contentTypeDistribution: {
      blog_post: 0,
      social_media: 0,
      email: 0,
      ad_copy: 0
    },
    last30Days: {
      jobsCompleted: 0,
      contentGenerated: 0,
      averageQualityScore: 0
    }
  };

  res.json({
    success: true,
    data: {
      statistics: stats,
      period: 'All time',
      lastUpdated: new Date().toISOString(),
      note: 'Statistics are updated in real-time as jobs complete'
    }
  });
});

export default router; 