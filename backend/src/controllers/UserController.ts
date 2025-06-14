import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { DatabaseService } from '../services/DatabaseService';
import { 
  ValidationError, 
  NotFoundError, 
  ForbiddenError, 
  formatErrorResponse 
} from '../utils/errors';
import { AuthRequest, AuthenticatedRequest } from '../types';


export class UserController {
  private userService: UserService;

  constructor() {
    const dbService = new DatabaseService();
    this.userService = new UserService(dbService);
  }

  /**
   * Get current user profile
   * GET /api/v1/users/profile
   */
  getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      const user = await this.userService.findUserById(req.user.id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user profile
   * PUT /api/v1/users/profile
   */
  updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      const { firstName, lastName } = req.body;

      // Validate input
      if (firstName && typeof firstName !== 'string') {
        throw new ValidationError('First name must be a string');
      }
      if (lastName && typeof lastName !== 'string') {
        throw new ValidationError('Last name must be a string');
      }

      const updatedUser = await this.userService.updateUser(req.user.id, {
        firstName,
        lastName,
      });

      res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user statistics
   * GET /api/v1/users/stats
   */
  getStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      const stats = await this.userService.getUserStats(req.user.id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Change password
   * POST /api/v1/users/change-password
   */
  changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        throw new ValidationError('Current password and new password are required');
      }

      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        throw new ValidationError('Passwords must be strings');
      }

      if (newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long');
      }

      await this.userService.changePassword(req.user.id, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Deactivate account
   * DELETE /api/v1/users/account
   */
  deactivateAccount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      await this.userService.deactivateUser(req.user.id);

      res.json({
        success: true,
        message: 'Account deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * List users (admin only)
   * GET /api/v1/users
   */
  listUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ValidationError('User not authenticated');
      }

      // Check if user is admin
      if (req.user.role !== 'admin') {
        throw new ValidationError('Admin access required');
      }

      const limit = parseInt(req.query['limit'] as string) || 20;
      const offset = parseInt(req.query['offset'] as string) || 0;
      const search = req.query['search'] as string;

      // Validate pagination parameters
      if (limit > 100) {
        throw new ValidationError('Limit cannot exceed 100');
      }
      if (limit < 1 || offset < 0) {
        throw new ValidationError('Invalid pagination parameters');
      }

      const result = await this.userService.listUsers(limit, offset, search);

      res.json({
        success: true,
        data: {
          users: result.users,
          pagination: {
            total: result.total,
            limit,
            offset,
            hasNext: offset + limit < result.total,
            hasPrevious: offset > 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user by ID (admin only)
   * GET /api/v1/users/:userId
   */
  getUserById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestedUserId = req.params['userId'];
      if (!requestedUserId) {
        throw new ValidationError('User ID is required');
      }

      const user = await this.userService.findUserById(requestedUserId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user (admin only)
   * PUT /api/v1/users/:userId
   */
  updateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params['userId'];
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      // Check if user is admin
      if (req.user.role !== 'admin') {
        throw new ValidationError('Admin access required');
      }

      const { firstName, lastName, emailVerified, isActive } = req.body;

      // Validate input
      const updateData: any = {};
      if (firstName !== undefined) {
        if (typeof firstName !== 'string') {
          throw new ValidationError('First name must be a string');
        }
        updateData.firstName = firstName;
      }
      if (lastName !== undefined) {
        if (typeof lastName !== 'string') {
          throw new ValidationError('Last name must be a string');
        }
        updateData.lastName = lastName;
      }
      if (emailVerified !== undefined) {
        if (typeof emailVerified !== 'boolean') {
          throw new ValidationError('Email verified must be a boolean');
        }
        updateData.emailVerified = emailVerified;
      }
      if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') {
          throw new ValidationError('Is active must be a boolean');
        }
        updateData.isActive = isActive;
      }

      const updatedUser = await this.userService.updateUser(userId, updateData);

      res.json({
        success: true,
        data: updatedUser,
        message: 'User updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Health check for user service
   * GET /api/v1/users/health
   */
  healthCheck = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Simple health check - could be expanded to check database connectivity
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'UserService',
        version: '1.0.0'
      };

      res.status(200).json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      next(error);
    }
  };
} 