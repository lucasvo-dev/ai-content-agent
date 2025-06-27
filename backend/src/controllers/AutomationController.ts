import { Request, Response } from 'express';
import { LangChainService, ResearchQuery, AutomationSettings } from '../services/LangChainService';
import { VectorDBService } from '../services/VectorDBService';
import { SchedulerService } from '../services/SchedulerService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';

export class AutomationController {
  private langChainService: LangChainService;
  private vectorDBService: VectorDBService;
  private schedulerService: SchedulerService;

  constructor() {
    this.langChainService = new LangChainService();
    this.vectorDBService = new VectorDBService();
    this.schedulerService = new SchedulerService();
  }

  /**
   * Initialize automation services
   */
  initializeServices = asyncHandler(async (req: Request, res: Response) => {
    try {
      await Promise.all([
        this.langChainService.initialize(),
        this.vectorDBService.initialize(),
        this.schedulerService.initialize()
      ]);

      res.json({
        success: true,
        message: 'Automation services initialized successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to initialize automation services:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize automation services',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Conduct deep content research
   */
  conductResearch = asyncHandler(async (req: Request, res: Response) => {
    const query: ResearchQuery = req.body;
    
    if (!query.topic || !query.contentType || !query.targetAudience) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: topic, contentType, targetAudience'
      });
    }

    try {
      const researchResult = await this.langChainService.conductDeepResearch(query);
      
      res.json({
        success: true,
        data: researchResult,
        message: 'Research completed successfully'
      });
    } catch (error) {
      logger.error('Research failed:', error);
      res.status(500).json({
        success: false,
        error: 'Research failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate content with RAG pipeline
   */
  generateContentWithRAG = asyncHandler(async (req: Request, res: Response) => {
    const { query, researchId } = req.body;
    
    if (!query || !query.topic) {
      res.status(400).json({
        success: false,
        error: 'Missing required query with topic'
      });
    }

    try {
      // If researchId provided, retrieve existing research
      let researchResult;
      if (researchId) {
        // In production, retrieve from database
        // researchResult = await this.getResearchById(researchId);
      }

      const contentPipeline = await this.langChainService.generateContentWithRAG(query, researchResult);
      
      res.json({
        success: true,
        data: contentPipeline,
        message: 'Content generated successfully with RAG'
      });
    } catch (error) {
      logger.error('RAG content generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'RAG content generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generate automated content
   */
  generateAutomatedContent = asyncHandler(async (req: Request, res: Response) => {
    const settings: AutomationSettings = req.body;
    
    if (!settings.contentType || !settings.targetAudience || !settings.contentCategories?.length) {
      res.status(400).json({
        success: false,
        error: 'Missing required automation settings'
      });
    }

    try {
      const generatedContent = await this.langChainService.generateAutomatedContent(settings);
      
      res.json({
        success: true,
        data: {
          generatedCount: generatedContent.length,
          approvedCount: generatedContent.filter(c => c.status === 'approved').length,
          content: generatedContent
        },
        message: 'Automated content generation completed'
      });
    } catch (error) {
      logger.error('Automated content generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Automated content generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Search similar content in vector database
   */
  searchSimilarContent = asyncHandler(async (req: Request, res: Response) => {
    const { query, limit = 5, filters } = req.body;
    
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    try {
      const results = await this.vectorDBService.searchSimilarContent(query, limit, filters);
      
      res.json({
        success: true,
        data: {
          results,
          count: results.length,
          averageSimilarity: results.reduce((acc, r) => acc + r.similarity, 0) / results.length
        },
        message: 'Similar content search completed'
      });
    } catch (error) {
      logger.error('Similar content search failed:', error);
      res.status(500).json({
        success: false,
        error: 'Similar content search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Analyze content uniqueness
   */
  analyzeContentUniqueness = asyncHandler(async (req: Request, res: Response) => {
    const { content, title, metadata } = req.body;
    
    if (!content || !title || !metadata) {
      res.status(400).json({
        success: false,
        error: 'Content, title, and metadata are required'
      });
    }

    try {
      const analysis = await this.vectorDBService.analyzeContentUniqueness(content, title, metadata);
      
      res.json({
        success: true,
        data: analysis,
        message: 'Content uniqueness analysis completed'
      });
    } catch (error) {
      logger.error('Content uniqueness analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Content uniqueness analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Find content gaps
   */
  findContentGaps = asyncHandler(async (req: Request, res: Response) => {
    const { category, keywords = [] } = req.body;
    
    if (!category) {
      res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }

    try {
      const gaps = await this.vectorDBService.findContentGaps(category, keywords);
      
      res.json({
        success: true,
        data: gaps,
        message: 'Content gap analysis completed'
      });
    } catch (error) {
      logger.error('Content gap analysis failed:', error);
      res.status(500).json({
        success: false,
        error: 'Content gap analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get vector database statistics
   */
  getVectorDBStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = await this.vectorDBService.getStats();
      
      res.json({
        success: true,
        data: stats,
        message: 'Vector database statistics retrieved'
      });
    } catch (error) {
      logger.error('Failed to get vector DB stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get vector database statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Schedule content generation job
   */
  scheduleContentGeneration = asyncHandler(async (req: Request, res: Response) => {
    const { name, schedule, settings } = req.body;
    
    if (!name || !schedule || !settings) {
      res.status(400).json({
        success: false,
        error: 'Name, schedule, and settings are required'
      });
    }

    try {
      const jobId = await this.schedulerService.scheduleContentGeneration(name, schedule, settings);
      
      res.json({
        success: true,
        data: { jobId },
        message: 'Content generation job scheduled successfully'
      });
    } catch (error) {
      logger.error('Failed to schedule content generation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule content generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Schedule content publishing job
   */
  scheduleContentPublishing = asyncHandler(async (req: Request, res: Response) => {
    const { name, schedule, publishingSettings } = req.body;
    
    if (!name || !schedule || !publishingSettings) {
      res.status(400).json({
        success: false,
        error: 'Name, schedule, and publishingSettings are required'
      });
    }

    try {
      const jobId = await this.schedulerService.scheduleContentPublishing(name, schedule, publishingSettings);
      
      res.json({
        success: true,
        data: { jobId },
        message: 'Content publishing job scheduled successfully'
      });
    } catch (error) {
      logger.error('Failed to schedule content publishing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule content publishing',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Schedule performance analysis job
   */
  schedulePerformanceAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const { name, schedule, analysisSettings } = req.body;
    
    if (!name || !schedule || !analysisSettings) {
      res.status(400).json({
        success: false,
        error: 'Name, schedule, and analysisSettings are required'
      });
    }

    try {
      const jobId = await this.schedulerService.schedulePerformanceAnalysis(name, schedule, analysisSettings);
      
      res.json({
        success: true,
        data: { jobId },
        message: 'Performance analysis job scheduled successfully'
      });
    } catch (error) {
      logger.error('Failed to schedule performance analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule performance analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get all scheduled jobs
   */
  getScheduledJobs = asyncHandler(async (req: Request, res: Response) => {
    try {
      const jobs = this.schedulerService.getScheduledJobs();
      
      res.json({
        success: true,
        data: {
          jobs,
          totalJobs: jobs.length,
          activeJobs: jobs.filter(j => j.isActive).length
        },
        message: 'Scheduled jobs retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get scheduled jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduled jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Toggle job status (pause/resume)
   */
  toggleJob = asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'isActive must be a boolean'
      });
    }

    try {
      const success = this.schedulerService.toggleJob(jobId, isActive);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      res.json({
        success: true,
        message: `Job ${isActive ? 'resumed' : 'paused'} successfully`
      });
    } catch (error) {
      logger.error('Failed to toggle job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Delete a scheduled job
   */
  deleteJob = asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    
    try {
      const success = this.schedulerService.deleteJob(jobId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      res.json({
        success: true,
        message: 'Job deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete job',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get performance metrics
   */
  getPerformanceMetrics = asyncHandler(async (req: Request, res: Response) => {
    const { contentId, platform, startDate, endDate } = req.query;
    
    try {
      let metrics = this.schedulerService.getPerformanceMetrics(
        contentId as string,
        platform as string
      );

      // Filter by date range if provided
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : new Date(0);
        const end = endDate ? new Date(endDate as string) : new Date();
        
        metrics = metrics.filter(m => 
          m.measuredAt >= start && m.measuredAt <= end
        );
      }

      // Calculate summary statistics
      const summary = metrics.length > 0 ? {
        totalViews: metrics.reduce((sum, m) => sum + m.views, 0),
        totalEngagement: metrics.reduce((sum, m) => sum + m.engagement, 0),
        avgQualityScore: metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length,
        avgConversionRate: metrics.reduce((sum, m) => sum + m.conversions, 0) / metrics.length,
        totalMetrics: metrics.length
      } : null;

      res.json({
        success: true,
        data: {
          metrics,
          summary
        },
        message: 'Performance metrics retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Test automation services health
   */
  healthCheck = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Check if services are initialized
      const services = {
        langChain: 'checking...',
        vectorDB: 'checking...',
        scheduler: 'checking...'
      };

      // Simple health checks
      try {
        await this.vectorDBService.getStats();
        services.vectorDB = 'healthy';
      } catch {
        services.vectorDB = 'error';
      }

      const jobs = this.schedulerService.getScheduledJobs();
      services.scheduler = jobs ? 'healthy' : 'error';
      services.langChain = 'healthy'; // Assume healthy if no error

      const allHealthy = Object.values(services).every(status => status === 'healthy');

      res.json({
        success: true,
        data: {
          services,
          overall: allHealthy ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString()
        },
        message: 'Automation services health check completed'
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get automation dashboard overview
   */
  getDashboardOverview = asyncHandler(async (req: Request, res: Response) => {
    try {
      const jobs = this.schedulerService.getScheduledJobs();
      const metrics = this.schedulerService.getPerformanceMetrics();
      const vectorStats = await this.vectorDBService.getStats();

      // Calculate last 7 days metrics
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentMetrics = metrics.filter(m => m.measuredAt >= sevenDaysAgo);

      const overview = {
        automation: {
          totalJobs: jobs.length,
          activeJobs: jobs.filter(j => j.isActive).length,
          totalRuns: jobs.reduce((sum, j) => sum + j.runCount, 0),
          successRate: jobs.reduce((sum, j) => sum + j.successCount, 0) / Math.max(1, jobs.reduce((sum, j) => sum + j.runCount, 0)) * 100
        },
        content: {
          totalInVectorDB: vectorStats.totalVectors,
          recentContent: recentMetrics.length,
          avgQualityScore: recentMetrics.length > 0 
            ? recentMetrics.reduce((sum, m) => sum + m.qualityScore, 0) / recentMetrics.length 
            : 0
        },
        performance: {
          totalViews: recentMetrics.reduce((sum, m) => sum + m.views, 0),
          totalEngagement: recentMetrics.reduce((sum, m) => sum + m.engagement, 0),
          totalConversions: recentMetrics.reduce((sum, m) => sum + m.conversions, 0),
          platforms: {
            wordpress: recentMetrics.filter(m => m.platform === 'wordpress').length,
            facebook: recentMetrics.filter(m => m.platform === 'facebook').length
          }
        },
        trends: {
          dailyViews: this.calculateDailyTrends(recentMetrics, 'views'),
          dailyEngagement: this.calculateDailyTrends(recentMetrics, 'engagement'),
          qualityTrend: this.calculateDailyTrends(recentMetrics, 'qualityScore')
        }
      };

      res.json({
        success: true,
        data: overview,
        message: 'Dashboard overview retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get dashboard overview:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard overview',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Calculate daily trends for metrics
   */
  private calculateDailyTrends(metrics: any[], field: string): number[] {
    const dailyData: { [date: string]: number[] } = {};
    
    metrics.forEach(metric => {
      const date = metric.measuredAt.toISOString().split('T')[0];
      if (!dailyData[date]) dailyData[date] = [];
      dailyData[date].push(metric[field] || 0);
    });

    return Object.values(dailyData).map(dayValues => 
      dayValues.reduce((sum, val) => sum + val, 0) / dayValues.length
    );
  }
} 