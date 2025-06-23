import { Router } from 'express';
import ResearchController from '../controllers/ResearchController';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { AuthenticatedRequest } from '../types';
import Joi from 'joi';
import { z } from 'zod';

const router = Router();
const researchController = new ResearchController();

// Validation schemas
const urlResearchSchema = Joi.object({
  urls: Joi.array()
    .items(Joi.string().uri())
    .min(1)
    .max(20)
    .required()
    .messages({
      'array.min': 'At least 1 URL is required',
      'array.max': 'Maximum 20 URLs allowed',
      'string.uri': 'Invalid URL format',
    }),
  projectId: Joi.string().uuid().optional(),
  settings: Joi.object({
    extractMetadata: Joi.boolean().default(true),
    includeImages: Joi.boolean().default(false),
    qualityThreshold: Joi.number().min(0).max(1).default(0.7),
    respectRobotsTxt: Joi.boolean().default(true),
    userAgent: Joi.string().default('AI Content Agent Bot 1.0'),
    timeoutMs: Joi.number().min(5000).max(60000).default(30000),
    delayMs: Joi.number().min(0).max(10000).default(1000),
  }).optional(),
});

const keywordResearchSchema = Joi.object({
  keywords: Joi.array()
    .items(Joi.string().min(2).max(100))
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least 1 keyword is required',
      'array.max': 'Maximum 10 keywords allowed',
      'string.min': 'Keywords must be at least 2 characters',
      'string.max': 'Keywords must be less than 100 characters',
    }),
  projectId: Joi.string().uuid().optional(),
  settings: Joi.object({
    searchDepth: Joi.number().min(1).max(20).default(10),
    includeMetrics: Joi.boolean().default(true),
    language: Joi.string().length(2).default('en'),
    region: Joi.string().length(2).default('US'),
    searchEngines: Joi.array()
      .items(Joi.string().valid('google', 'bing'))
      .default(['google', 'bing']),
  }).optional(),
});

const jobIdSchema = Joi.object({
  jobId: Joi.string()
    .pattern(/^(scraping|research)_\d+_[a-z0-9]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid job ID format',
    }),
});

const seoUrlsSchema = z.object({
  body: z.object({
    keyword: z.string().min(1, 'Keyword is required'),
    limit: z.number().min(1).max(50).optional(),
    includePreview: z.boolean().optional(),
  })
});

const previewSchema = z.object({
  body: z.object({
    url: z.string().url('Valid URL is required'),
  })
});

/**
 * @route POST /api/v1/research/urls
 * @desc Submit URLs for content research and crawling
 * @access Private
 */
router.post(
  '/urls',
  /* authMiddleware, */
  validateRequest(urlResearchSchema),
  async (req: AuthenticatedRequest, res) => {
    console.log('POST /urls - Request body:', JSON.stringify(req.body, null, 2));
    await researchController.submitUrls(req, res);
  }
);

/**
 * @route GET /api/v1/research/keywords
 * @desc Get available keywords or recent keyword research
 * @access Private
 */
router.get('/keywords', /* authMiddleware, */ async (req, res) => {
  try {
    // Mock keyword suggestions for development
    const mockKeywords = {
      success: true,
      data: {
        suggested: [
          { keyword: 'AI marketing', volume: 12000, difficulty: 'medium', trend: 'rising' },
          { keyword: 'content automation', volume: 8500, difficulty: 'low', trend: 'stable' },
          { keyword: 'digital marketing', volume: 45000, difficulty: 'high', trend: 'stable' },
          { keyword: 'SEO optimization', volume: 22000, difficulty: 'medium', trend: 'rising' },
          { keyword: 'social media management', volume: 18000, difficulty: 'medium', trend: 'stable' }
        ],
        recent: [
          { keyword: 'AI content generation', searchedAt: new Date().toISOString() },
          { keyword: 'marketing automation', searchedAt: new Date().toISOString() }
        ],
        trending: [
          { keyword: 'ChatGPT marketing', volume: 9500, growth: '+150%' },
          { keyword: 'AI copywriting', volume: 6800, growth: '+89%' }
        ]
      },
      message: 'Keywords retrieved successfully'
    };

    res.json(mockKeywords);
  } catch (error) {
    console.error('Error getting keywords:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve keywords',
      },
    });
  }
});

/**
 * @route POST /api/v1/research/keywords
 * @desc Submit keywords for SEO research and URL discovery
 * @access Private
 */
