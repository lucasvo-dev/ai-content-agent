import { Request, Response } from 'express';
import { WordPressMultiSiteService, MultiSitePublishingRequest } from '../services/WordPressMultiSiteService';
import { AutomatedPublishingService } from '../services/AutomatedPublishingService';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

export class WordPressMultiSiteController {
  private multiSiteService: WordPressMultiSiteService;
  private publishingService?: AutomatedPublishingService;

  constructor() {
    this.multiSiteService = new WordPressMultiSiteService();
    // Temporarily skip AutomatedPublishingService to avoid startup issues
    // this.publishingService = new AutomatedPublishingService();
  }

  /**
   * Get all WordPress sites configuration
   */
  getSites = asyncHandler(async (req: Request, res: Response) => {
    const sites = this.multiSiteService.getSites();
    
    res.json({
      success: true,
      data: {
        sites: sites.map(site => ({
          id: site.id,
          name: site.name,
          url: site.url,
          isActive: site.isActive,
          categories: site.categories,
          keywords: site.keywords,
          priority: site.priority
        })),
        totalSites: sites.length,
        activeSites: sites.filter(s => s.isActive).length
      }
    });
  });

  /**
   * Get specific site configuration
   */
  getSite = asyncHandler(async (req: Request, res: Response) => {
    const { siteId } = req.params;
    const site = this.multiSiteService.getSite(siteId);
    
    if (!site) {
      res.status(404).json({
        success: false,
        error: `Site not found: ${siteId}`
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: site.id,
        name: site.name,
        url: site.url,
        isActive: site.isActive,
        categories: site.categories,
        keywords: site.keywords,
        priority: site.priority
      }
    });
  });

  /**
   * Test connections to all WordPress sites
   */
  testConnections = asyncHandler(async (req: Request, res: Response) => {
    logger.info('🔍 Testing WordPress multi-site connections');
    
    const results = await this.multiSiteService.testAllConnections();
    
    const summary = {
      totalSites: Object.keys(results).length,
      successfulConnections: Object.values(results).filter(r => r.success).length,
      failedConnections: Object.values(results).filter(r => !r.success).length,
      averageResponseTime: Object.values(results)
        .filter(r => r.responseTime)
        .reduce((sum, r) => sum + (r.responseTime || 0), 0) / 
        Object.values(results).filter(r => r.responseTime).length || 0
    };
    
    res.json({
      success: true,
      data: {
        results,
        summary
      }
    });
  });

  /**
   * Smart publish content with AI routing
   */
  smartPublish = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { title, content, excerpt, categories, tags, contentType, targetSiteId } = req.body;
    
    if (!title || !content) {
      res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
      return;
    }

    const publishingRequest: MultiSitePublishingRequest = {
      title,
      body: content,
      excerpt,
      categories: categories || [],
      tags: tags || [],
      status: 'publish',
      contentType,
      targetSiteId
    };

    logger.info(`📝 Smart publishing: ${title}`);
    
    const result = await this.multiSiteService.publishContent(publishingRequest);

