// Ensure environment variables are loaded
import dotenv from 'dotenv';
dotenv.config();

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { WordPressService } from './WordPressService.js';
import { WordPressMultiSiteService, MultiSitePublishingRequest } from './WordPressMultiSiteService.js';
import { AdminReviewService } from './AdminReviewService.js';
import {
  AutomatedPublishingJob,
  PublishingTask,
  PublishingResult as TypesPublishingResult,
  ContentPerformanceMetrics,
  WordPressCredentials,
  GeneratedContent,
  PublishingSettings
} from '../types/index.js';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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

export interface PublishingSchedule {
  id: string;
  contentId: string;
  targetId: string; // WordPress site ID or social platform ID
  platform: 'wordpress' | 'facebook' | 'twitter' | 'linkedin';
  scheduledDate: Date;
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  publishedAt?: Date;
  publishedUrl?: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface PublishingTarget {
  id: string;
  platform: 'wordpress' | 'facebook' | 'twitter' | 'linkedin';
  name: string;
  credentials: {
    [key: string]: any;
  };
  isActive: boolean;
  lastUsed?: Date;
  publishCount: number;
  successRate: number;
}

export interface AutomatedPublishingResult {
  success: boolean;
  scheduleId?: string;
  contentId: string;
  platform: string;
  publishedUrl?: string;
  publishedAt?: Date;
  errorMessage?: string;
  retryAfter?: Date;
}

export class AutomatedPublishingService {
  private redis: Redis;
  private publishingQueue: Queue;
  private performanceQueue: Queue;
  private adminReviewService: AdminReviewService;
  private isInitialized = false;
  private wordPressService: WordPressService;
  private wordPressMultiSiteService: WordPressMultiSiteService;
  private publishingSchedules: Map<string, PublishingSchedule> = new Map();
  private publishingTargets: Map<string, PublishingTarget> = new Map();
  private publishingTimer: NodeJS.Timeout | null = null;

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
    // this.wordPressService = new WordPressService();  // Will initialize later
    this.wordPressMultiSiteService = new WordPressMultiSiteService();
    this.initializeWorkers();
    this.initializeDefaultTargets();
    this.startPublishingScheduler();
    
