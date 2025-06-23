import { Request, Response } from 'express';
import { AutomatedPublishingService } from '../services/AutomatedPublishingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import type { AuthenticatedRequest, WordPressCredentials, PublishingSettings } from '../types/index.js';

export class AutomatedPublishingController {
  private publishingService: AutomatedPublishingService;

  constructor() {
    this.publishingService = new AutomatedPublishingService();
  }

  /**
   * @route POST /api/v1/publishing/automated/schedule
   * @desc Schedule automated publishing for approved content
   * @access Private
   */
  scheduleAutomatedPublishing = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      contentIds,
      wpCredentials,
      settings
    } = req.body;

    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      throw new AppError('Content IDs array is required and cannot be empty', 400);
    }

    if (contentIds.length > 50) {
      throw new AppError('Maximum 50 content items can be published at once', 400);
    }

    if (!wpCredentials) {
      throw new AppError('WordPress credentials are required', 400);
    }

    // Validate WordPress credentials
    const validatedCredentials = this.validateWordPressCredentials(wpCredentials);

    // Validate and set default publishing settings
    const validatedSettings = this.validatePublishingSettings(settings || {});

    try {
      const jobId = await this.publishingService.scheduleAutomatedPublishing(
        contentIds,
        validatedCredentials,
        validatedSettings
      );

      const publishingJob = await this.publishingService.getPublishingJobStatus(jobId);

      res.status(201).json({
        success: true,
        data: {
          jobId,
          type: 'automated_publishing',
          status: publishingJob?.status || 'pending',
          contentCount: contentIds.length,
          estimatedTime: publishingJob?.progress?.estimatedTimeRemaining || '5-10 minutes',
          settings: {
            status: validatedSettings.status,
            delayBetweenPosts: validatedSettings.delayBetweenPosts,
            performanceTracking: validatedSettings.enablePerformanceTracking,
          },
          createdAt: new Date().toISOString(),
        },
        message: 'Automated publishing job scheduled successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('WordPress connection failed')) {
        throw new AppError('WordPress connection failed. Please verify your credentials.', 400);
      }
      throw error;
    }
  });

  /**
   * @route GET /api/v1/publishing/automated/jobs/:jobId
   * @desc Get automated publishing job status
   * @access Private
   */
  getPublishingJobStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;

    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    const publishingJob = await this.publishingService.getPublishingJobStatus(jobId);

    if (!publishingJob) {
      throw new AppError('Publishing job not found', 404);
    }

    // Calculate additional metrics
    const metrics = {
      successRate: publishingJob.progress.total > 0 
        ? Math.round((publishingJob.progress.published / publishingJob.progress.total) * 100) 
        : 0,
      failureRate: publishingJob.progress.total > 0 
        ? Math.round((publishingJob.progress.failed / publishingJob.progress.total) * 100) 
        : 0,
      averagePublishTime: publishingJob.results.length > 0
        ? Math.round(
            publishingJob.results
              .filter(r => r.success && r.publishedAt)
              .reduce((sum, result, index, arr) => {
                if (index === 0) return 0;
                const prevTime = arr[index - 1].publishedAt?.getTime() || 0;
                const currentTime = result.publishedAt?.getTime() || 0;
                return sum + (currentTime - prevTime);
              }, 0) / Math.max(publishingJob.results.length - 1, 1)
          )
        : 0,
    };

    res.json({
      success: true,
      data: {
        jobId: publishingJob.id,
        type: 'automated_publishing',
        status: publishingJob.status,
        progress: {
          ...publishingJob.progress,
          metrics,
        },
        settings: {
          contentCount: publishingJob.contentIds.length,
          publishingStatus: publishingJob.settings.status,
          delayBetweenPosts: publishingJob.settings.delayBetweenPosts,
          performanceTracking: publishingJob.settings.enablePerformanceTracking,
          autoOptimization: publishingJob.settings.autoOptimization,
        },
        createdAt: publishingJob.createdAt,
        completedAt: publishingJob.completedAt,
      }
    });
  });

  /**
   * @route GET /api/v1/publishing/automated/results/:jobId
   * @desc Get automated publishing job results
   * @access Private
   */
  getPublishingJobResults = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const { page = 1, limit = 10, status = 'all' } = req.query;

    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    const publishingJob = await this.publishingService.getPublishingJobStatus(jobId);

    if (!publishingJob) {
      throw new AppError('Publishing job not found', 404);
    }

    if (publishingJob.status === 'pending' || publishingJob.status === 'processing') {
      res.json({
        success: true,
        data: {
          jobId,
          type: 'automated_publishing',
          status: publishingJob.status,
          message: 'Publishing still in progress. Results will be available when completed.',
          progress: publishingJob.progress,
        }
      });
      return;
    }

    let results = publishingJob.results || [];

    // Filter by status if specified
    if (status !== 'all') {
      if (status === 'success') {
        results = results.filter(r => r.success);
      } else if (status === 'failed') {
        results = results.filter(r => !r.success);
      }
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedResults = results.slice(startIndex, endIndex);

    // Calculate summary statistics
    const summary = {
      totalPublished: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      successRate: results.length > 0
        ? Math.round((results.filter(r => r.success).length / results.length) * 100)
        : 0,
      averagePublishingTime: publishingJob.settings.delayBetweenPosts || 30000,
      performanceTrackingEnabled: results.filter(r => r.performanceTrackingEnabled).length,
    };

    res.json({
      success: true,
      data: {
        jobId,
        type: 'automated_publishing',
        status: publishingJob.status,
        summary,
        results: paginatedResults.map(result => ({
          ...result,
          publishedAt: result.publishedAt?.toISOString(),
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: results.length,
          totalPages: Math.ceil(results.length / limitNum),
          hasNextPage: endIndex < results.length,
          hasPrevPage: pageNum > 1,
        },
      }
    });
  });

  /**
   * @route GET /api/v1/publishing/automated/performance/:contentId
   * @desc Get content performance metrics
   * @access Private
   */
  getContentPerformance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { contentId } = req.params;

    if (!contentId) {
      throw new AppError('Content ID is required', 400);
    }

    const performanceMetrics = await this.publishingService.getPerformanceMetrics(contentId);

    if (!performanceMetrics) {
      throw new AppError('Performance metrics not found for this content', 404);
    }

    res.json({
      success: true,
      data: {
        contentId: performanceMetrics.contentId,
        wpPostId: performanceMetrics.wpPostId,
        publishedUrl: performanceMetrics.publishedUrl,
        publishedAt: performanceMetrics.publishedAt.toISOString(),
        currentMetrics: performanceMetrics.currentMetrics,
        seoMetrics: performanceMetrics.seoMetrics,
        qualityScore: performanceMetrics.qualityScore,
        aiProvider: performanceMetrics.aiProvider,
        trackingHistory: performanceMetrics.trackingHistory?.map(entry => ({
          ...entry,
          trackedAt: entry.trackedAt.toISOString(),
        })),
        lastTrackedAt: performanceMetrics.lastTrackedAt?.toISOString(),
        createdAt: performanceMetrics.createdAt.toISOString(),
      }
    });
  });

  /**
   * @route GET /api/v1/publishing/automated/finetuning/dataset
   * @desc Get fine-tuning dataset from high-performing content
   * @access Private (Admin only)
   */
  getFineTuningDataset = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit = 50 } = req.query;

    // Check if user is admin (in real implementation, use proper auth middleware)
    // if (req.user?.role !== 'admin') {
    //   throw new AppError('Admin access required', 403);
    // }

    const limitNum = Math.min(parseInt(limit as string, 10), 100); // Max 100 items
    const dataset = await this.publishingService.getFineTuningDataset(limitNum);

    const summary = {
      totalEntries: dataset.length,
      averageQualityRating: dataset.length > 0
        ? Math.round(
            dataset.reduce((sum, entry) => sum + (entry.qualityRating || 0), 0) / dataset.length
          )
        : 0,
      aiProviderDistribution: dataset.reduce((acc, entry) => {
        const provider = entry.performanceMetrics?.aiProvider || 'unknown';
        acc[provider] = (acc[provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      performanceRanges: {
        highPerforming: dataset.filter(e => e.qualityRating >= 8).length,
        mediumPerforming: dataset.filter(e => e.qualityRating >= 6 && e.qualityRating < 8).length,
        lowPerforming: dataset.filter(e => e.qualityRating < 6).length,
      },
    };

    res.json({
      success: true,
      data: {
        summary,
        dataset: dataset.map(entry => ({
          ...entry,
          addedAt: entry.addedAt.toISOString(),
          performanceMetrics: {
            ...entry.performanceMetrics,
            publishedAt: entry.performanceMetrics.publishedAt.toISOString(),
            createdAt: entry.performanceMetrics.createdAt.toISOString(),
          },
        })),
      }
    });
  });

  /**
   * @route PUT /api/v1/publishing/automated/jobs/:jobId/cancel
   * @desc Cancel a running automated publishing job
   * @access Private
   */
  cancelPublishingJob = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;

    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    const publishingJob = await this.publishingService.getPublishingJobStatus(jobId);

    if (!publishingJob) {
      throw new AppError('Publishing job not found', 404);
    }

    if (publishingJob.status === 'completed' || publishingJob.status === 'failed') {
      throw new AppError('Cannot cancel a job that has already completed', 400);
    }

    // In a real implementation, this would cancel the job in the queue
    // For now, just mark it as cancelled
    res.json({
      success: true,
      data: {
        jobId,
        status: 'cancelled',
        message: 'Publishing job cancellation requested',
        cancelledAt: new Date().toISOString(),
      }
    });
  });

  /**
   * @route GET /api/v1/publishing/automated/health
   * @desc Get automated publishing service health status
   * @access Public
   */
  getHealthStatus = asyncHandler(async (req: Request, res: Response) => {
    const healthStatus = await this.publishingService.getHealthStatus();

    res.json({
      success: true,
      data: {
        ...healthStatus,
        timestamp: new Date().toISOString(),
        service: 'AutomatedPublishingService',
        version: '1.0.0',
        features: {
          automatedPublishing: {
            description: 'Automated WordPress content publishing',
            maxBatchSize: 50,
            supportedPlatforms: ['wordpress'],
            averagePublishTime: '30 seconds per post'
          },
          performanceTracking: {
            description: 'Real-time content performance monitoring',
            trackingIntervals: ['24h', '7d', '30d'],
            metricsCollected: ['views', 'comments', 'shares', 'engagement', 'seo'],
            retentionPeriod: '30 days'
          },
          aiLearning: {
            description: 'AI model improvement from performance data',
            fineTuningDataset: true,
            performanceBasedOptimization: true,
            qualityRatingSystem: true
          },
          queueManagement: {
            description: 'Redis-based job queue management',
            concurrentPublishing: 3,
            performanceTracking: 2,
            retryMechanism: true
          }
        },
      }
    });
  });

  /**
   * Validate WordPress credentials
   */
  private validateWordPressCredentials(credentials: any): WordPressCredentials {
    if (!credentials.siteUrl || !credentials.username || !credentials.applicationPassword) {
      throw new AppError('WordPress credentials must include siteUrl, username, and applicationPassword', 400);
    }

    // Basic URL validation
    try {
      new URL(credentials.siteUrl);
    } catch {
      throw new AppError('Invalid WordPress site URL', 400);
    }

    return {
      siteUrl: credentials.siteUrl.trim(),
      username: credentials.username.trim(),
      applicationPassword: credentials.applicationPassword.trim(),
    };
  }

  /**
   * Validate and set default publishing settings
   */
  private validatePublishingSettings(settings: any): PublishingSettings {
    const validatedSettings: PublishingSettings = {
      status: settings.status || 'draft',
      categories: Array.isArray(settings.categories) ? settings.categories : [],
      tags: Array.isArray(settings.tags) ? settings.tags : [],
      delayBetweenPosts: Math.max(settings.delayBetweenPosts || 30000, 10000), // Min 10 seconds
      enablePerformanceTracking: settings.enablePerformanceTracking !== false, // Default true
      autoOptimization: settings.autoOptimization !== false, // Default true
    };

    // Validate status
    if (!['draft', 'publish', 'private'].includes(validatedSettings.status!)) {
      throw new AppError('Publishing status must be draft, publish, or private', 400);
    }

    // Validate delay
    if (validatedSettings.delayBetweenPosts! > 300000) { // Max 5 minutes
      throw new AppError('Delay between posts cannot exceed 5 minutes', 400);
    }

    // Validate scheduled date if provided
    if (settings.scheduledDate) {
      const scheduledDate = new Date(settings.scheduledDate);
      if (isNaN(scheduledDate.getTime())) {
        throw new AppError('Invalid scheduled date format', 400);
      }
      if (scheduledDate < new Date()) {
        throw new AppError('Scheduled date cannot be in the past', 400);
      }
      validatedSettings.scheduledDate = scheduledDate;
    }

    return validatedSettings;
  }
} 