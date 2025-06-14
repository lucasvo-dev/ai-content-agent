import { Request, Response } from 'express';
import { ContentService } from '@/services/ContentService';
import { AuthRequest } from '@/types';
import { ValidationError, NotFoundError, ForbiddenError } from '@/utils/errors';
import { ContentType, ContentStatus } from '@/models/Content';

export class ContentController {
  private contentService: ContentService;

  constructor() {
    this.contentService = new ContentService();
  }

  /**
   * Create new content
   * POST /api/v1/content
   */
  async createContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const contentData = req.body;

      const content = await this.contentService.createContent(userId, contentData);

      res.status(201).json({
        success: true,
        data: content,
        message: 'Content created successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get content list with filters and pagination
   * GET /api/v1/content
   */
  async getContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        projectId,
        type,
        status,
        search,
        limit = '20',
        offset = '0',
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const options = {
        projectId: projectId as string,
        type: type as ContentType,
        status: status as ContentStatus,
        search: search as string,
        limit: Math.min(parseInt(limit as string, 10), 100),
        offset: parseInt(offset as string, 10),
        sortBy: sortBy as 'title' | 'created_at' | 'updated_at',
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await this.contentService.getContent(userId, options);

      res.json({
        success: true,
        data: result,
        message: 'Content retrieved successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get content by ID
   * GET /api/v1/content/:id
   */
  async getContentById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const content = await this.contentService.getContentById(id, userId);

      res.json({
        success: true,
        data: content,
        message: 'Content retrieved successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Update content
   * PUT /api/v1/content/:id
   */
  async updateContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updateData = req.body;

      const content = await this.contentService.updateContent(id, userId, updateData);

      res.json({
        success: true,
        data: content,
        message: 'Content updated successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Delete content
   * DELETE /api/v1/content/:id
   */
  async deleteContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await this.contentService.deleteContent(id, userId);

      res.json({
        success: true,
        message: 'Content deleted successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Duplicate content
   * POST /api/v1/content/:id/duplicate
   */
  async duplicateContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const duplicatedContent = await this.contentService.duplicateContent(id, userId);

      res.status(201).json({
        success: true,
        data: duplicatedContent,
        message: 'Content duplicated successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get content versions
   * GET /api/v1/content/:id/versions
   */
  async getContentVersions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const versions = await this.contentService.getContentVersions(id, userId);

      res.json({
        success: true,
        data: versions,
        message: 'Content versions retrieved successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Search content with advanced filters
   * GET /api/v1/content/search
   */
  async searchContent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        q: searchQuery,
        projectId,
        type,
        status,
        aiGenerated,
        dateFrom,
        dateTo
      } = req.query;

      if (!searchQuery) {
        throw new ValidationError('Search query (q) is required');
      }

      const filters = {
        projectId: projectId as string,
        type: type as ContentType,
        status: status as ContentStatus,
        aiGenerated: aiGenerated === 'true' ? true : aiGenerated === 'false' ? false : undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined
      };

      const results = await this.contentService.searchContent(userId, searchQuery as string, filters);

      res.json({
        success: true,
        data: {
          results,
          query: searchQuery,
          filters
        },
        message: 'Content search completed successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get content analytics
   * GET /api/v1/content/analytics
   */
  async getContentAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        projectId,
        dateFrom,
        dateTo
      } = req.query;

      const analytics = await this.contentService.getContentAnalytics(
        userId,
        projectId as string,
        dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo ? new Date(dateTo as string) : undefined
      );

      res.json({
        success: true,
        data: analytics,
        message: 'Content analytics retrieved successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get content health check
   * GET /api/v1/content/health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          service: 'ContentService',
          status: 'healthy',
          timestamp: new Date().toISOString()
        },
        message: 'Content service is healthy'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Error handling helper
   */
  private handleError(error: any, res: Response): void {
    console.error('ContentController Error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    } else if (error instanceof ForbiddenError) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
} 