    logger.info('📢 AutomatedPublishingService initialized');
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
  async getPublishingJobResults(jobId: string): Promise<AutomatedPublishingResult[]> {
    const job = await this.getPublishingJobStatus(jobId);
    if (!job) {
      throw new Error('Publishing job not found');
    }

    return job.results?.map(r => ({
      ...r,
      platform: 'wordpress'
    } as AutomatedPublishingResult)) || [];
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
  private async processContentPublishing(taskData: PublishingTaskData): Promise<AutomatedPublishingResult> {
    const { taskId, jobId, contentId, wpCredentials, settings } = taskData;

    try {
      // Update job progress
      await this.updatePublishingJobProgress(jobId, 'processing', taskId);

      // Get approved content from admin review service
      const approvedResult = await this.adminReviewService.getApprovedContent({ limit: 1 });
      const contentItem = approvedResult.items.find(item => item.content.id === contentId);
      
      if (!contentItem) {
        throw new Error('Content not found or not approved');
      }
      
      const content = contentItem.content;

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
        featuredImageUrl: await this.generateFeaturedImage({
          title: content.title,
          body: content.body,
          type: content.type as any,
          status: 'approved' as any,
          metadata: content.metadata
        } as any),
      };

      // Convert GeneratedContent to Content format for WordPress service
      const contentForPublishing: any = {
        id: content.id,
        title: content.title,
        body: content.body,
        excerpt: content.excerpt || '',
        type: content.type,
        status: 'approved',
        authorId: 'automated-publishing', // Default for automated publishing
        projectId: 'batch-generated',
        metadata: {
          keywords: content.metadata?.keywords || [],
          seoTitle: content.metadata?.seoTitle,
          seoDescription: content.metadata?.seoDescription,
          featuredImage: '',
          wordCount: this.calculateWordCount(content.body),
          readingTime: this.calculateReadingTime(content.body),
          targetAudience: 'General',
                      seoScore: 0,
          responseTime: 0,
          finishReason: 'completed',
          safetyRatings: [],
        },
        aiGenerated: true,
        qualityScore: contentItem.qualityScore,
        createdAt: contentItem.submittedAt,
        updatedAt: contentItem.reviewedAt || contentItem.submittedAt,
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
        qualityScore: contentItem.qualityScore || 0,
        aiProvider: contentItem.aiProvider || 'unknown',
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
      const result: any = {
        taskId: taskId,
        contentId,
        targetId: 'wordpress',
        platform: 'wordpress',
        success: true,
        externalId: publishResult.externalId,
        externalUrl: publishResult.externalUrl,
        publishedAt: publishResult.publishedAt || new Date(),
        performanceTrackingEnabled: settings.enablePerformanceTracking ?? true,
      };

      await this.updatePublishingJobProgress(jobId, 'completed', taskId, result);

      return result;
    } catch (error) {
      const result: any = {
        taskId: taskId,
        contentId,
        targetId: 'wordpress',
        platform: 'wordpress',
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
      const approvedResult = await this.adminReviewService.getApprovedContent({ limit: 1 });
      const contentItem = approvedResult.items.find(item => item.content.id === contentId);
      if (!contentItem) return;
      
      const content = contentItem.content;

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
    result?: AutomatedPublishingResult
  ): Promise<void> {
    const jobData = await this.redis.get(`autopub_job:${jobId}`);
    if (!jobData) return;

    const job: AutomatedPublishingJob = JSON.parse(jobData);

    // Update counters
    if (taskStatus === 'completed') {
      job.progress.published++;
      if (result) {
        job.results = job.results || [];
        job.results.push({
          ...result,
          taskId: taskId,
          targetId: 'wordpress'
        } as any);
      }
    } else if (taskStatus === 'failed') {
      job.progress.failed++;
      if (result) {
        job.results = job.results || [];
        job.results.push({
          ...result,
          taskId: taskId,
          targetId: 'wordpress'
        } as any);
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

  /**
   * Schedule content for publishing
   */
  async schedulePublishing(params: {
    contentId: string;
    targetId: string;
    scheduledDate: Date;
    platform?: 'wordpress' | 'facebook' | 'twitter' | 'linkedin';
    maxRetries?: number;
  }): Promise<string> {
    const target = this.publishingTargets.get(params.targetId);
    
    if (!target) {
      throw new Error(`Publishing target not found: ${params.targetId}`);
    }

    const scheduleId = uuidv4();
    const schedule: PublishingSchedule = {
      id: scheduleId,
      contentId: params.contentId,
      targetId: params.targetId,
      platform: params.platform || target.platform,
      scheduledDate: params.scheduledDate,
      status: 'scheduled',
      retryCount: 0,
      maxRetries: params.maxRetries || 3,
      createdAt: new Date()
    };

    this.publishingSchedules.set(scheduleId, schedule);

    logger.info(`📅 Content scheduled for publishing`, {
      scheduleId,
      contentId: params.contentId,
      platform: schedule.platform,
      scheduledDate: params.scheduledDate.toISOString()
    });

    return scheduleId;
  }

  /**
   * Cancel scheduled publishing
   */
  async cancelScheduledPublishing(scheduleId: string): Promise<boolean> {
    const schedule = this.publishingSchedules.get(scheduleId);
    
    if (!schedule) {
      logger.warn(`Schedule not found: ${scheduleId}`);
      return false;
    }

    if (schedule.status === 'published') {
      logger.warn(`Cannot cancel already published content: ${scheduleId}`);
      return false;
    }

    schedule.status = 'cancelled';
    
    logger.info(`❌ Publishing cancelled: ${scheduleId}`);
    return true;
  }

  /**
   * Execute immediate publishing
   */
  async publishNow(contentId: string, targetId: string): Promise<AutomatedPublishingResult> {
    const target = this.publishingTargets.get(targetId);
    
    if (!target) {
      return {
        success: false,
        scheduleId: 'immediate',
        contentId,
        platform: 'unknown',
        errorMessage: `Publishing target not found: ${targetId}`
      };
    }

    return await this.executePublishing(contentId, target);
  }

  /**
   * Get scheduled publishing items
   */
  getScheduledPublishing(filters: {
    contentId?: string;
    platform?: string;
    status?: PublishingSchedule['status'];
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): PublishingSchedule[] {
    let schedules = Array.from(this.publishingSchedules.values());

    // Apply filters
    if (filters.contentId) {
      schedules = schedules.filter(s => s.contentId === filters.contentId);
    }

    if (filters.platform) {
      schedules = schedules.filter(s => s.platform === filters.platform);
    }

    if (filters.status) {
      schedules = schedules.filter(s => s.status === filters.status);
    }

    if (filters.dateFrom) {
      schedules = schedules.filter(s => s.scheduledDate >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      schedules = schedules.filter(s => s.scheduledDate <= filters.dateTo!);
    }

    // Sort by scheduled date
    schedules.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

    return schedules;
  }

  /**
   * Add publishing target
   */
  async addPublishingTarget(target: Omit<PublishingTarget, 'id' | 'publishCount' | 'successRate'>): Promise<string> {
    const targetId = uuidv4();
    const publishingTarget: PublishingTarget = {
      ...target,
      id: targetId,
      publishCount: 0,
      successRate: 100
    };

    this.publishingTargets.set(targetId, publishingTarget);

    logger.info(`🎯 Publishing target added: ${target.name}`, {
      targetId,
      platform: target.platform
    });

    return targetId;
  }

  /**
   * Update publishing target
   */
  async updatePublishingTarget(
    targetId: string, 
    updates: Partial<Omit<PublishingTarget, 'id' | 'publishCount' | 'successRate'>>
  ): Promise<boolean> {
    const target = this.publishingTargets.get(targetId);
    
    if (!target) {
      logger.warn(`Publishing target not found: ${targetId}`);
      return false;
    }

    Object.assign(target, updates);

    logger.info(`✏️ Publishing target updated: ${target.name}`, { targetId });
    return true;
  }

  /**
   * Remove publishing target
   */
  async removePublishingTarget(targetId: string): Promise<boolean> {
    const target = this.publishingTargets.get(targetId);
    
    if (!target) {
      logger.warn(`Publishing target not found: ${targetId}`);
      return false;
    }

    // Cancel any scheduled publishing for this target
    const schedules = Array.from(this.publishingSchedules.values())
      .filter(s => s.targetId === targetId && s.status === 'scheduled');

    schedules.forEach(schedule => {
      schedule.status = 'cancelled';
    });

    this.publishingTargets.delete(targetId);

    logger.info(`🗑️ Publishing target removed: ${target.name}`, { targetId });
    return true;
  }

  /**
   * Get publishing statistics
   */
  getPublishingStats(): {
    scheduled: number;
    published: number;
    failed: number;
    cancelled: number;
    platforms: {
      [platform: string]: {
        published: number;
        failed: number;
        successRate: number;
      };
    };
    recentActivity: Array<{
      date: string;
      published: number;
      failed: number;
    }>;
  } {
    const schedules = Array.from(this.publishingSchedules.values());
    
    const scheduled = schedules.filter(s => s.status === 'scheduled').length;
    const published = schedules.filter(s => s.status === 'published').length;
    const failed = schedules.filter(s => s.status === 'failed').length;
    const cancelled = schedules.filter(s => s.status === 'cancelled').length;

    // Platform statistics
    const platforms: any = {};
    schedules.forEach(schedule => {
      if (!platforms[schedule.platform]) {
        platforms[schedule.platform] = {
          published: 0,
          failed: 0,
          successRate: 0
        };
      }

      if (schedule.status === 'published') {
        platforms[schedule.platform].published++;
      } else if (schedule.status === 'failed') {
        platforms[schedule.platform].failed++;
      }
    });

    // Calculate success rates
    Object.keys(platforms).forEach(platform => {
      const stats = platforms[platform];
      const total = stats.published + stats.failed;
      stats.successRate = total > 0 ? (stats.published / total) * 100 : 100;
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSchedules = schedules.filter(s => 
      s.publishedAt && s.publishedAt >= sevenDaysAgo
    );

    const recentActivity: any = {};
    recentSchedules.forEach(schedule => {
      const date = schedule.publishedAt!.toISOString().split('T')[0];
      if (!recentActivity[date]) {
        recentActivity[date] = { published: 0, failed: 0 };
      }

      if (schedule.status === 'published') {
        recentActivity[date].published++;
      } else if (schedule.status === 'failed') {
        recentActivity[date].failed++;
      }
    });

    return {
      scheduled,
      published,
      failed,
      cancelled,
      platforms,
      recentActivity: Object.keys(recentActivity).map(date => ({
        date,
        ...recentActivity[date]
      }))
    };
  }

  /**
   * Start the publishing scheduler
   */
  private startPublishingScheduler(): void {
    // Check for scheduled publishing every minute
    this.publishingTimer = setInterval(async () => {
      await this.processScheduledPublishing();
    }, 60 * 1000); // 60 seconds

    logger.info('⏰ Publishing scheduler started');
  }

  /**
   * Stop the publishing scheduler
   */
  stopPublishingScheduler(): void {
    if (this.publishingTimer) {
      clearInterval(this.publishingTimer);
      this.publishingTimer = null;
      logger.info('⏹️ Publishing scheduler stopped');
    }
  }

  /**
   * Process scheduled publishing items
   */
  private async processScheduledPublishing(): Promise<void> {
    const now = new Date();
    const scheduledItems = Array.from(this.publishingSchedules.values())
      .filter(schedule => 
        schedule.status === 'scheduled' && 
        schedule.scheduledDate <= now
      );

    if (scheduledItems.length === 0) {
      return;
    }

    logger.info(`📝 Processing ${scheduledItems.length} scheduled publishing items`);

    for (const schedule of scheduledItems) {
      try {
        const target = this.publishingTargets.get(schedule.targetId);
        
        if (!target) {
          schedule.status = 'failed';
          schedule.errorMessage = `Publishing target not found: ${schedule.targetId}`;
          continue;
        }

        const result = await this.executePublishing(schedule.contentId, target);
        
        if (result.success) {
          schedule.status = 'published';
          schedule.publishedAt = new Date();
          schedule.publishedUrl = result.publishedUrl;
          
          // Update target statistics
          target.publishCount++;
          target.lastUsed = new Date();
          
        } else {
          schedule.retryCount++;
          
          if (schedule.retryCount >= schedule.maxRetries) {
            schedule.status = 'failed';
            schedule.errorMessage = result.errorMessage;
          } else {
            // Schedule retry in 30 minutes
            schedule.scheduledDate = new Date(now.getTime() + 30 * 60 * 1000);
            logger.info(`🔄 Retry scheduled for content: ${schedule.contentId}`, {
              retryCount: schedule.retryCount,
              maxRetries: schedule.maxRetries
            });
          }
        }

      } catch (error) {
        schedule.retryCount++;
        
        if (schedule.retryCount >= schedule.maxRetries) {
          schedule.status = 'failed';
          schedule.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        } else {
          schedule.scheduledDate = new Date(now.getTime() + 30 * 60 * 1000);
        }

        logger.error(`Failed to publish content: ${schedule.contentId}`, error);
      }
    }
  }

  /**
   * Execute publishing to specific platform
   */
  private async executePublishing(contentId: string, target: PublishingTarget): Promise<AutomatedPublishingResult> {
    logger.info(`🚀 Publishing content to ${target.platform}`, {
      contentId,
      targetId: target.id,
      targetName: target.name
    });

    try {
      switch (target.platform) {
        case 'wordpress':
          return await this.publishToWordPress(contentId, target);
        
        case 'facebook':
          return await this.publishToFacebook(contentId, target);
        
        case 'twitter':
          return await this.publishToTwitter(contentId, target);
        
        case 'linkedin':
          return await this.publishToLinkedIn(contentId, target);
        
        default:
          return {
            success: false,
            scheduleId: 'immediate',
            contentId,
            platform: target.platform,
            errorMessage: `Unsupported platform: ${target.platform}`
          };
      }

    } catch (error) {
      logger.error(`Failed to publish to ${target.platform}:`, error);
      
      return {
        success: false,
        scheduleId: 'immediate',
        contentId,
        platform: target.platform,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Publish to WordPress using MultiSite service
   */
  private async publishToWordPress(contentId: string, target: PublishingTarget): Promise<AutomatedPublishingResult> {
    try {
      // In a real implementation, retrieve content from database
      // For now, create mock content
      const multiSiteRequest: MultiSitePublishingRequest = {
        title: `Generated Content ${contentId}`,
        body: `This is automatically generated content with ID: ${contentId}`,
        excerpt: 'Automatically generated content excerpt',
        categories: ['Technology', 'AI Generated'],
        tags: ['automation', 'ai', 'content'],
        status: 'publish',
        targetSiteId: target.credentials.siteId // Use specific site ID
      };

      const result = await this.wordPressMultiSiteService.publishContent(multiSiteRequest);

      if (result.success && result.mainResult) {
        // Update target stats
        target.publishCount++;
        target.lastUsed = new Date();
        
        return {
          success: true,
          scheduleId: 'immediate',
          contentId,
          platform: 'wordpress',
          publishedUrl: result.mainResult.url,
          publishedAt: new Date()
        };
      }

      return {
        success: false,
        scheduleId: 'immediate',
        contentId,
        platform: 'wordpress',
        errorMessage: result.errors.join('; ') || 'Failed to publish to WordPress'
      };

    } catch (error) {
      logger.error(`Failed to publish to WordPress via MultiSite service:`, error);
      
      return {
        success: false,
        scheduleId: 'immediate',
        contentId,
        platform: 'wordpress',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Publish to Facebook (placeholder)
   */
  private async publishToFacebook(contentId: string, target: PublishingTarget): Promise<AutomatedPublishingResult> {
    // Placeholder for Facebook publishing
    logger.info(`📘 Publishing to Facebook: ${contentId}`);
    
    // Simulate publishing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      scheduleId: 'immediate',
      contentId,
      platform: 'facebook',
      publishedUrl: `https://facebook.com/posts/${contentId}`,
      publishedAt: new Date()
    };
  }

  /**
   * Publish to Twitter (placeholder)
   */
  private async publishToTwitter(contentId: string, target: PublishingTarget): Promise<AutomatedPublishingResult> {
    // Placeholder for Twitter publishing
    logger.info(`🐦 Publishing to Twitter: ${contentId}`);
    
    // Simulate publishing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      scheduleId: 'immediate',
      contentId,
      platform: 'twitter',
      publishedUrl: `https://twitter.com/posts/${contentId}`,
      publishedAt: new Date()
    };
  }

  /**
   * Publish to LinkedIn (placeholder)
   */
  private async publishToLinkedIn(contentId: string, target: PublishingTarget): Promise<AutomatedPublishingResult> {
    // Placeholder for LinkedIn publishing
    logger.info(`💼 Publishing to LinkedIn: ${contentId}`);
    
    // Simulate publishing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      scheduleId: 'immediate',
      contentId,
      platform: 'linkedin',
      publishedUrl: `https://linkedin.com/posts/${contentId}`,
      publishedAt: new Date()
    };
  }

  /**
   * Initialize default publishing targets using MultiSite service
   */
  private initializeDefaultTargets(): void {
    // Initialize WordPress targets from MultiSite service
    const sites = this.wordPressMultiSiteService.getSites();
    
    for (const site of sites) {
      if (site.isActive) {
        const wordPressTarget: PublishingTarget = {
          id: `wordpress-${site.id}`,
          platform: 'wordpress',
          name: site.name,
          credentials: {
            baseUrl: site.url,
            username: site.username,
            password: site.password,
            siteId: site.id
          },
          isActive: true,
          publishCount: 0,
          successRate: 100
        };

        this.publishingTargets.set(`wordpress-${site.id}`, wordPressTarget);
      }
    }

    logger.info(`✅ Initialized ${sites.length} WordPress targets từ MultiSite service`, {
      targets: sites.map(s => s.name)
    });
  }

  /**
   * Get publishing targets
   */
  getPublishingTargets(): PublishingTarget[] {
    return Array.from(this.publishingTargets.values());
  }

  /**
   * Smart publish content using AI-powered routing
   */
  async smartPublishContent(content: {
    title: string;
    body: string;
    excerpt?: string;
    categories?: string[];
    tags?: string[];
    contentType?: 'wedding' | 'pre-wedding' | 'yearbook-school' | 'yearbook-concept' | 'corporate' | 'general';
  }): Promise<AutomatedPublishingResult> {
    try {
      const multiSiteRequest: MultiSitePublishingRequest = {
        title: content.title,
        body: content.body,
        excerpt: content.excerpt,
        categories: content.categories || [],
        tags: content.tags || [],
        status: 'publish',
        contentType: content.contentType
      };

      const result = await this.wordPressMultiSiteService.publishContent(multiSiteRequest);

      if (result.success && result.mainResult) {
        // Update target stats
        const targetId = `wordpress-${result.mainResult.siteId}`;
        const target = this.publishingTargets.get(targetId);
        if (target) {
          target.publishCount++;
          target.lastUsed = new Date();
        }

        logger.info(`✅ Smart published to ${result.mainResult.siteName}`, {
          contentId: result.mainResult.postId,
          url: result.mainResult.url
        });

        return {
          success: true,
          scheduleId: 'smart-immediate',
          contentId: result.mainResult.postId.toString(),
          platform: 'wordpress',
          publishedUrl: result.mainResult.url,
          publishedAt: new Date()
        };
      }

      return {
        success: false,
        scheduleId: 'smart-immediate',
        contentId: 'unknown',
        platform: 'wordpress',
        errorMessage: result.errors.join('; ') || 'Smart publishing failed'
      };

    } catch (error) {
      logger.error('Failed to smart publish content:', error);
      
      return {
        success: false,
        scheduleId: 'smart-immediate',
        contentId: 'unknown',
        platform: 'wordpress',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cross-post content to multiple WordPress sites
   */
  async crossPostContent(
    content: {
      title: string;
      body: string;
      excerpt?: string;
      categories?: string[];
      tags?: string[];
    },
    targetSiteIds: string[]
  ): Promise<{
    success: boolean;
    results: AutomatedPublishingResult[];
    successCount: number;
    failureCount: number;
  }> {
    try {
      const multiSiteRequest: MultiSitePublishingRequest = {
        title: content.title,
        body: content.body,
        excerpt: content.excerpt,
        categories: content.categories || [],
        tags: content.tags || [],
        status: 'publish'
      };

      const result = await this.wordPressMultiSiteService.publishToMultipleSites(
        multiSiteRequest,
        targetSiteIds
      );

      const publishingResults: AutomatedPublishingResult[] = result.results.map(r => ({
        success: r.success,
        scheduleId: 'cross-post-immediate',
        contentId: r.postId?.toString() || 'unknown',
        platform: 'wordpress',
        publishedUrl: r.url,
        publishedAt: r.success ? new Date() : undefined,
        errorMessage: r.error
      }));

      // Update target stats
      for (const r of result.results) {
        if (r.success) {
          const targetId = `wordpress-${r.siteId}`;
          const target = this.publishingTargets.get(targetId);
          if (target) {
            target.publishCount++;
            target.lastUsed = new Date();
          }
        }
      }

      logger.info(`📰 Cross-posted to ${result.totalPublished}/${targetSiteIds.length} sites`);

      return {
        success: result.success,
        results: publishingResults,
        successCount: result.totalPublished,
        failureCount: targetSiteIds.length - result.totalPublished
      };

    } catch (error) {
      logger.error('Failed to cross-post content:', error);
      
      return {
        success: false,
        results: [],
        successCount: 0,
        failureCount: targetSiteIds.length
      };
    }
  }

  /**
   * Test all WordPress site connections
   */
  async testWordPressSiteConnections(): Promise<{
    [siteId: string]: {
      success: boolean;
      siteName: string;
      url: string;
      error?: string;
      responseTime?: number;
    };
  }> {
    return await this.wordPressMultiSiteService.testAllConnections();
  }

  /**
   * Get WordPress site configuration and stats
   */
  getWordPressSiteStats(): {
    totalSites: number;
    activeSites: number;
    routingRules: number;
    siteStats: Array<{
      siteId: string;
      siteName: string;
      isActive: boolean;
      categories: number;
      keywords: number;
      priority: number;
    }>;
  } {
    return this.wordPressMultiSiteService.getPublishingStats();
  }

  /**
   * Get available WordPress sites
   */
  getWordPressSites(): Array<{
    id: string;
    name: string;
    url: string;
    isActive: boolean;
    categories: string[];
    keywords: string[];
  }> {
    return this.wordPressMultiSiteService.getSites().map(site => ({
      id: site.id,
      name: site.name,
      url: site.url,
      isActive: site.isActive,
      categories: site.categories,
      keywords: site.keywords
    }));
  }

  /**
   * Update WordPress site configuration
   */
  async updateWordPressSite(siteId: string, updates: {
    isActive?: boolean;
    categories?: string[];
    keywords?: string[];
    priority?: number;
  }): Promise<boolean> {
    const success = this.wordPressMultiSiteService.updateSiteConfig(siteId, updates);
    
    if (success) {
      // Reinitialize targets to reflect changes
      this.publishingTargets.clear();
      this.initializeDefaultTargets();
    }
    
    return success;
  }

  /**
   * Shutdown the service
   */
  private calculateWordCount(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.calculateWordCount(text);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  shutdown(): void {
    this.stopPublishingScheduler();
    logger.info('⏹️ AutomatedPublishingService shutdown complete');
  }
} 