import { Request, Response } from 'express';
import { LinkBasedContentService, CreateBatchJobRequest } from '../services/LinkBasedContentService';
import { WebScrapingService } from '../services/WebScrapingService';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import type { BrandVoiceConfig } from '../types';

/**
 * Controller for Link-Based Content Generation
 */
export class LinkContentController {
  private linkContentService: LinkBasedContentService;
  private webScrapingService: WebScrapingService;

  constructor() {
    this.linkContentService = new LinkBasedContentService();
    this.webScrapingService = new WebScrapingService();
  }

  /**
   * Create a new batch job for link-based content generation
   * POST /api/v1/link-content/batch
   */
  createBatchJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId, urls, settings } = req.body;

    // Validate input
    if (!projectId || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: projectId and urls'
        }
      });
      return;
    }

    if (!settings || !settings.contentType || !settings.brandVoice) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing content settings'
        }
      });
      return;
    }

    try {
      const request: CreateBatchJobRequest = {
        projectId,
        urls: urls.filter((url: string) => url && url.trim()),
        settings: {
          contentType: settings.contentType,
          brandVoice: settings.brandVoice as BrandVoiceConfig,
          targetAudience: settings.targetAudience || 'General audience',
          preferredProvider: settings.preferredProvider || 'auto'
        }
      };

      const batchJob = await this.linkContentService.createBatchJob(request);

      logger.info(`Created batch job ${batchJob.id} for project ${projectId}`);

      res.status(201).json({
        success: true,
        data: batchJob,
        message: 'Batch job created successfully'
      });

    } catch (error) {
      logger.error('Error creating batch job:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create batch job'
        }
      });
    }
  });

  /**
   * Get batch job status with items
   * GET /api/v1/link-content/batch/:jobId
   */
  getBatchJobStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job ID is required'
        }
      });
      return;
    }

    try {
      const status = await this.linkContentService.getBatchJobStatus(jobId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: status,
        message: 'Batch job status retrieved successfully'
      });

    } catch (error) {
      logger.error('Error getting batch job status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get batch job status'
        }
      });
    }
  });

  /**
   * Start crawling URLs in a batch job
   * POST /api/v1/link-content/batch/:jobId/crawl
   */
  startCrawling = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job ID is required'
        }
      });
      return;
    }

    try {
      // Start crawling asynchronously
      this.linkContentService.startCrawling(jobId).catch(error => {
        logger.error(`Crawling failed for batch job ${jobId}:`, error);
      });

      res.json({
        success: true,
        message: 'Crawling started successfully'
      });

    } catch (error) {
      logger.error('Error starting crawling:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start crawling'
        }
      });
    }
  });

  /**
   * Generate AI content for batch job
   * POST /api/v1/link-content/batch/:jobId/generate
   */
  generateContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job ID is required'
        }
      });
      return;
    }

    try {
      // Start generation asynchronously
      this.linkContentService.generateContent(jobId).catch(error => {
        logger.error(`Content generation failed for batch job ${jobId}:`, error);
      });

      res.json({
        success: true,
        message: 'Content generation started successfully'
      });

    } catch (error) {
      logger.error('Error starting content generation:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start content generation'
        }
      });
    }
  });

  /**
   * Generate AI content for batch job with enhanced settings
   * POST /api/v1/link-content/batch/:jobId/generate-content
   */
  generateBatchContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;
    const { settings } = req.body;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job ID is required'
        }
      });
      return;
    }

    if (!settings) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Content generation settings are required'
        }
      });
      return;
    }

    try {
      // Validate settings structure
      const requiredFields = ['contentType', 'brandVoice', 'targetAudience'];
      for (const field of requiredFields) {
        if (!settings[field]) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Missing required setting: ${field}`
            }
          });
          return;
        }
      }

      // Start enhanced content generation asynchronously
      this.linkContentService.generateBatchContentWithSettings(jobId, settings).catch(error => {
        logger.error(`Enhanced content generation failed for batch job ${jobId}:`, error);
      });

      res.json({
        success: true,
        message: 'Enhanced content generation started successfully'
      });

    } catch (error) {
      logger.error('Error starting enhanced content generation:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start enhanced content generation'
        }
      });
    }
  });

  /**
   * Approve a content item
   * POST /api/v1/link-content/batch/:jobId/items/:itemId/approve
   */
  approveContentItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId, itemId } = req.params;

    if (!jobId || !itemId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job ID and Item ID are required'
        }
      });
      return;
    }

    try {
      await this.linkContentService.approveContentItem(jobId, itemId);

      res.json({
        success: true,
        message: 'Content item approved successfully'
      });

    } catch (error) {
      logger.error('Error approving content item:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to approve content item'
        }
      });
    }
  });

  /**
   * Regenerate content for a specific item
   * POST /api/v1/link-content/batch/:jobId/items/:itemId/regenerate
   */
  regenerateContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId, itemId } = req.params;

    if (!jobId || !itemId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job ID and Item ID are required'
        }
      });
      return;
    }

    try {
      // Start regeneration asynchronously
      this.linkContentService.regenerateContent(jobId, itemId).catch(error => {
        logger.error(`Content regeneration failed for item ${itemId}:`, error);
      });

      res.json({
        success: true,
        message: 'Content regeneration started successfully'
      });

    } catch (error) {
      logger.error('Error starting content regeneration:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start content regeneration'
        }
      });
    }
  });

  /**
   * Get approved content items ready for publishing
   * GET /api/v1/link-content/batch/:jobId/approved
   */
  getApprovedContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Job ID is required'
        }
      });
      return;
    }

    try {
      const approvedItems = await this.linkContentService.getApprovedContent(jobId);

      res.json({
        success: true,
        data: {
          items: approvedItems,
          count: approvedItems.length
        },
        message: 'Approved content retrieved successfully'
      });

    } catch (error) {
      logger.error('Error getting approved content:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get approved content'
        }
      });
    }
  });

  /**
   * Test scraping a single URL (for testing purposes)
   * POST /api/v1/link-content/test-scrape
   */
  testScrape = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'URL is required'
        }
      });
      return;
    }

    try {
      logger.info(`Testing scrape for URL: ${url}`);
      
      const results = await this.webScrapingService.scrapeUrls([url]);
      const result = results[0];

      if (!result) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SCRAPING_FAILED',
            message: 'Failed to scrape URL'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: {
          url: result.url,
          title: result.title,
          content: result.content,
          wordCount: result.metadata?.wordCount || result.content.split(' ').length,
          qualityScore: result.qualityScore,
          metadata: result.metadata,
          scrapedAt: result.scrapedAt
        },
        message: 'URL scraped successfully'
      });

    } catch (error) {
      logger.error('Error testing scrape:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SCRAPING_ERROR',
          message: error instanceof Error ? error.message : 'Scraping failed'
        }
      });
    }
  });

  /**
   * Health check for link content service
   * GET /api/v1/link-content/health
   */
  healthCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const isHealthy = await this.linkContentService.healthCheck();
      
      res.json({
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          service: 'LinkBasedContentService',
          timestamp: new Date().toISOString()
        },
        message: 'Health check completed'
      });

    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Service health check failed'
        }
      });
    }
  });

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.linkContentService.cleanup();
    await this.webScrapingService.close();
  }
} 