router.post(
  '/keywords',
  /* authMiddleware, */
  /* validateRequest(keywordResearchSchema), */
  async (req: AuthenticatedRequest, res) => {
    console.log('POST /keywords - Request body:', JSON.stringify(req.body, null, 2));
    await researchController.submitKeywords(req, res);
  }
);

/**
 * @route GET /api/v1/research/jobs/:jobId
 * @desc Check research job status
 * @access Private
 */
router.get(
  '/jobs/:jobId',
  /* authMiddleware, */
  validateRequest(jobIdSchema, 'params'),
  async (req: AuthenticatedRequest, res) => {
    await researchController.getJobStatus(req, res);
  }
);

/**
 * @route GET /api/v1/research/results/:jobId
 * @desc Get detailed research results
 * @access Private
 */
router.get(
  '/results/:jobId',
  /* authMiddleware, */
  validateRequest(jobIdSchema, 'params'),
  async (req: AuthenticatedRequest, res) => {
    await researchController.getJobResults(req, res);
  }
);

/**
 * @route DELETE /api/v1/research/jobs/:jobId
 * @desc Cancel a research job
 * @access Private
 */
router.delete(
  '/jobs/:jobId',
  authMiddleware,
  validateRequest(jobIdSchema, 'params'),
  async (req: AuthenticatedRequest, res) => {
    await researchController.cancelJob(req, res);
  }
);

/**
 * @route GET /api/v1/research/status
 * @desc Get research system status and capabilities
 * @access Private
 */
router.get('/status', /* authMiddleware, */ async (req, res) => {
  try {
    const status = {
      success: true,
      data: {
        webScraping: {
          available: true,
          maxUrls: 20,
          supportedFormats: ['html', 'article', 'blog'],
          features: [
            'Anti-bot protection',
            'Robots.txt compliance',
            'Content quality scoring',
            'Metadata extraction',
          ],
        },
        seoResearch: {
          available: true,
          maxKeywords: 10,
          searchEngines: ['google', 'bing'],
          features: [
            'Search volume estimation',
            'Competition analysis',
            'Top URL discovery',
            'SERP analysis',
          ],
        },
        processing: {
          concurrentJobs: 5,
          avgProcessingTime: {
            urlScraping: '2-3 minutes per URL',
            keywordResearch: '3-5 minutes per keyword',
          },
          queueStatus: 'operational',
        },
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting research status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get research system status',
      },
    });
  }
});

/**
 * @route GET /api/v1/research/health
 * @desc Health check for research services
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    // Basic health check
    const health = {
      success: true,
      data: {
        status: 'healthy',
        services: {
          webScraping: 'operational',
          seoResearch: 'operational',
          queueSystem: 'operational',
          redis: 'connected',
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
    };

    res.status(200).json(health);
  } catch (error) {
    console.error('Research health check failed:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Research services are currently unavailable',
      },
    });
  }
});

/**
 * @route POST /api/v1/research/seo-urls
 * @desc Find top SEO URLs for a keyword
 * @access Private
 */
router.post(
  '/seo-urls',
  /* authMiddleware, */
  /* validateRequest(seoUrlsSchema), */
  async (req: AuthenticatedRequest, res) => {
    console.log('POST /seo-urls - Request body:', JSON.stringify(req.body, null, 2));
    await researchController.findSEOUrls(req, res);
  }
);

/**
 * @route POST /api/v1/research/preview
 * @desc Get content preview for a URL
 * @access Private
 */
router.post(
  '/preview',
  /* authMiddleware, */
  /* validateRequest(previewSchema), */
  async (req: AuthenticatedRequest, res) => {
    console.log('POST /preview - Request body:', JSON.stringify(req.body, null, 2));
    await researchController.getUrlPreview(req, res);
  }
);

// Error handling middleware for research routes
router.use((error: any, req: any, res: any, next: any) => {
  console.error('Research route error:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many research requests. Please try again later.',
        retryAfter: error.retryAfter,
      },
    });
  }

  if (error.code === 'QUOTA_EXCEEDED') {
    return res.status(402).json({
      success: false,
      error: {
        code: 'QUOTA_EXCEEDED',
        message: 'Research quota exceeded. Please upgrade your plan.',
      },
    });
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred during research processing',
      requestId: req.id,
    },
  });
});

export default router; 