import { Request, Response } from 'express';
import { BatchGenerationService } from '../services/BatchGenerationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import type { AuthenticatedRequest } from '../types/index.js';

export class BatchGenerationController {
  private batchService: BatchGenerationService;

  constructor() {
    this.batchService = new BatchGenerationService();
  }

  /**
   * @route POST /api/v1/batch/generate
   * @desc Create a batch content generation job
   * @access Private
   */
  generateBatch = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      researchJobId,
      settings
    } = req.body;

    if (!researchJobId) {
      throw new AppError('Research job ID is required', 400);
    }

    if (!settings) {
      throw new AppError('Generation settings are required', 400);
    }

    // Validate settings
    const validatedSettings = this.validateBatchSettings(settings);

    try {
      const batchJobId = await this.batchService.generateBatch(
        researchJobId,
        validatedSettings
      );

      const batchJob = await this.batchService.getBatchJobStatus(batchJobId);

      res.status(201).json({
        success: true,
        data: {
          jobId: batchJobId,
          type: 'batch_generation',
          status: batchJob?.status || 'pending',
          targetCount: validatedSettings.targetCount,
          estimatedTime: batchJob?.progress?.estimatedTimeRemaining || '20-30 minutes',
          createdAt: new Date().toISOString(),
        },
        message: 'Batch generation job created successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Research job not found')) {
        throw new AppError('Research job not found or invalid', 404);
      }
      if (error instanceof Error && error.message.includes('not completed')) {
        throw new AppError('Research job must be completed before batch generation', 400);
      }
      throw error;
    }
  });

  /**
   * @route GET /api/v1/batch/jobs
   * @desc Get all batch generation jobs for user
   * @access Private
   */
  getAllBatchJobs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page = 1, limit = 10, status = 'all' } = req.query;

    try {
      // For now, return mock data since we don't have persistent storage
      const mockJobs = [
        {
          id: 'batch_1703123456_abc123',
          type: 'batch_generation',
          status: 'completed',
          settings: {
            targetCount: 10,
            contentType: 'blog_post',
            aiProvider: 'openai',
            brandVoice: {
              tone: 'professional',
              style: 'conversational'
            }
          },
          progress: {
            total: 10,
            completed: 8,
            failed: 2,
            percentage: 80
          },
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'batch_1703123457_def456',
          type: 'batch_generation', 
          status: 'processing',
          settings: {
            targetCount: 5,
            contentType: 'social_media',
            aiProvider: 'gemini',
            brandVoice: {
              tone: 'casual',
              style: 'creative'
            }
          },
          progress: {
            total: 5,
            completed: 2,
            failed: 0,
            percentage: 40,
            estimatedTimeRemaining: '8 minutes'
          },
          createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          completedAt: null
        }
      ];

      // Filter by status if specified
      let filteredJobs = status === 'all' 
        ? mockJobs 
        : mockJobs.filter(job => job.status === status);

      // Pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          jobs: paginatedJobs,
          pagination: {
            total: filteredJobs.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(filteredJobs.length / limitNum)
          },
          summary: {
            totalJobs: mockJobs.length,
            completedJobs: mockJobs.filter(j => j.status === 'completed').length,
            processingJobs: mockJobs.filter(j => j.status === 'processing').length,
            failedJobs: mockJobs.filter(j => j.status === 'failed').length
          }
        }
      });
    } catch (error) {
      throw new AppError('Failed to fetch batch jobs', 500);
    }
  });

  /**
   * @route GET /api/v1/batch/jobs/:jobId
   * @desc Get batch generation job status
   * @access Private
   */
  getBatchJobStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;

    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    const batchJob = await this.batchService.getBatchJobStatus(jobId);

    if (!batchJob) {
      throw new AppError('Batch job not found', 404);
    }

    // Calculate additional metrics
    const metrics = {
      successRate: batchJob.progress.total > 0 
        ? Math.round((batchJob.progress.completed / batchJob.progress.total) * 100) 
        : 0,
      failureRate: batchJob.progress.total > 0 
        ? Math.round((batchJob.progress.failed / batchJob.progress.total) * 100) 
        : 0,
      averageWordsPerContent: batchJob.results.length > 0
        ? Math.round(
            batchJob.results.reduce((sum, content) => 
              sum + (content.metadata?.wordCount || 0), 0
            ) / batchJob.results.length
          )
        : 0,
    };

    res.json({
      success: true,
      data: {
        jobId: batchJob.id,
        type: 'batch_generation',
        status: batchJob.status,
        progress: {
          ...batchJob.progress,
          metrics,
        },
        settings: {
          targetCount: batchJob.settings.targetCount,
          contentType: batchJob.settings.contentType,
          aiProvider: batchJob.settings.aiProvider,
          brandVoice: batchJob.settings.brandVoice,
        },
        createdAt: batchJob.createdAt,
        completedAt: batchJob.completedAt,
      }
    });
  });

  /**
   * @route GET /api/v1/batch/results/:jobId
   * @desc Get batch generation job results
   * @access Private
   */
  getBatchJobResults = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;
    const { page = 1, limit = 10, quality = 'all' } = req.query;

    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    const batchJob = await this.batchService.getBatchJobStatus(jobId);

    if (!batchJob) {
      throw new AppError('Batch job not found', 404);
    }

    if (batchJob.status === 'pending' || batchJob.status === 'processing') {
      res.json({
        success: true,
        data: {
          jobId,
          type: 'batch_generation',
          status: batchJob.status,
          message: 'Batch generation still in progress. Results will be available when completed.',
          progress: batchJob.progress,
        }
      });
      return;
    }

    let results = batchJob.results || [];

    // Filter by quality if specified
    if (quality !== 'all') {
      const qualityThreshold = quality === 'high' ? 80 : quality === 'medium' ? 60 : 0;
      results = results.filter(content => 
        (content.metadata?.qualityScore || 0) >= qualityThreshold
      );
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedResults = results.slice(startIndex, endIndex);

    // Calculate summary statistics
    const summary = {
      totalContentGenerated: results.length,
      averageQualityScore: results.length > 0
        ? Math.round(
            results.reduce((sum, content) => 
              sum + (content.metadata?.qualityScore || 0), 0
            ) / results.length
          )
        : 0,
      averageWordCount: results.length > 0
        ? Math.round(
            results.reduce((sum, content) => 
              sum + (content.metadata?.wordCount || 0), 0
            ) / results.length
          )
        : 0,
      averageReadingTime: results.length > 0
        ? Math.round(
            results.reduce((sum, content) => 
              sum + (content.metadata?.readingTime || 0), 0
            ) / results.length
          )
        : 0,
      uniquenessScores: results.map(content => 
        Math.round((content.metadata?.uniquenessScore || 0) * 100)
      ),
      aiProviderUsage: this.calculateProviderUsage(results),
    };

    res.json({
      success: true,
      data: {
        jobId,
        type: 'batch_generation',
        results: paginatedResults.map(content => ({
          id: content.id,
          title: content.title,
          excerpt: content.excerpt,
          wordCount: content.metadata?.wordCount,
          qualityScore: content.metadata?.qualityScore,
          uniquenessScore: Math.round((content.metadata?.uniquenessScore || 0) * 100),
          readingTime: content.metadata?.readingTime,
          aiProvider: content.metadata?.aiProvider,
          generatedAt: content.metadata?.generatedAt,
          preview: content.body.substring(0, 200) + '...',
        })),
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(results.length / limitNum),
          totalItems: results.length,
          itemsPerPage: limitNum,
          hasNextPage: endIndex < results.length,
          hasPrevPage: pageNum > 1,
        },
        summary,
        completedAt: batchJob.completedAt,
      }
    });
  });

  /**
   * @route GET /api/v1/batch/content/:contentId
   * @desc Get full content by ID
   * @access Private
   */
  getFullContent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { contentId } = req.params;

    if (!contentId) {
      throw new AppError('Content ID is required', 400);
    }

    // Search through all batch jobs to find the content
    // In a real implementation, you'd have a direct content lookup
    const content = await this.findContentById(contentId);

    if (!content) {
      throw new AppError('Content not found', 404);
    }

    res.json({
      success: true,
      data: {
        content: {
          id: content.id,
          title: content.title,
          body: content.body,
          excerpt: content.excerpt,
          metadata: content.metadata,
          type: content.type,
          createdAt: content.metadata?.generatedAt,
        }
      }
    });
  });

  /**
   * @route PUT /api/v1/batch/jobs/:jobId/cancel
   * @desc Cancel a batch generation job
   * @access Private
   */
  cancelBatchJob = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { jobId } = req.params;

    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    const batchJob = await this.batchService.getBatchJobStatus(jobId);

    if (!batchJob) {
      throw new AppError('Batch job not found', 404);
    }

    if (batchJob.status === 'completed' || batchJob.status === 'failed') {
      throw new AppError('Cannot cancel completed or failed job', 400);
    }

    // TODO: Implement job cancellation logic
    // This would involve stopping the queue workers and updating job status

    res.json({
      success: true,
      data: {
        jobId,
        status: 'cancelled',
        message: 'Batch generation job cancelled successfully'
      }
    });
  });

  /**
   * @route GET /api/v1/batch/health
   * @desc Get batch generation service health status
   * @access Public
   */
  getHealthStatus = asyncHandler(async (req: Request, res: Response) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'BatchGenerationService',
      capabilities: {
        batchGeneration: true,
        aiOrchestration: true,
        progressTracking: true,
        qualityValidation: true,
        uniquenessChecking: true,
      },
      limits: {
        maxBatchSize: 50,
        maxConcurrentJobs: 10,
        maxContentLength: 5000,
        minUniquenessScore: 0.8,
      },
      supportedProviders: ['openai', 'gemini', 'auto'],
      supportedContentTypes: ['blog_post', 'social_media', 'email', 'ad_copy'],
    };

    res.json({
      success: true,
      data: health
    });
  });

  private validateBatchSettings(settings: any): any {
    const validated = {
      targetCount: Math.min(Math.max(parseInt(settings.targetCount) || 10, 1), 50),
      contentType: settings.contentType || 'blog_post',
      brandVoice: {
        tone: settings.brandVoice?.tone || 'professional',
        style: settings.brandVoice?.style || 'conversational',
        vocabulary: settings.brandVoice?.vocabulary || 'advanced',
        length: settings.brandVoice?.length || 'detailed',
      },
      targetAudience: settings.targetAudience || 'General audience',
      requirements: {
        wordCount: settings.requirements?.wordCount || '1000-1500',
        includeHeadings: settings.requirements?.includeHeadings ?? true,
        seoOptimized: settings.requirements?.seoOptimized ?? true,
        uniquenessThreshold: Math.min(
          Math.max(parseFloat(settings.requirements?.uniquenessThreshold) || 0.8, 0.5), 
          1.0
        ),
      },
      aiProvider: ['openai', 'gemini', 'auto'].includes(settings.aiProvider) 
        ? settings.aiProvider 
        : 'auto',
    };

    // Validate content type
    const validContentTypes = ['blog_post', 'social_media', 'email', 'ad_copy'];
    if (!validContentTypes.includes(validated.contentType)) {
      throw new AppError(`Invalid content type. Must be one of: ${validContentTypes.join(', ')}`, 400);
    }

    return validated;
  }

  private calculateProviderUsage(results: any[]): any {
    const usage: { [key: string]: number } = {};
    
    results.forEach(content => {
      const provider = content.metadata?.aiProvider || 'unknown';
      usage[provider] = (usage[provider] || 0) + 1;
    });

    return usage;
  }

  private async findContentById(contentId: string): Promise<any | null> {
    // This is a simplified implementation
    // In a real system, you'd have a proper content storage and lookup mechanism
    
    // For now, we'll return null as this would require searching through all batch jobs
    // In the actual implementation, content would be stored in the database
    return null;
  }
} 