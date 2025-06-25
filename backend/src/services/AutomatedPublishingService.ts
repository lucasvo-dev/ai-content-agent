// Ensure environment variables are loaded
import dotenv from 'dotenv';
dotenv.config();

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { WordPressService } from './WordPressService.js';
import { AdminReviewService } from './AdminReviewService.js';
import {
  AutomatedPublishingJob,
  PublishingTask,
  PublishingResult,
  ContentPerformanceMetrics,
  WordPressCredentials,
  GeneratedContent,
  PublishingSettings
} from '../types/index.js';

interface PublishingJobData {
  jobId: string;
  contentIds: string[];
  wpCredentials: WordPressCredentials;
  settings: PublishingSettings;
  batchSize: number;
}

interface PublishingTaskData {
  taskId: string;
  jobId: string;
  contentId: string;
  wpCredentials: WordPressCredentials;
  settings: PublishingSettings;
  delay: number;
}

export class AutomatedPublishingService {
  private redis: Redis;
  private publishingQueue: Queue;
  private performanceQueue: Queue;
  private adminReviewService: AdminReviewService;
  private isInitialized = false;

  // Performance tracking storage
  private performanceMetrics: Map<string, ContentPerformanceMetrics> = new Map();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    });

    this.publishingQueue = new Queue('automated-publishing', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10 seconds
        },
      },
    });

    this.performanceQueue = new Queue('performance-tracking', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 50,
        attempts: 2,
        delay: 24 * 60 * 60 * 1000, // 24 hours delay for performance tracking
      },
    });

    this.adminReviewService = new AdminReviewService();
    this.initializeWorkers();
  }

  private async initializeWorkers(): Promise<void> {
    // Publishing worker
    new Worker(
      'automated-publishing',
      async (job) => {
        const { type } = job.data;
        
        switch (type) {
          case 'batch-publish':
            return await this.processBatchPublishing(job.data);
          case 'publish-content':
            return await this.processContentPublishing(job.data);
          default:
            throw new Error(`Unknown publishing job type: ${type}`);
        }
      },
      {
        connection: this.redis,
        concurrency: 3, // Limit concurrent WordPress API calls
      }
    );

    // Performance tracking worker
    new Worker(
      'performance-tracking',
      async (job) => {
        const { type } = job.data;
        
        switch (type) {
          case 'track-performance':
            return await this.trackContentPerformance(job.data);
          case 'analyze-trends':
            return await this.analyzePerformanceTrends(job.data);
          default:
            throw new Error(`Unknown performance job type: ${type}`);
        }
      },
      {
        connection: this.redis,
        concurrency: 2,
      }
    );

    console.log('AutomatedPublishingService initialized successfully');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  /**
   * Schedule automated publishing for approved content
   */
  async scheduleAutomatedPublishing(
    contentIds: string[],
    wpCredentials: WordPressCredentials,
    settings: PublishingSettings
  ): Promise<string> {
    await this.initialize();

    const jobId = `autopub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate WordPress credentials
    const wpService = new WordPressService(wpCredentials);
    const connectionTest = await wpService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`WordPress connection failed: ${connectionTest.message}`);
    }

    // Create publishing job
    const publishingJob: AutomatedPublishingJob = {
      id: jobId,
      contentIds,
      wpCredentials,
      settings: {
        status: settings.status || 'draft',
        categories: settings.categories || [],
        tags: settings.tags || [],
        scheduledDate: settings.scheduledDate,
        delayBetweenPosts: settings.delayBetweenPosts || 30000, // 30 seconds
        enablePerformanceTracking: settings.enablePerformanceTracking ?? true,
        autoOptimization: settings.autoOptimization ?? true,
        ...settings,
      },
      status: 'pending',
      progress: {
        total: contentIds.length,
        published: 0,
        failed: 0,
        processing: 0,
        percentage: 0,
        currentStage: 'Initializing automated publishing',
        estimatedTimeRemaining: `${Math.ceil(contentIds.length * 0.5)} minutes`,
      },
      results: [],
      createdAt: new Date(),
    };

    // Store job data
    await this.redis.setex(
      `autopub_job:${jobId}`,
      7200, // 2 hours TTL
      JSON.stringify(publishingJob)
    );

    // Queue batch publishing job
    await this.publishingQueue.add('batch-publish', {
      type: 'batch-publish',
      jobId,
      contentIds,
      wpCredentials,
      settings: publishingJob.settings,
      batchSize: Math.min(contentIds.length, 10), // Max 10 per batch
    });

    return jobId;
  }

  /**
   * Get publishing job status
   */
  async getPublishingJobStatus(jobId: string): Promise<AutomatedPublishingJob | null> {
    const jobData = await this.redis.get(`autopub_job:${jobId}`);
    if (!jobData) return null;

    return JSON.parse(jobData);
  }

  /**
   * Get publishing job results
   */
  async getPublishingJobResults(jobId: string): Promise<PublishingResult[]> {
    const job = await this.getPublishingJobStatus(jobId);
    if (!job) {
      throw new Error('Publishing job not found');
    }

    return job.results || [];
  }

  /**
   * Process batch publishing
   */
  private async processBatchPublishing(jobData: PublishingJobData): Promise<void> {
    const { jobId, contentIds, wpCredentials, settings } = jobData;

    try {
      await this.updatePublishingJobStatus(jobId, 'processing', {
        currentStage: 'Starting automated publishing',
      });

      // Create individual publishing tasks
      const tasks = contentIds.map((contentId, index) => ({
        taskId: `${jobId}_task_${index}`,
        jobId,
        contentId,
        wpCredentials,
        settings,
        delay: index * (settings.delayBetweenPosts || 30000),
      }));

      // Queue individual publishing tasks
      for (const task of tasks) {
        await this.publishingQueue.add('publish-content', {
          type: 'publish-content',
          ...task,
        }, {
          delay: task.delay,
        });
      }

      console.log(`Queued ${tasks.length} content publishing tasks for job ${jobId}`);
    } catch (error) {
      await this.updatePublishingJobStatus(jobId, 'failed', {
        currentStage: 'Failed to start publishing',
      });
      throw error;
    }
  }

  /**
   * Process individual content publishing
   */
  private async processContentPublishing(taskData: PublishingTaskData): Promise<PublishingResult> {
    const { taskId, jobId, contentId, wpCredentials, settings } = taskData;

    try {
      // Update job progress
      await this.updatePublishingJobProgress(jobId, 'processing', taskId);

      // Get approved content from admin review service
      const content = await this.adminReviewService.getApprovedContent(contentId);
      
      if (!content) {
        throw new Error('Content not found or not approved');
      }

      // Create WordPress service instance
      const wpService = new WordPressService(wpCredentials);

      // Prepare publishing settings
      const publishSettings = {
        status: settings.status || 'draft',
        categories: settings.categories || [],
        tags: settings.tags || [],
        scheduledDate: settings.scheduledDate,
        seoTitle: content.metadata?.seoTitle,
        seoDescription: content.metadata?.seoDescription,
        featuredImageUrl: await this.generateFeaturedImage(content),
      };

      // Convert GeneratedContent to Content format for WordPress service
      const contentForPublishing: any = {
        id: content.id,
        title: content.title,
        body: content.body,
        excerpt: content.excerpt,
        type: content.type,
        status: content.status,
        authorId: 'automated-publishing', // Default for automated publishing
        projectId: content.metadata?.batchJobId || 'batch-generated',
        metadata: {
          keywords: content.metadata?.keywords || [],
          seoTitle: content.metadata?.seoTitle,
          seoDescription: content.metadata?.seoDescription,
          featuredImage: content.metadata?.featuredImageSuggestion,
          wordCount: content.metadata?.wordCount || 0,
          readingTime: content.metadata?.readingTime || 0,
          targetAudience: 'General',
          seoScore: content.metadata?.seoScore,
          responseTime: 0,
          finishReason: 'completed',
          safetyRatings: [],
        },
        aiGenerated: true,
        qualityScore: content.metadata?.qualityScore,
        createdAt: content.generatedAt,
        updatedAt: content.generatedAt,
      };

      // Publish to WordPress
      const publishResult = await wpService.publishContent(contentForPublishing, publishSettings);

      // Create performance tracking entry
      const performanceMetrics: ContentPerformanceMetrics = {
        contentId,
        wpPostId: publishResult.externalId,
        publishedUrl: publishResult.externalUrl,
        publishedAt: publishResult.publishedAt || new Date(),
        initialMetrics: {
          views: 0,
          comments: 0,
          shares: 0,
          engagementRate: 0,
          averageTimeOnPage: 0,
        },
        seoMetrics: {
          keywordRankings: {},
          organicTraffic: 0,
          clickThroughRate: 0,
          bounceRate: 0,
        },
        qualityScore: content.metadata?.qualityScore || 0,
        aiProvider: content.metadata?.aiProvider || content.aiProvider || 'unknown',
        createdAt: new Date(),
      };

      // Store performance metrics
      await this.redis.setex(
        `performance:${contentId}`,
        30 * 24 * 60 * 60, // 30 days TTL
        JSON.stringify(performanceMetrics)
      );

      // Schedule performance tracking
      if (settings.enablePerformanceTracking) {
        await this.schedulePerformanceTracking(contentId, publishResult.externalId);
      }

      // Update job progress
      const result: PublishingResult = {
        taskId: taskId,
        contentId,
        targetId: 'wordpress',
        success: true,
        wordpressId: publishResult.externalId,
        url: publishResult.externalUrl,
        publishedAt: publishResult.publishedAt || new Date(),
        performanceTrackingEnabled: settings.enablePerformanceTracking ?? true,
      };

      await this.updatePublishingJobProgress(jobId, 'completed', taskId, result);

      return result;
    } catch (error) {
      const result: PublishingResult = {
        taskId: taskId,
        contentId,
        targetId: 'wordpress',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      await this.updatePublishingJobProgress(jobId, 'failed', taskId, result);
      throw error;
    }
  }

  /**
   * Schedule performance tracking for published content
   */
  private async schedulePerformanceTracking(contentId: string, wpPostId: string): Promise<void> {
    // Schedule performance tracking at different intervals
    const trackingIntervals = [
      { delay: 24 * 60 * 60 * 1000, label: '24h' }, // 24 hours
      { delay: 7 * 24 * 60 * 60 * 1000, label: '7d' }, // 7 days
      { delay: 30 * 24 * 60 * 60 * 1000, label: '30d' }, // 30 days
    ];

    for (const interval of trackingIntervals) {
      await this.performanceQueue.add('track-performance', {
        type: 'track-performance',
        contentId,
        wpPostId,
        trackingPeriod: interval.label,
      }, {
        delay: interval.delay,
      });
    }
  }

  /**
   * Track content performance
   */
  private async trackContentPerformance(data: any): Promise<void> {
    const { contentId, wpPostId, trackingPeriod } = data;

    try {
      // Get current performance metrics
      const metricsData = await this.redis.get(`performance:${contentId}`);
      if (!metricsData) {
        console.warn(`Performance metrics not found for content ${contentId}`);
        return;
      }

      const metrics: ContentPerformanceMetrics = JSON.parse(metricsData);

      // Collect WordPress performance data (mock implementation)
      const wpMetrics = await this.collectWordPressMetrics(wpPostId);

      // Update metrics
      metrics.currentMetrics = {
        views: wpMetrics.views,
        comments: wpMetrics.comments,
        shares: wpMetrics.shares,
        engagementRate: wpMetrics.engagementRate,
        averageTimeOnPage: wpMetrics.averageTimeOnPage,
      };

      metrics.seoMetrics = {
        ...metrics.seoMetrics,
        organicTraffic: wpMetrics.organicTraffic,
        clickThroughRate: wpMetrics.clickThroughRate,
        bounceRate: wpMetrics.bounceRate,
      };

      metrics.lastTrackedAt = new Date();
      metrics.trackingHistory = metrics.trackingHistory || [];
      metrics.trackingHistory.push({
        period: trackingPeriod,
        trackedAt: new Date(),
        metrics: metrics.currentMetrics,
      });

      // Store updated metrics
      await this.redis.setex(
        `performance:${contentId}`,
        30 * 24 * 60 * 60, // 30 days TTL
        JSON.stringify(metrics)
      );

      // Add to fine-tuning dataset if performance is good
      if (this.isHighPerformingContent(metrics)) {
        await this.addToFineTuningDataset(contentId, metrics);
      }

      console.log(`Performance tracked for content ${contentId} (${trackingPeriod}):`, {
        views: metrics.currentMetrics?.views,
        engagementRate: metrics.currentMetrics?.engagementRate,
      });
    } catch (error) {
      console.error(`Failed to track performance for content ${contentId}:`, error);
    }
  }

  /**
   * Analyze performance trends
   */
  private async analyzePerformanceTrends(data: any): Promise<void> {
    // Implementation for analyzing performance trends across all content
    // This would feed back into AI optimization
    console.log('Analyzing performance trends...');
  }

  /**
   * Mock WordPress metrics collection
   */
  private async collectWordPressMetrics(wpPostId: string): Promise<any> {
    // In a real implementation, this would integrate with WordPress analytics
    // For now, return mock data
    return {
      views: Math.floor(Math.random() * 1000) + 100,
      comments: Math.floor(Math.random() * 20),
      shares: Math.floor(Math.random() * 50),
      engagementRate: Math.random() * 0.1 + 0.02, // 2-12%
      averageTimeOnPage: Math.floor(Math.random() * 180) + 60, // 60-240 seconds
      organicTraffic: Math.floor(Math.random() * 500) + 50,
      clickThroughRate: Math.random() * 0.05 + 0.01, // 1-6%
      bounceRate: Math.random() * 0.3 + 0.4, // 40-70%
    };
  }

  /**
   * Check if content is high-performing
   */
  private isHighPerformingContent(metrics: ContentPerformanceMetrics): boolean {
    if (!metrics.currentMetrics) return false;

    const { views, engagementRate } = metrics.currentMetrics;
    
    // High-performing criteria
    return (
      views > 500 && 
      engagementRate > 0.05 && 
      metrics.qualityScore > 80
    );
  }

  /**
   * Add high-performing content to fine-tuning dataset
   */
  private async addToFineTuningDataset(
    contentId: string, 
    metrics: ContentPerformanceMetrics
  ): Promise<void> {
    try {
      // Get content data
      const content = await this.adminReviewService.getApprovedContent(contentId);
      if (!content) return;

      // Create fine-tuning entry
      const fineTuningEntry = {
        contentId,
        content,
        performanceMetrics: metrics,
        qualityRating: this.calculatePerformanceQualityRating(metrics),
        addedAt: new Date(),
      };

      // Store in fine-tuning dataset
      await this.redis.lpush(
        'finetuning_dataset',
        JSON.stringify(fineTuningEntry)
      );

      console.log(`Added high-performing content ${contentId} to fine-tuning dataset`);
    } catch (error) {
      console.error(`Failed to add content ${contentId} to fine-tuning dataset:`, error);
    }
  }

  /**
   * Calculate performance-based quality rating
   */
  private calculatePerformanceQualityRating(metrics: ContentPerformanceMetrics): number {
    if (!metrics.currentMetrics) return 5;

    const { views, engagementRate } = metrics.currentMetrics;
    
    let rating = 5; // Base rating
    
    // Views contribution (0-3 points)
    if (views > 1000) rating += 3;
    else if (views > 500) rating += 2;
    else if (views > 200) rating += 1;
    
    // Engagement contribution (0-2 points)
    if (engagementRate > 0.08) rating += 2;
    else if (engagementRate > 0.05) rating += 1;
    
    return Math.min(rating, 10);
  }

  /**
   * Generate featured image for content
   */
  private async generateFeaturedImage(content: GeneratedContent): Promise<string | undefined> {
    // Mock featured image generation
    // In real implementation, this would use AI image generation
    if (content.metadata?.featuredImageSuggestion) {
      return `https://via.placeholder.com/800x400?text=${encodeURIComponent(content.title)}`;
    }
    return undefined;
  }

  /**
   * Update publishing job status
   */
  private async updatePublishingJobStatus(
    jobId: string,
    status: AutomatedPublishingJob['status'],
    progressUpdate?: Partial<AutomatedPublishingJob['progress']>
  ): Promise<void> {
    const jobData = await this.redis.get(`autopub_job:${jobId}`);
    if (!jobData) return;

    const job: AutomatedPublishingJob = JSON.parse(jobData);
    job.status = status;
    
    if (progressUpdate) {
      job.progress = { ...job.progress, ...progressUpdate };
    }

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    await this.redis.setex(
      `autopub_job:${jobId}`,
      7200,
      JSON.stringify(job)
    );
  }

  /**
   * Update publishing job progress
   */
  private async updatePublishingJobProgress(
    jobId: string,
    taskStatus: 'processing' | 'completed' | 'failed',
    taskId: string,
    result?: PublishingResult
  ): Promise<void> {
    const jobData = await this.redis.get(`autopub_job:${jobId}`);
    if (!jobData) return;

    const job: AutomatedPublishingJob = JSON.parse(jobData);

    // Update counters
    if (taskStatus === 'completed') {
      job.progress.published++;
      if (result) {
        job.results = job.results || [];
        job.results.push(result);
      }
    } else if (taskStatus === 'failed') {
      job.progress.failed++;
      if (result) {
        job.results = job.results || [];
        job.results.push(result);
      }
    }

    // Update percentage
    const completed = job.progress.published + job.progress.failed;
    job.progress.percentage = Math.round((completed / job.progress.total) * 100);

    // Update status if all tasks completed
    if (completed >= job.progress.total) {
      job.status = job.progress.failed === 0 ? 'completed' : 'partially_completed';
      job.progress.currentStage = 'Publishing completed';
      job.completedAt = new Date();
    } else {
      job.progress.currentStage = `Publishing content (${completed}/${job.progress.total})`;
    }

    await this.redis.setex(
      `autopub_job:${jobId}`,
      7200,
      JSON.stringify(job)
    );
  }

  /**
   * Get performance metrics for content
   */
  async getPerformanceMetrics(contentId: string): Promise<ContentPerformanceMetrics | null> {
    const metricsData = await this.redis.get(`performance:${contentId}`);
    if (!metricsData) return null;

    return JSON.parse(metricsData);
  }

  /**
   * Get fine-tuning dataset
   */
  async getFineTuningDataset(limit: number = 100): Promise<any[]> {
    const dataset = await this.redis.lrange('finetuning_dataset', 0, limit - 1);
    return dataset.map(entry => JSON.parse(entry));
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<void> {
    await this.publishingQueue.close();
    await this.performanceQueue.close();
    await this.redis.disconnect();
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<any> {
    const queueHealth = await this.publishingQueue.getWaiting();
    const performanceQueueHealth = await this.performanceQueue.getWaiting();
    
    return {
      status: 'healthy',
      publishingQueue: {
        waiting: queueHealth.length,
        active: (await this.publishingQueue.getActive()).length,
      },
      performanceQueue: {
        waiting: performanceQueueHealth.length,
        active: (await this.performanceQueue.getActive()).length,
      },
      capabilities: {
        automatedPublishing: true,
        performanceTracking: true,
        aiLearning: true,
        fineTuning: true,
      },
    };
  }
} 