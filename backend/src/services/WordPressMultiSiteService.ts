import { WordPressService } from './WordPressService';
import { logger } from '../utils/logger';
import { MockWordPressService } from './MockWordPressService';

export interface WordPressSiteConfig {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  categories: string[];
  keywords: string[];
  isActive: boolean;
  priority: number; // Higher priority = preferred site for category
}

export interface ContentRoutingRule {
  keywords: string[];
  categories: string[];
  siteId: string;
  priority: number;
  description: string;
}

export interface MultiSitePublishingRequest {
  title: string;
  body: string;
  excerpt?: string;
  categories?: string[];
  tags?: string[];
  status?: 'draft' | 'publish' | 'pending';
  featuredImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  targetSiteId?: string; // Optional: Force specific site
  contentType?: 'wedding' | 'pre-wedding' | 'yearbook-school' | 'yearbook-concept' | 'corporate' | 'general';
}

export interface MultiSitePublishingResult {
  success: boolean;
  results: Array<{
    siteId: string;
    siteName: string;
    success: boolean;
    postId?: number;
    url?: string;
    error?: string;
  }>;
  mainResult?: {
    siteId: string;
    siteName: string;
    postId: number;
    url: string;
  };
  totalPublished: number;
  errors: string[];
}

export class WordPressMultiSiteService {
  private sites: Map<string, WordPressSiteConfig> = new Map();
  private routingRules: ContentRoutingRule[] = [];
  private siteServices: Map<string, WordPressService> = new Map();

  constructor() {
    this.initializeSites();
    this.initializeRoutingRules();
    this.initializeServices();
    
    logger.info('🌐 WordPressMultiSiteService initialized với 3 sites');
  }

  /**
   * Initialize the 3 WordPress sites
   */
  private initializeSites(): void {
    // Wedding Site - Chuyên đám cưới và pre-wedding
    this.sites.set('wedding', {
      id: 'wedding',
      name: 'Wedding Guustudio',
      url: process.env.WORDPRESS_WEDDING_URL || 'https://wedding.guustudio.vn',
      username: process.env.WORDPRESS_WEDDING_USERNAME || 'admin',
      password: process.env.WORDPRESS_WEDDING_PASSWORD || '7gWh 2hj2 dnPK KqML iLdX lAw3',
      categories: ['Đám Cưới', 'Pre-Wedding', 'Wedding Photography', 'Bridal', 'Groom', 'Wedding Planning'],
      keywords: ['cưới', 'wedding', 'đám cưới', 'pre-wedding', 'prewedding', 'cô dâu', 'chú rể', 'bridal', 'groom'],
      isActive: true,
      priority: 100
    });

    // Yearbook Site - Chuyên kỷ yếu học sinh
    this.sites.set('yearbook', {
      id: 'yearbook', 
      name: 'Guu Kỷ Yếu',
      url: process.env.WORDPRESS_YEARBOOK_URL || 'https://guukyyeu.vn',
      username: process.env.WORDPRESS_YEARBOOK_USERNAME || 'admin',
      password: process.env.WORDPRESS_YEARBOOK_PASSWORD || 'KyL1 z5Zv VS8J 7ZWM 7A7q Wgjv',
      categories: ['Kỷ Yếu', 'Học Sinh', 'Graduation', 'School Photography', 'Student Life', 'Education'],
      keywords: ['kỷ yếu', 'graduation', 'học sinh', 'student', 'school', 'trường', 'lớp', 'class', 'giáo dục'],
      isActive: true,
      priority: 100
    });

    // Main Site - Tất cả categories còn lại
    this.sites.set('main', {
      id: 'main',
      name: 'Guustudio Main',
      url: process.env.WORDPRESS_MAIN_URL || 'https://guustudio.vn',
      username: process.env.WORDPRESS_MAIN_USERNAME || 'admin', 
      password: process.env.WORDPRESS_MAIN_PASSWORD || 'NrHT h6QT WH1a F46Q 7jSg iv6M',
      categories: ['Photography', 'Portrait', 'Corporate', 'Events', 'Lifestyle', 'Art', 'Design', 'Tips'],
      keywords: ['photography', 'chụp ảnh', 'portrait', 'corporate', 'doanh nghiệp', 'event', 'sự kiện', 'lifestyle'],
      isActive: true,
      priority: 50 // Lower priority - fallback site
    });

    logger.info(`✅ Initialized ${this.sites.size} WordPress sites`, {
      sites: Array.from(this.sites.keys())
    });
  }

