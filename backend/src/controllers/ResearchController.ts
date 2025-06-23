import { Request, Response } from 'express';
import { WebScrapingService } from '../services/WebScrapingService';
import SEOResearchService from '../services/SEOResearchService';
import { DatabaseService } from '../services/DatabaseService';
import { AuthenticatedRequest } from '../types';

// Import job types from services
type ScrapingJob = Awaited<ReturnType<WebScrapingService['getScrapingJobStatus']>>;
type ResearchJob = Awaited<ReturnType<SEOResearchService['getResearchJobStatus']>>;
type AnyJob = ScrapingJob | ResearchJob;

export class ResearchController {
  private webScrapingService: WebScrapingService;
  private seoResearchService: SEOResearchService;
  private databaseService: DatabaseService;

  constructor() {
    this.webScrapingService = new WebScrapingService();
    this.seoResearchService = new SEOResearchService();
    this.databaseService = new DatabaseService();
  }

  /**
   * POST /api/v1/research/urls
   * Submit URLs for content research and crawling
   */
  async submitUrls(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      console.log('submitUrls called with body:', JSON.stringify(req.body, null, 2));
      const { urls, projectId, settings } = req.body;
      const userId = req.user?.id;

      // Validation
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'URLs array is required and cannot be empty',
          },
        });
        return;
      }

      if (urls.length > 20) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Maximum 20 URLs allowed per request',
          },
        });
        return;
      }

      // Validate URLs
      const invalidUrls = urls.filter((url: string) => {
        try {
          new URL(url);
          return false;
        } catch {
          return true;
        }
      });

      if (invalidUrls.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid URLs detected',
            details: { invalidUrls },
          },
        });
        return;
      }

      // Start URL research job
      const jobId = `research_url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create research job
      const researchJob = {
        jobId,
        type: 'urls' as const,
        status: 'pending' as const,
        urls,
        projectId: projectId || 'default-project',
        userId: userId || 'default-user',
        settings: {
          extractMetadata: true,
          includeImages: false,
          qualityThreshold: 0.7,
          respectRobotsTxt: true,
          userAgent: 'AI Content Agent Bot 1.0',
          timeoutMs: 30000,
          delayMs: 1000,
          ...settings,
        },
        createdAt: new Date().toISOString(),
      };

      // For development, simulate research with mock data
      console.log(`Starting URL research job: ${jobId}`);

      res.status(201).json({
        success: true,
        data: {
          jobId,
          type: 'urls',
          status: 'pending',
          totalUrls: urls.length,
          estimatedTime: '5-10 minutes',
          createdAt: researchJob.createdAt,
        },
        message: 'URL research job created successfully',
      });
    } catch (error) {
      console.error('Error in submitUrls:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create URL research job',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * POST /api/v1/research/keywords
   * Submit keywords for SEO research and URL discovery
   */
  async submitKeywords(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      console.log('submitKeywords called with body:', JSON.stringify(req.body, null, 2));
      const { keywords, projectId, settings } = req.body;
      const userId = req.user?.id;

      // Validation
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Keywords array is required and cannot be empty',
          },
        });
        return;
      }

      if (keywords.length > 10) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Maximum 10 keywords allowed per request',
          },
        });
        return;
      }

      // Start keyword research job
      const jobId = `research_keyword_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create research job
      const researchJob = {
        jobId,
        type: 'keywords' as const,
        status: 'pending' as const,
        keywords,
        projectId: projectId || 'default-project',
        userId: userId || 'default-user',
        settings: {
          searchDepth: 10,
          includeMetrics: true,
          language: 'en',
          region: 'US',
          searchEngines: ['google', 'bing'],
          ...settings,
        },
        createdAt: new Date().toISOString(),
      };

      // For development, simulate research with mock data
      console.log(`Starting keyword research job: ${jobId}`);

      res.status(201).json({
        success: true,
        data: {
          jobId,
          type: 'keywords',
          status: 'pending',
          keywords,
          estimatedUrls: keywords.length * 10,
          estimatedTime: '8-15 minutes',
          createdAt: researchJob.createdAt,
        },
        message: 'Keyword research job created successfully',
      });
    } catch (error) {
      console.error('Error in submitKeywords:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create keyword research job',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * GET /api/v1/research/jobs/:jobId
   * Check research job status
   */
  async getJobStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Job ID is required',
          },
        });
        return;
      }

      console.log(`Getting status for job: ${jobId}`);

      // For development, return mock job status
      const isCompleted = Math.random() > 0.3; // 70% chance of completion for demo
      
      const mockJobStatus = {
        jobId,
        status: isCompleted ? 'completed' : 'in_progress',
        progress: {
          totalItems: 10,
          processedItems: isCompleted ? 10 : Math.floor(Math.random() * 8) + 2,
          successfulItems: isCompleted ? 8 : Math.floor(Math.random() * 6) + 1,
          failedItems: isCompleted ? 2 : Math.floor(Math.random() * 2),
          currentStage: isCompleted ? 'completed' : 'content_analysis',
          percentage: isCompleted ? 100 : Math.floor(Math.random() * 60) + 20,
        },
        ...(isCompleted && {
          results: {
            crawledContent: Array.from({ length: 8 }, (_, i) => ({
              id: `crawled_content_${String(i + 1).padStart(3, '0')}`,
              sourceUrl: `https://example-${i + 1}.com/article`,
              title: `Expert Article ${i + 1}`,
              contentPreview: 'This is a comprehensive article about the topic with detailed insights...',
              qualityScore: Math.floor(Math.random() * 30) + 70,
              wordCount: Math.floor(Math.random() * 1000) + 800,
              metadata: {
                author: `Author ${i + 1}`,
                publishDate: new Date().toISOString(),
                domain: `example-${i + 1}.com`,
                contentType: 'article',
              }
            })),
            summary: {
              totalContentCrawled: 8,
              averageQualityScore: 82.5,
              totalWordCount: 12450,
              topKeywords: ['AI', 'marketing', 'automation', 'content'],
              contentThemes: ['AI Technology', 'Marketing Strategy', 'Digital Transformation'],
            }
          }
        }),
        createdAt: new Date(Date.now() - 600000).toISOString(),
        updatedAt: new Date().toISOString(),
        ...(isCompleted && { completedAt: new Date().toISOString() })
      };

      res.status(200).json({
        success: true,
        data: mockJobStatus,
        message: 'Job status retrieved successfully',
      });
    } catch (error) {
      console.error('Error in getJobStatus:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get job status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * GET /api/v1/research/results/:jobId
   * Get detailed research results
   */
  async getJobResults(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Job ID is required',
          },
        });
        return;
      }

      // Try to get scraping job results first
      let jobData: AnyJob = await this.webScrapingService.getScrapingJobStatus(jobId);
      let jobType = 'urls';

      // If not found, try SEO research job
      if (!jobData) {
        jobData = await this.seoResearchService.getResearchJobStatus(jobId);
        jobType = 'keywords';
      }

      if (!jobData) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Research job not found',
          },
        });
        return;
      }

      if (jobData.status !== 'completed') {
        res.status(400).json({
          success: false,
          error: {
            code: 'JOB_NOT_COMPLETED',
            message: 'Job is not completed yet',
            currentStatus: jobData.status,
          },
        });
        return;
      }

      const formattedResults = this.formatDetailedResults(jobData.results, jobType);

      res.status(200).json({
        success: true,
        data: {
          jobId: jobData.id,
          type: jobType,
          results: formattedResults,
          summary: this.generateResultsSummary(jobData.results, jobType),
          completedAt: jobData.completedAt,
        },
      });
    } catch (error) {
      console.error('Error in getJobResults:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get job results',
        },
      });
    }
  }

  /**
   * DELETE /api/v1/research/jobs/:jobId
   * Cancel a research job
   */
  async cancelJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Job ID is required',
          },
        });
        return;
      }

      // For now, we'll just mark it as cancelled in our records
      // In a full implementation, you'd also cancel the queue job
      
      res.status(200).json({
        success: true,
        data: {
          jobId,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
        },
        message: 'Research job cancelled successfully',
      });
    } catch (error) {
      console.error('Error in cancelJob:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to cancel job',
        },
      });
    }
  }

  private async saveResearchJob(jobData: any): Promise<void> {
    try {
      // This would save to your database
      // Implementation depends on your database schema
      console.log('Saving research job:', jobData.id);
    } catch (error) {
      console.error('Failed to save research job:', error);
    }
  }

  private getCurrentStage(status: string, jobType: string): string {
    switch (status) {
      case 'pending':
        return 'Queued for processing';
      case 'processing':
        return jobType === 'urls' ? 'Crawling content' : 'Researching keywords';
      case 'completed':
        return 'Analysis complete';
      case 'failed':
        return 'Processing failed';
      default:
        return 'Unknown';
    }
  }

  private formatResults(results: any[], jobType: string): any {
    if (jobType === 'urls') {
      return {
        crawledContent: results.slice(0, 5).map(result => ({
          id: result.id,
          sourceUrl: result.sourceUrl,
          title: result.title,
          contentPreview: result.content.substring(0, 200) + '...',
          qualityScore: result.qualityScore,
          wordCount: result.wordCount,
          metadata: {
            author: result.metadata.author,
            publishDate: result.metadata.publishDate,
            domain: result.metadata.domain,
            contentType: result.metadata.contentType,
          },
        })),
      };
    } else {
      return {
        keywordResults: results.slice(0, 3).map(result => ({
          keyword: result.keyword,
          topUrls: result.topUrls.slice(0, 5),
          metrics: result.metrics,
          analysisScore: result.analysisScore,
        })),
      };
    }
  }

  private formatDetailedResults(results: any[], jobType: string): any {
    if (jobType === 'urls') {
      return results.map(result => ({
        id: result.id,
        sourceUrl: result.sourceUrl,
        title: result.title,
        content: result.content,
        metadata: result.metadata,
        qualityScore: result.qualityScore,
        wordCount: result.wordCount,
        scrapedAt: result.scrapedAt,
      }));
    } else {
      return results.map(result => ({
        keyword: result.keyword,
        searchResults: result.searchResults,
        metrics: result.metrics,
        topUrls: result.topUrls,
        analysisScore: result.analysisScore,
      }));
    }
  }

  private generateResultsSummary(results: any[], jobType: string): any {
    if (jobType === 'urls') {
      const totalContent = results.length;
      const avgQualityScore = results.reduce((sum, r) => sum + r.qualityScore, 0) / totalContent;
      const totalWordCount = results.reduce((sum, r) => sum + r.wordCount, 0);
      const topKeywords = this.extractTopKeywords(results);

      return {
        totalContentCrawled: totalContent,
        averageQualityScore: Math.round(avgQualityScore * 10) / 10,
        totalWordCount,
        topKeywords: topKeywords.slice(0, 10),
        contentThemes: this.extractContentThemes(results),
      };
    } else {
      const totalKeywords = results.length;
      const avgSearchVolume = results.reduce((sum, r) => sum + r.metrics.searchVolume, 0) / totalKeywords;
      const totalUrls = results.reduce((sum, r) => sum + r.topUrls.length, 0);

      return {
        totalKeywords,
        averageSearchVolume: Math.round(avgSearchVolume),
        totalUrlsFound: totalUrls,
        highVolumeKeywords: results.filter(r => r.metrics.searchVolume > 5000).length,
        lowCompetitionKeywords: results.filter(r => r.metrics.competition < 0.3).length,
      };
    }
  }

  private extractTopKeywords(results: any[]): string[] {
    const keywordCounts: { [key: string]: number } = {};
    
    results.forEach(result => {
      if (result.metadata.keywords) {
        result.metadata.keywords.forEach((keyword: string) => {
          const cleanKeyword = keyword.toLowerCase().trim();
          keywordCounts[cleanKeyword] = (keywordCounts[cleanKeyword] || 0) + 1;
        });
      }
    });

    return Object.entries(keywordCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([keyword]) => keyword);
  }

  private extractContentThemes(results: any[]): string[] {
    // Simple theme extraction based on common words in titles
    const titleWords: { [key: string]: number } = {};
    
    results.forEach(result => {
      const words = result.title.toLowerCase()
        .split(/\s+/)
        .filter((word: string) => word.length > 3)
        .filter((word: string) => !['the', 'and', 'for', 'with', 'your', 'how', 'what', 'why'].includes(word));
      
      words.forEach((word: string) => {
        titleWords[word] = (titleWords[word] || 0) + 1;
      });
    });

    return Object.entries(titleWords)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  }

  async cleanup(): Promise<void> {
    await this.webScrapingService.cleanup();
    await this.seoResearchService.cleanup();
  }

  async findSEOUrls(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      console.log('findSEOUrls called with body:', JSON.stringify(req.body, null, 2));
      const { keyword, limit = 10, includePreview = false } = req.body;
      const userId = req.user?.id;

      // Validation
      if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Keyword is required and must be a non-empty string',
          },
        });
        return;
      }

      console.log(`Finding top SEO URLs for keyword: "${keyword}"`);

      // For development, return mock SEO URLs
      const mockSEOResults = Array.from({ length: Math.min(limit, 10) }, (_, i) => {
        const domains = [
          'hubspot.com',
          'moz.com',
          'semrush.com',
          'ahrefs.com',
          'searchengineland.com',
          'contentmarketinginstitute.com',
          'neilpatel.com',
          'backlinko.com',
          'searchenginejournal.com',
          'marketingland.com'
        ];
        
        const domain = domains[i] || `example-${i + 1}.com`;
        const urlSlug = keyword.toLowerCase().replace(/\s+/g, '-');
        
        return {
          url: `https://${domain}/${urlSlug}-guide`,
          title: `${keyword} - The Complete Guide ${new Date().getFullYear()}`,
          description: `Comprehensive guide to ${keyword} with expert insights, best practices, and practical tips. Learn everything you need to know about ${keyword} in this detailed resource.`,
          domain,
          seoScore: Math.floor(Math.random() * 20) + 80, // 80-100
          isSelected: false,
          ...(includePreview && {
            preview: {
              content: `This comprehensive article about ${keyword} covers all the essential aspects that professionals need to know. The content includes detailed explanations, practical examples, and expert insights from industry leaders. Whether you're a beginner or an experienced professional, this guide provides valuable information about ${keyword} and its applications in today's market.`,
              wordCount: Math.floor(Math.random() * 1000) + 1500,
              readTime: Math.floor(Math.random() * 5) + 5,
            }
          })
        };
      });

      res.status(200).json({
        success: true,
        data: {
          keyword,
          results: mockSEOResults,
          searchDate: new Date().toISOString(),
          totalFound: mockSEOResults.length,
        },
        message: `Found ${mockSEOResults.length} top SEO URLs for keyword "${keyword}"`,
      });
    } catch (error) {
      console.error('Error in findSEOUrls:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to find SEO URLs',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async getUrlPreview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      console.log('getUrlPreview called with body:', JSON.stringify(req.body, null, 2));
      const { url } = req.body;
      const userId = req.user?.id;

      // Validation
      if (!url || typeof url !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'URL is required and must be a valid string',
          },
        });
        return;
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid URL format',
          },
        });
        return;
      }

      console.log(`Getting content preview for URL: ${url}`);

      // For development, return mock preview data
      const domain = new URL(url).hostname;
      const mockPreview = {
        url,
        title: `Expert Article from ${domain}`,
        content: `This is a comprehensive article from ${domain} that provides detailed insights and practical guidance. The content covers various aspects of the topic with real-world examples, expert opinions, and actionable strategies. The article is well-structured with clear headings, subheadings, and bullet points that make it easy to follow and understand. It includes case studies, statistics, and references to support the main points discussed throughout the content.`,
        metadata: {
          wordCount: Math.floor(Math.random() * 1500) + 1000,
          readTime: Math.floor(Math.random() * 8) + 3,
          publishDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          author: `Expert Author from ${domain}`,
          domain,
          contentType: 'article',
          language: 'en',
        },
        preview: {
          extracted: true,
          quality: Math.floor(Math.random() * 20) + 80,
          timestamp: new Date().toISOString(),
        }
      };

      res.status(200).json({
        success: true,
        data: mockPreview,
        message: 'Content preview extracted successfully',
      });
    } catch (error) {
      console.error('Error in getUrlPreview:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to extract content preview',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

export default ResearchController; 