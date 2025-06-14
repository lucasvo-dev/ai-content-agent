import { Request, Response } from 'express';
import { ProjectService } from '@/services/ProjectService';
import { AuthRequest } from '@/types';
import { ValidationError, NotFoundError, ForbiddenError } from '@/utils/errors';

export class ProjectController {
  private projectService: ProjectService;

  constructor() {
    this.projectService = new ProjectService();
  }

  /**
   * Create new project
   * POST /api/v1/projects
   */
  async createProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const projectData = req.body;

      const project = await this.projectService.createProject(userId, projectData);

      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get user's projects with pagination
   * GET /api/v1/projects
   */
  async getProjects(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        limit = '20',
        offset = '0',
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const options = {
        limit: Math.min(parseInt(limit as string, 10), 100),
        offset: parseInt(offset as string, 10),
        search: search as string,
        sortBy: sortBy as 'name' | 'created_at' | 'updated_at',
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await this.projectService.getUserProjects(userId, options);

      res.json({
        success: true,
        data: result,
        message: 'Projects retrieved successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get project by ID
   * GET /api/v1/projects/:id
   */
  async getProjectById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const project = await this.projectService.getProjectById(id, userId);

      res.json({
        success: true,
        data: project,
        message: 'Project retrieved successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Update project
   * PUT /api/v1/projects/:id
   */
  async updateProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updateData = req.body;

      const project = await this.projectService.updateProject(id, userId, updateData);

      res.json({
        success: true,
        data: project,
        message: 'Project updated successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Delete project
   * DELETE /api/v1/projects/:id
   */
  async deleteProject(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await this.projectService.deleteProject(id, userId);

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Add project member
   * POST /api/v1/projects/:id/members
   */
  async addProjectMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { email, role = 'member' } = req.body;

      if (!email) {
        throw new ValidationError('Email is required');
      }

      const member = await this.projectService.addProjectMember(id, userId, email, role);

      res.status(201).json({
        success: true,
        data: member,
        message: 'Project member added successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Remove project member
   * DELETE /api/v1/projects/:id/members/:userId
   */
  async removeProjectMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user!.id;
      const { id, userId } = req.params;

      await this.projectService.removeProjectMember(id, currentUserId, userId);

      res.json({
        success: true,
        message: 'Project member removed successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get project statistics
   * GET /api/v1/projects/:id/stats
   */
  async getProjectStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const stats = await this.projectService.getProjectStats(id, userId);

      res.json({
        success: true,
        data: stats,
        message: 'Project statistics retrieved successfully'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Get project health check
   * GET /api/v1/projects/health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          service: 'ProjectService',
          status: 'healthy',
          timestamp: new Date().toISOString()
        },
        message: 'Project service is healthy'
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Error handling helper
   */
  private handleError(error: any, res: Response): void {
    console.error('ProjectController Error:', error);

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