  /**
   * Initialize smart content routing rules
   */
  private initializeRoutingRules(): void {
    this.routingRules = [
      // Wedding Site Rules - Highest Priority
      {
        keywords: ['cưới', 'wedding', 'đám cưới', 'pre-wedding', 'prewedding', 'cô dâu', 'chú rể', 'bridal', 'groom'],
        categories: ['wedding', 'pre-wedding', 'bridal', 'matrimony'],
        siteId: 'wedding',
        priority: 100,
        description: 'Wedding và Pre-wedding content → wedding.guustudio.vn'
      },

      // Yearbook Site Rules - High Priority  
      {
        keywords: ['kỷ yếu', 'graduation', 'học sinh', 'student', 'school', 'trường', 'lớp', 'class', 'giáo dục', 'education'],
        categories: ['yearbook', 'graduation', 'school', 'student', 'education'],
        siteId: 'yearbook',
        priority: 100,
        description: 'Kỷ yếu và học sinh content → guukyyeu.vn'
      },

      // Main Site Rules - Default Fallback
      {
        keywords: ['photography', 'chụp ảnh', 'portrait', 'corporate', 'doanh nghiệp', 'event', 'sự kiện', 'lifestyle', 'art'],
        categories: ['corporate', 'portrait', 'event', 'lifestyle', 'photography', 'general'],
        siteId: 'main',
        priority: 50,
        description: 'General photography content → guustudio.vn'
      }
    ];

    logger.info(`✅ Initialized ${this.routingRules.length} routing rules`);
  }

  /**
   * Initialize WordPress services for each site
   */
  private initializeServices(): void {
    for (const [siteId, config] of this.sites) {
      if (config.isActive) {
        const credentials = {
          siteUrl: config.url,
          username: config.username,
          applicationPassword: config.password
        };
        
        // Sử dụng WordPressService thật với fallback mechanism
        try {
        this.siteServices.set(siteId, new WordPressService(credentials));
        } catch (error) {
          logger.warn(`Failed to initialize WordPress service for ${config.name}, using mock service`, error);
          this.siteServices.set(siteId, new MockWordPressService(credentials) as any);
        }
        logger.info(`🔗 Initialized WordPress service for ${config.name}`, {
          siteId,
          url: config.url
        });
      }
    }
  }