    if (!result.success || result.totalPublished === 0) {
      const errorMessage = result.errors.join(', ') || 'Failed to publish to any site.';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: errorMessage
      });
    }
    
    // Return a simplified, successful response for the frontend
    res.json({
      success: true,
      message: `Successfully published to ${result.totalPublished} site(s).`,
      data: {
        url: result.mainResult?.url, // The URL of the published post
        siteName: result.mainResult?.siteName,
        postId: result.mainResult?.postId
      }
    });
  });

  /**
   * Cross-post content to multiple sites
   */
  crossPost = asyncHandler(async (req: Request, res: Response) => {
    const { title, body, excerpt, categories, tags, targetSiteIds } = req.body;
    
    if (!title || !body) {
      res.status(400).json({
        success: false,
        error: 'Title and body are required'
      });
    }

    if (!targetSiteIds || !Array.isArray(targetSiteIds) || targetSiteIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'targetSiteIds array is required and must not be empty'
      });
    }

    const publishingRequest: MultiSitePublishingRequest = {
      title,
      body,
      excerpt,
      categories: categories || [],
      tags: tags || [],
      status: 'publish'
    };

    logger.info(`📰 Cross-posting to ${targetSiteIds.length} sites: ${title}`);
    
    const result = await this.multiSiteService.publishToMultipleSites(
      publishingRequest,
      targetSiteIds
    );
    
    res.json({
      success: result.success,
      data: {
        mainResult: result.mainResult,
        allResults: result.results,
        totalPublished: result.totalPublished,
        successRate: (result.totalPublished / targetSiteIds.length) * 100,
        errors: result.errors
      }
    });
  });

  /**
   * Preview smart routing decision without publishing
   */
  previewRouting = asyncHandler(async (req: Request, res: Response) => {
    const { title, body, excerpt, categories, tags, contentType } = req.body;
    
    if (!title || !body) {
      res.status(400).json({
        success: false,
        error: 'Title and body are required for routing preview'
      });
    }

    const publishingRequest: MultiSitePublishingRequest = {
      title,
      body,
      excerpt,
      categories: categories || [],
      tags: tags || [],
      status: 'draft', // Don't actually publish
      contentType
    };

    const targetSiteId = this.multiSiteService.determineTargetSite(publishingRequest);
    const targetSite = this.multiSiteService.getSite(targetSiteId);
    
    if (!targetSite) {
      res.status(500).json({
        success: false,
        error: 'Failed to determine target site'
      });
    }

    // Analyze content for routing insights
    const contentText = `${title} ${body} ${excerpt || ''}`.toLowerCase();
    const analysis = {
      targetSite: {
        id: targetSite.id,
        name: targetSite.name,
        url: targetSite.url,
        priority: targetSite.priority
      },
      contentAnalysis: {
        wordCount: body.split(' ').length,
        categoryMatches: targetSite.categories.filter(cat => 
          categories?.some(c => c.toLowerCase().includes(cat.toLowerCase())) ||
          contentText.includes(cat.toLowerCase())
        ),
        keywordMatches: targetSite.keywords.filter(keyword => 
          contentText.includes(keyword.toLowerCase())
        )
      },
      confidence: this.calculateRoutingConfidence(contentText, targetSite, categories, tags)
    };
    
    res.json({
      success: true,
      data: analysis
    });
  });

  /**
   * Get publishing statistics across all sites
   */
  getPublishingStats = asyncHandler(async (req: Request, res: Response) => {
    const multiSiteStats = this.multiSiteService.getPublishingStats();
    const publishingStats = this.publishingService?.getWordPressSiteStats();
    
    res.json({
      success: true,
      data: {
        multiSite: multiSiteStats,
        publishing: publishingStats || null,
        combined: {
          totalSites: multiSiteStats.totalSites,
          activeSites: multiSiteStats.activeSites,
          routingRules: multiSiteStats.routingRules,
          sites: multiSiteStats.siteStats
        }
      }
    });
  });

  /**
   * Update site configuration
   */
  updateSiteConfig = asyncHandler(async (req: Request, res: Response) => {
    const { siteId } = req.params;
    const updates = req.body;
    
    // Validate allowed updates
    const allowedUpdates = ['isActive', 'categories', 'keywords', 'priority'];
    const validUpdates: any = {};
    
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        validUpdates[key] = updates[key];
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid updates provided. Allowed fields: ' + allowedUpdates.join(', ')
      });
    }

    const success = this.multiSiteService.updateSiteConfig(siteId, validUpdates);
    
    if (!success) {
      res.status(404).json({
        success: false,
        error: `Site not found: ${siteId}`
      });
    }

    // Get updated site info
    const updatedSite = this.multiSiteService.getSite(siteId);
    
    res.json({
      success: true,
      data: {
        siteId,
        updatedFields: Object.keys(validUpdates),
        site: updatedSite ? {
          id: updatedSite.id,
          name: updatedSite.name,
          url: updatedSite.url,
          isActive: updatedSite.isActive,
          categories: updatedSite.categories,
          keywords: updatedSite.keywords,
          priority: updatedSite.priority
        } : null
      }
    });
  });

  /**
   * Get content routing rules
   */
  getRoutingRules = asyncHandler(async (req: Request, res: Response) => {
    // Access private routing rules through a public method
    const stats = this.multiSiteService.getPublishingStats();
    
    res.json({
      success: true,
      data: {
        totalRules: stats.routingRules,
        sites: stats.siteStats.map(site => ({
          siteId: site.siteId,
          siteName: site.siteName,
          isActive: site.isActive,
          priority: site.priority,
          categoriesCount: site.categories,
          keywordsCount: site.keywords
        })),
        routingStrategy: 'AI-powered content analysis with keyword and category matching'
      }
    });
  });

  /**
   * Bulk operations endpoint
   */
  bulkOperations = asyncHandler(async (req: Request, res: Response) => {
    const { operation, data } = req.body;
    
    switch (operation) {
      case 'test-all-connections':
        const connectionResults = await this.multiSiteService.testAllConnections();
        res.json({
          success: true,
          operation: 'test-all-connections',
          data: connectionResults
        });
        
      case 'bulk-publish':
        const { contents, targetSiteIds } = data;
        if (!contents || !Array.isArray(contents)) {
          res.status(400).json({
            success: false,
            error: 'Contents array is required for bulk publish'
          });
        }
        
        const bulkResults = [];
        for (const content of contents) {
          try {
            let result;
            if (targetSiteIds && targetSiteIds.length > 1) {
              result = await this.multiSiteService.publishToMultipleSites(content, targetSiteIds);
            } else {
              result = await this.multiSiteService.publishContent(content);
            }
            bulkResults.push({ content: content.title, result });
          } catch (error) {
            bulkResults.push({ 
              content: content.title, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        }
        
        res.json({
          success: true,
          operation: 'bulk-publish',
          data: {
            totalContents: contents.length,
            results: bulkResults,
            successCount: bulkResults.filter(r => r.result?.success).length
          }
        });
        
      default:
        res.status(400).json({
          success: false,
          error: `Unknown bulk operation: ${operation}`
        });
    }
  });

  /**
   * Health check endpoint
   */
  healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const sites = this.multiSiteService.getSites();
    const activeSites = sites.filter(s => s.isActive);
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        multiSiteService: 'operational',
        sites: {
          total: sites.length,
          active: activeSites.length,
          inactive: sites.length - activeSites.length
        },
        version: '1.0.0',
        features: [
          'Smart content routing',
          'Multi-site publishing',
          'Cross-posting',
          'Connection testing',
          'AI-powered categorization'
        ]
      }
    });
  });

  /**
   * Calculate routing confidence based on content analysis
   */
  private calculateRoutingConfidence(
    contentText: string,
    targetSite: any,
    categories?: string[],
    tags?: string[]
  ): 'High' | 'Medium' | 'Low' {
    let score = 0;
    
    // Check keyword matches
    for (const keyword of targetSite.keywords) {
      if (contentText.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }
    
    // Check category matches
    if (categories) {
      for (const category of categories) {
        if (targetSite.categories.some((cat: string) => 
          cat.toLowerCase().includes(category.toLowerCase())
        )) {
          score += 15;
        }
      }
    }
    
    // Check tag matches
    if (tags) {
      for (const tag of tags) {
        if (targetSite.keywords.some((keyword: string) => 
          keyword.toLowerCase().includes(tag.toLowerCase())
        )) {
          score += 10;
        }
      }
    }
    
    if (score >= 30) return 'High';
    if (score >= 15) return 'Medium';
    return 'Low';
  }
} 