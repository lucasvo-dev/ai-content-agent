import { Request, Response } from 'express';
import { WordPressSiteService } from '../services/WordPressSiteService';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../types';

export class WordPressSiteController {
  private wpSiteService: WordPressSiteService;

  constructor() {
    this.wpSiteService = new WordPressSiteService();
  }

  /**
   * Add a new WordPress site
   * POST /api/v1/wordpress-sites
   */
  addSite = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
      return;
    }

    const { name, siteUrl, username, applicationPassword } = req.body;

    if (!name || !siteUrl || !username || !applicationPassword) {
      res.status(400).json({
        success: false,
        error: { message: 'All fields are required: name, siteUrl, username, applicationPassword' }
      });
      return;
    }

    const site = await this.wpSiteService.addWordPressSite(userId, {
      name,
      siteUrl,
      username,
      applicationPassword
    });

    // Remove sensitive information from response
    const { applicationPassword: _, ...siteResponse } = site;

    res.status(201).json({
      success: true,
      data: siteResponse,
      message: 'WordPress site added successfully'
    });
  });

  /**
   * Get all WordPress sites for current user
   * GET /api/v1/wordpress-sites
   */
  getUserSites = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
      return;
    }

    const sites = await this.wpSiteService.getUserWordPressSites(userId);

    // Remove sensitive information from response
    const sitesResponse = sites.map(site => {
      const { applicationPassword, ...siteData } = site;
      return siteData;
    });

    res.json({
      success: true,
      data: {
        sites: sitesResponse,
        total: sitesResponse.length
      }
    });
  });

  /**
   * Get a specific WordPress site
   * GET /api/v1/wordpress-sites/:siteId
   */
  getSite = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { siteId } = req.params;
    const userId = req.user?.id;

    const site = await this.wpSiteService.getWordPressSite(siteId);

    if (!site) {
      res.status(404).json({
        success: false,
        error: { message: 'WordPress site not found' }
      });
      return;
    }

    // Check ownership
    if (site.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
      return;
    }

    // Remove sensitive information from response
    const { applicationPassword, ...siteResponse } = site;

    res.json({
      success: true,
      data: siteResponse
    });
  });

  /**
   * Update WordPress site
   * PUT /api/v1/wordpress-sites/:siteId
   */
  updateSite = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { siteId } = req.params;
    const userId = req.user?.id;
    const updates = req.body;

    const existingSite = await this.wpSiteService.getWordPressSite(siteId);

    if (!existingSite) {
      res.status(404).json({
        success: false,
        error: { message: 'WordPress site not found' }
      });
      return;
    }

    // Check ownership
    if (existingSite.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
      return;
    }

    const updatedSite = await this.wpSiteService.updateWordPressSite(siteId, updates);

    // Remove sensitive information from response
    const { applicationPassword, ...siteResponse } = updatedSite;

    res.json({
      success: true,
      data: siteResponse,
      message: 'WordPress site updated successfully'
    });
  });

  /**
   * Delete WordPress site
   * DELETE /api/v1/wordpress-sites/:siteId
   */
  deleteSite = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { siteId } = req.params;
    const userId = req.user?.id;

    const site = await this.wpSiteService.getWordPressSite(siteId);

    if (!site) {
      res.status(404).json({
        success: false,
        error: { message: 'WordPress site not found' }
      });
      return;
    }

    // Check ownership
    if (site.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
      return;
    }

    await this.wpSiteService.deleteWordPressSite(siteId);

    res.json({
      success: true,
      message: 'WordPress site deleted successfully'
    });
  });

  /**
   * Test WordPress connection
   * POST /api/v1/wordpress-sites/test-connection
   */
  testConnection = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { siteUrl, username, applicationPassword } = req.body;

    if (!siteUrl || !username || !applicationPassword) {
      res.status(400).json({
        success: false,
        error: { message: 'siteUrl, username, and applicationPassword are required' }
      });
      return;
    }

    const testResult = await this.wpSiteService.testWordPressConnection({
      name: 'Test Connection', // Temporary name for testing
      siteUrl,
      username,
      applicationPassword
    });

    res.json({
      success: testResult.success,
      data: testResult.siteInfo,
      message: testResult.success ? 'Connection successful' : 'Connection failed',
      error: testResult.success ? undefined : { message: testResult.error || 'Unknown error' }
    });
  });

  /**
   * Test specific WordPress site connection
   * POST /api/v1/wordpress-sites/:siteId/test
   */
  testSiteConnection = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { siteId } = req.params;
    const userId = req.user?.id;

    const site = await this.wpSiteService.getWordPressSite(siteId);

    if (!site) {
      res.status(404).json({
        success: false,
        error: { message: 'WordPress site not found' }
      });
      return;
    }

    // Check ownership
    if (site.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
      return;
    }

    // Decrypt password and test connection
    const decryptedPassword = await this.wpSiteService['decryptPassword'](site.applicationPassword);
    
    const testResult = await this.wpSiteService.testWordPressConnection({
      name: site.name,
      siteUrl: site.siteUrl,
      username: site.username,
      applicationPassword: decryptedPassword
    });

    // Update site test status
    await this.wpSiteService.updateWordPressSite(siteId, {});

    res.json({
      success: testResult.success,
      data: {
        testResult,
        siteInfo: testResult.siteInfo
      },
      message: testResult.success ? 'Connection test successful' : 'Connection test failed'
    });
  });

  /**
   * Test all user's WordPress sites
   * POST /api/v1/wordpress-sites/test-all
   */
  testAllSites = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
      return;
    }

    await this.wpSiteService.testAllUserSites(userId);

    res.json({
      success: true,
      message: 'All WordPress sites tested successfully'
    });
  });

  /**
   * Get WordPress sites available for publishing
   * GET /api/v1/wordpress-sites/available-for-publishing
   */
  getAvailableSites = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
      return;
    }

    const availableSites = await this.wpSiteService.getAvailableSitesForPublishing(userId);

    // Remove sensitive information from response
    const sitesResponse = availableSites.map(site => {
      const { applicationPassword, ...siteData } = site;
      return siteData;
    });

    res.json({
      success: true,
      data: {
        sites: sitesResponse,
        total: sitesResponse.length
      }
    });
  });

  /**
   * Get WordPress site categories and tags
   * GET /api/v1/wordpress-sites/:siteId/taxonomy
   */
  getSiteTaxonomy = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { siteId } = req.params;
    const userId = req.user?.id;

    const site = await this.wpSiteService.getWordPressSite(siteId);

    if (!site) {
      res.status(404).json({
        success: false,
        error: { message: 'WordPress site not found' }
      });
      return;
    }

    // Check ownership
    if (site.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { message: 'Access denied' }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        categories: site.siteInfo?.categories || [],
        tags: site.siteInfo?.tags || [],
        siteInfo: {
          title: site.siteInfo?.title,
          description: site.siteInfo?.description,
          timezone: site.siteInfo?.timezone
        }
      }
    });
  });

  /**
   * Get WordPress sites statistics
   * GET /api/v1/wordpress-sites/stats
   */
  getSitesStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' }
      });
      return;
    }

    const sites = await this.wpSiteService.getUserWordPressSites(userId);

    const stats = {
      totalSites: sites.length,
      activeSites: sites.filter(site => site.isActive).length,
      connectedSites: sites.filter(site => site.testStatus === 'success').length,
      failedSites: sites.filter(site => site.testStatus === 'failed').length,
      recentTests: sites
        .filter(site => site.lastTested)
        .sort((a, b) => (b.lastTested?.getTime() || 0) - (a.lastTested?.getTime() || 0))
        .slice(0, 5)
        .map(site => ({
          id: site.id,
          name: site.name,
          siteUrl: site.siteUrl,
          testStatus: site.testStatus,
          lastTested: site.lastTested,
          testError: site.testError
        }))
    };

    res.json({
      success: true,
      data: stats
    });
  });
} 