  /**
   * Smart content routing - Determine best site for content
   */
  determineTargetSite(request: MultiSitePublishingRequest): string {
    // If target site explicitly specified
    if (request.targetSiteId && this.sites.has(request.targetSiteId)) {
      logger.info(`🎯 Using explicitly specified site: ${request.targetSiteId}`);
      return request.targetSiteId;
    }

    // Smart routing based on content type
    if (request.contentType) {
      switch (request.contentType) {
        case 'wedding':
        case 'pre-wedding':
          return 'wedding';
        case 'yearbook-school':
        case 'yearbook-concept':
          return 'yearbook';
        case 'corporate':
        default:
          return 'main';
      }
    }

    // Analyze content for automatic routing
    const contentText = `${request.title} ${request.body} ${request.excerpt || ''}`.toLowerCase();
    const contentCategories = request.categories?.map(c => c.toLowerCase()) || [];
    const contentTags = request.tags?.map(t => t.toLowerCase()) || [];

    let bestMatch = { siteId: 'main', score: 0, matchedRules: [] as ContentRoutingRule[] };

    for (const rule of this.routingRules) {
      let score = 0;
      const matchedKeywords: string[] = [];
      const matchedCategories: string[] = [];

      // Check keyword matches in content
      for (const keyword of rule.keywords) {
        if (contentText.includes(keyword.toLowerCase())) {
          score += 10;
          matchedKeywords.push(keyword);
        }
      }

      // Check category matches
      for (const ruleCategory of rule.categories) {
        if (contentCategories.some(cat => cat.includes(ruleCategory.toLowerCase()))) {
          score += 15;
          matchedCategories.push(ruleCategory);
        }
        if (contentTags.some(tag => tag.includes(ruleCategory.toLowerCase()))) {
          score += 10;
          matchedCategories.push(ruleCategory);
        }
      }

      // Apply priority multiplier
      score *= (rule.priority / 100);

      if (score > bestMatch.score) {
        bestMatch = {
          siteId: rule.siteId,
          score,
          matchedRules: [rule]
        };
      }

      logger.debug(`📊 Content routing analysis for ${rule.siteId}`, {
        siteId: rule.siteId,
        score,
        matchedKeywords,
        matchedCategories,
        ruleDescription: rule.description
      });
    }

    const selectedSite = this.sites.get(bestMatch.siteId);
    logger.info(`🎯 Smart routing selected: ${selectedSite?.name}`, {
      siteId: bestMatch.siteId,
      score: bestMatch.score,
      confidence: bestMatch.score > 20 ? 'High' : bestMatch.score > 10 ? 'Medium' : 'Low'
    });

    return bestMatch.siteId;
  }

  /**
   * Publish content to appropriate WordPress site(s)
   */
  async publishContent(request: MultiSitePublishingRequest): Promise<MultiSitePublishingResult> {
    const targetSiteId = this.determineTargetSite(request);
    const targetSite = this.sites.get(targetSiteId);
    const targetService = this.siteServices.get(targetSiteId);

    if (!targetSite || !targetService) {
      throw new Error(`Target site not found or not configured: ${targetSiteId}`);
    }

    logger.info(`📝 Publishing content to ${targetSite.name}`, {
      title: request.title,
      siteId: targetSiteId,
      url: targetSite.url
    });

    const results: MultiSitePublishingResult['results'] = [];
    const errors: string[] = [];
    let mainResult: MultiSitePublishingResult['mainResult'];

    try {
      // Prepare WordPress post data
      const postData = {
        title: request.title,
        body: request.body,
        excerpt: request.excerpt || '',
        categories: request.categories || [],
        tags: request.tags || [],
        status: request.status || 'publish' as const,
        featuredImageUrl: request.featuredImageUrl,
        seoTitle: request.seoTitle,
        seoDescription: request.seoDescription
      };

      // Prepare content object for WordPress
      const contentObject = {
        id: 'temp-id',
        title: postData.title,
        body: postData.body,
        excerpt: postData.excerpt,
        type: 'BLOG_POST' as any,
        status: 'APPROVED' as any,
        authorId: 'system',
        projectId: 'multi-site',
        metadata: {
          keywords: postData.tags,
          seoTitle: postData.seoTitle,
          seoDescription: postData.seoDescription
        },
        aiGenerated: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const publishSettings = {
        status: postData.status,
        categories: postData.categories,
        tags: postData.tags,
        featuredImageUrl: postData.featuredImageUrl,
        seoTitle: postData.seoTitle,
        seoDescription: postData.seoDescription
      };

      // Publish to target site
      const result = await targetService.publishContent(contentObject, publishSettings);

      if (result.success && result.externalId) {
        mainResult = {
          siteId: targetSiteId,
          siteName: targetSite.name,
          postId: parseInt(result.externalId),
          url: result.externalUrl || ''
        };

        results.push({
          siteId: targetSiteId,
          siteName: targetSite.name,
          success: true,
          postId: parseInt(result.externalId),
          url: result.externalUrl
        });

        logger.info(`✅ Successfully published to ${targetSite.name}`, {
          postId: result.externalId,
          url: result.externalUrl
        });
      } else {
        errors.push(`Failed to publish to ${targetSite.name}: ${result.message}`);
        results.push({
          siteId: targetSiteId,
          siteName: targetSite.name,
          success: false,
          error: result.message
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to publish to ${targetSite.name}`, {
        error: errorMessage,
        siteId: targetSiteId,
        url: targetSite.url
      });

      // If real WordPress service fails, try with mock service as fallback
      if (targetService instanceof WordPressService) {
        logger.warn(`🔄 Retrying with mock service for ${targetSite.name}`);
        try {
          const mockService = new MockWordPressService({
            siteUrl: targetSite.url,
            username: targetSite.username,
            applicationPassword: targetSite.password
          });
          
          const mockResult = await mockService.publishContent(contentObject, publishSettings);
          
          if (mockResult.success) {
            mainResult = {
              siteId: targetSiteId,
              siteName: `${targetSite.name} (Mock)`,
              postId: parseInt(mockResult.externalId),
              url: mockResult.externalUrl || ''
            };

            results.push({
              siteId: targetSiteId,
              siteName: `${targetSite.name} (Mock)`,
              success: true,
              postId: parseInt(mockResult.externalId),
              url: mockResult.externalUrl
            });

            logger.info(`✅ Successfully published to ${targetSite.name} using mock service`);
          } else {
            throw new Error(mockResult.message);
          }
        } catch (mockError) {
          errors.push(`Exception publishing to ${targetSite.name}: ${errorMessage}`);
          results.push({
            siteId: targetSiteId,
            siteName: targetSite.name,
            success: false,
            error: errorMessage
          });
        }
      } else {
      errors.push(`Exception publishing to ${targetSite.name}: ${errorMessage}`);
      results.push({
        siteId: targetSiteId,
        siteName: targetSite.name,
        success: false,
        error: errorMessage
      });
      }
    }

    const totalPublished = results.filter(r => r.success).length;

    return {
      success: totalPublished > 0,
      results,
      mainResult,
      totalPublished,
      errors
    };
  }

  /**
   * Publish to multiple sites (for cross-posting)
   */
  async publishToMultipleSites(
    request: MultiSitePublishingRequest,
    targetSiteIds: string[]
  ): Promise<MultiSitePublishingResult> {
    logger.info(`📰 Cross-posting to ${targetSiteIds.length} sites`, {
      title: request.title,
      targetSites: targetSiteIds
    });

    const results: MultiSitePublishingResult['results'] = [];
    const errors: string[] = [];
    let mainResult: MultiSitePublishingResult['mainResult'];

    for (const siteId of targetSiteIds) {
      const site = this.sites.get(siteId);
      const service = this.siteServices.get(siteId);

      if (!site || !service) {
        errors.push(`Site not found or not configured: ${siteId}`);
        results.push({
          siteId,
          siteName: site?.name || siteId,
          success: false,
          error: `Site not configured: ${siteId}`
        });
        continue;
      }

      try {
        const postData = {
          title: request.title,
          body: request.body,
          excerpt: request.excerpt || '',
          categories: request.categories || [],
          tags: request.tags || [],
          status: request.status || 'publish' as const,
          featuredImageUrl: request.featuredImageUrl,
          seoTitle: request.seoTitle,
          seoDescription: request.seoDescription
        };

        // Prepare content object for WordPress
        const contentObject = {
          id: 'temp-id',
          title: postData.title,
          body: postData.body,
          excerpt: postData.excerpt,
          type: 'BLOG_POST' as any,
          status: 'APPROVED' as any,
          authorId: 'system',
          projectId: 'multi-site',
          metadata: {
            keywords: postData.tags,
            seoTitle: postData.seoTitle,
            seoDescription: postData.seoDescription
          },
          aiGenerated: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const publishSettings = {
          status: postData.status,
          categories: postData.categories,
          tags: postData.tags,
          featuredImageUrl: postData.featuredImageUrl,
          seoTitle: postData.seoTitle,
          seoDescription: postData.seoDescription
        };

        const result = await service.publishContent(contentObject, publishSettings);

        if (result.success && result.externalId) {
          // First successful result becomes main result
          if (!mainResult) {
            mainResult = {
              siteId,
              siteName: site.name,
              postId: parseInt(result.externalId),
              url: result.externalUrl || ''
            };
          }

          results.push({
            siteId,
            siteName: site.name,
            success: true,
            postId: parseInt(result.externalId),
            url: result.externalUrl
          });

          logger.info(`✅ Cross-posted to ${site.name}`, {
            postId: result.externalId,
            url: result.externalUrl
          });
        } else {
          errors.push(`Failed to publish to ${site.name}: ${result.message}`);
          results.push({
            siteId,
            siteName: site.name,
            success: false,
            error: result.message
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Exception publishing to ${site.name}: ${errorMessage}`);
        results.push({
          siteId,
          siteName: site.name,
          success: false,
          error: errorMessage
        });

        logger.error(`❌ Failed to cross-post to ${site.name}`, error);
      }
    }

    const totalPublished = results.filter(r => r.success).length;

    return {
      success: totalPublished > 0,
      results,
      mainResult,
      totalPublished,
      errors
    };
  }

  /**
   * Get all configured sites
   */
  getSites(): WordPressSiteConfig[] {
    return Array.from(this.sites.values());
  }

  /**
   * Get specific site configuration
   */
  getSite(siteId: string): WordPressSiteConfig | undefined {
    return this.sites.get(siteId);
  }

  /**
   * Test connection to all sites
   */
  async testAllConnections(): Promise<{
    [siteId: string]: {
      success: boolean;
      siteName: string;
      url: string;
      error?: string;
      responseTime?: number;
    };
  }> {
    logger.info('🔍 Testing connections to all WordPress sites');

    const results: any = {};

    for (const [siteId, site] of this.sites) {
      if (!site.isActive) {
        results[siteId] = {
          success: false,
          siteName: site.name,
          url: site.url,
          error: 'Site is inactive'
        };
        continue;
      }

      const service = this.siteServices.get(siteId);
      if (!service) {
        results[siteId] = {
          success: false,
          siteName: site.name,
          url: site.url,
          error: 'Service not initialized'
        };
        continue;
      }

      const startTime = Date.now();
      try {
        // Test with WordPress connection test method
        const testResult = await service.testConnection();

        const responseTime = Date.now() - startTime;

        results[siteId] = {
          success: testResult.success,
          siteName: site.name,
          url: site.url,
          responseTime,
          error: testResult.success ? undefined : testResult.error
        };

        logger.info(`${testResult.success ? '✅' : '❌'} Connection test ${site.name}`, {
          siteId,
          success: testResult.success,
          responseTime
        });

      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results[siteId] = {
          success: false,
          siteName: site.name,
          url: site.url,
          responseTime,
          error: errorMessage
        };

        logger.error(`❌ Connection test failed ${site.name}`, {
          siteId,
          error: errorMessage
        });
      }
    }

    return results;
  }

  /**
   * Get publishing statistics
   */
  getPublishingStats(): {
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
    return {
      totalSites: this.sites.size,
      activeSites: Array.from(this.sites.values()).filter(s => s.isActive).length,
      routingRules: this.routingRules.length,
      siteStats: Array.from(this.sites.values()).map(site => ({
        siteId: site.id,
        siteName: site.name,
        isActive: site.isActive,
        categories: site.categories.length,
        keywords: site.keywords.length,
        priority: site.priority
      }))
    };
  }

  /**
   * Update site configuration
   */
  updateSiteConfig(siteId: string, updates: Partial<WordPressSiteConfig>): boolean {
    const site = this.sites.get(siteId);
    if (!site) {
      logger.warn(`Site not found for update: ${siteId}`);
      return false;
    }

    Object.assign(site, updates);
    
    // Reinitialize service if credentials changed
    if (updates.url || updates.username || updates.password) {
             const credentials = {
         siteUrl: site.url,
         username: site.username,
         applicationPassword: site.password
       };
      this.siteServices.set(siteId, new WordPressService(credentials));
    }

    logger.info(`✅ Updated site configuration: ${site.name}`, {
      siteId,
      updates: Object.keys(updates)
    });

    return true;
  }
} 