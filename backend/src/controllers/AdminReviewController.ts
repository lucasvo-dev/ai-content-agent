import { Response, NextFunction } from 'express';
import { AdminReviewService } from '../services/AdminReviewService';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

export class AdminReviewController {
  private reviewService: AdminReviewService;

  constructor() {
    this.reviewService = new AdminReviewService();
  }

  /**
   * @route GET /api/v1/admin/review/pending
   * @desc Get content pending review
   * @access Admin/Editor
   */
  getPendingReview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user?.id || 'mock-admin-123'; // Mock admin ID for testing
    /* if (!adminId) {
      throw new AppError('Admin authentication required', 401);
    } */

    const {
      status = 'pending',
      batchJobId,
      priority,
      limit = 20,
      offset = 0
    } = req.query;

    const filters = {
      status: status as string,
      batchJobId: batchJobId as string,
      priority: priority as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    };

    const result = await this.reviewService.getReviewQueue(adminId, filters);

    res.json({
      success: true,
      data: {
        reviewItems: result.reviewItems,
        summary: result.summary,
        pagination: result.pagination
      },
      message: `Found ${result.reviewItems.length} items in review queue`
    });
  });

  /**
   * @route POST /api/v1/admin/review/approve
   * @desc Approve single content
   * @access Admin/Editor
   */
  approveContent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user?.id || 'mock-admin-123'; // Mock admin ID for testing
    /* if (!adminId) {
      throw new AppError('Admin authentication required', 401);
    } */

    const {
      contentId,
      qualityRating,
      adminNotes,
      edits,
      autoPublish = false,
      publishSettings
    } = req.body;

    if (!contentId) {
      throw new AppError('Content ID is required', 400);
    }

    const options = {
      qualityRating: qualityRating ? parseInt(qualityRating, 10) : undefined,
      notes: adminNotes,
      edits,
      autoPublish,
      publishSettings
    };

    const result = await this.reviewService.approveContent(contentId, adminId, { approve: true, ...options });

    res.json({
      success: true,
      data: result,
      message: 'Content approved successfully'
    });
  });

  /**
   * @route POST /api/v1/admin/review/reject
   * @desc Reject content
   * @access Admin/Editor
   */
  rejectContent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user?.id || 'mock-admin-123'; // Mock admin ID for testing
    /* if (!adminId) {
      throw new AppError('Admin authentication required', 401);
    } */

    const { contentId, reason, regenerate = false } = req.body;

    if (!contentId) {
      throw new AppError('Content ID is required', 400);
    }

    if (!reason) {
      throw new AppError('Rejection reason is required', 400);
    }

    const result = await this.reviewService.rejectContent(contentId, adminId, reason, { regenerate });

    res.json({
      success: true,
      data: result,
      message: 'Content rejected successfully'
    });
  });

  /**
   * @route POST /api/v1/admin/review/bulk
   * @desc Bulk approve/reject multiple content items
   * @access Admin/Editor
   */
  bulkAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user?.id || 'mock-admin-123'; // Mock admin ID for testing
    /* if (!adminId) {
      throw new AppError('Admin authentication required', 401);
    } */

    const {
      action,
      contentIds,
      defaultQualityRating = 4,
      autoPublish = false,
      publishSettings,
      adminNotes,
      concurrency = 3
    } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      throw new AppError('Valid action is required (approve or reject)', 400);
    }

    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      throw new AppError('Content IDs array is required', 400);
    }

    if (contentIds.length > 50) {
      throw new AppError('Maximum 50 items can be processed at once', 400);
    }

    let result;

    if (action === 'approve') {
      const options = {
        defaultQualityRating,
        autoPublish,
        publishSettings,
        adminNotes,
        concurrency
      };
      result = await this.reviewService.bulkApprove(contentIds, adminId, { contentIds, approve: true, ...options });
    } else {
      // Bulk reject implementation would go here
      throw new AppError('Bulk reject not implemented yet', 501);
    }

    res.json({
      success: true,
      data: {
        action,
        totalItems: contentIds.length,
        ...result
      },
      message: `Bulk ${action} completed: ${result.successCount} successful, ${result.errorCount} errors`
    });
  });

  /**
   * @route PUT /api/v1/admin/review/:contentId
   * @desc Edit content before approval
   * @access Admin/Editor
   */
  editContent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) {
      throw new AppError('Admin authentication required', 401);
    }

    const { contentId } = req.params;
    const edits = req.body;

    if (!contentId) {
      throw new AppError('Content ID is required', 400);
    }

    if (!edits || Object.keys(edits).length === 0) {
      throw new AppError('Edit data is required', 400);
    }

    const result = await this.reviewService.editContent(contentId, adminId, edits);

    res.json({
      success: true,
      data: result,
      message: 'Content edited successfully'
    });
  });

  /**
   * @route GET /api/v1/admin/review/:contentId
   * @desc Get full content details for review
   * @access Admin/Editor
   */
  getContentDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { contentId } = req.params;

    if (!contentId) {
      throw new AppError('Content ID is required', 400);
    }

    // Find content in review queue
    const adminId = req.user?.id || 'system';
    const queueResult = await this.reviewService.getReviewQueue(adminId, {});
    const reviewItem = queueResult.reviewItems.find(item => item.contentId === contentId);

    if (!reviewItem) {
      throw new AppError('Content not found in review queue', 404);
    }

    res.json({
      success: true,
      data: {
        reviewItem,
        fullContent: reviewItem.content,
        qualityScore: reviewItem.qualityScore,
        editHistory: reviewItem.content.editHistory || []
      },
      message: 'Content details retrieved successfully'
    });
  });

  /**
   * @route GET /api/v1/admin/review/statistics
   * @desc Get review queue statistics
   * @access Admin/Editor
   */
  getStatistics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const statistics = await this.reviewService.getReviewStatistics();

    res.json({
      success: true,
      data: {
        statistics,
        timestamp: new Date(),
        capabilities: {
          maxBulkOperations: 50,
          supportedActions: ['approve', 'reject', 'edit'],
          autoApprovalEnabled: true,
          qualityThreshold: 85
        }
      },
      message: 'Review statistics retrieved successfully'
    });
  });

  /**
   * @route GET /api/v1/admin/review/health
   * @desc Get admin review system health status
   * @access Admin/Editor
   */
  getHealthStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const statistics = await this.reviewService.getReviewStatistics();
    
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      metrics: {
        totalItems: statistics.totalItems,
        pendingReview: statistics.pendingReview,
        processingCapacity: '50 items/batch',
        averageReviewTime: '5-10 minutes',
        autoApprovalRate: statistics.autoApproved > 0 
          ? Math.round((statistics.autoApproved / statistics.totalItems) * 100) 
          : 0
      },
      services: {
        reviewQueue: 'operational',
        qualityScoring: 'operational',
        bulkOperations: 'operational',
        contentEditing: 'operational'
      }
    };

    // Determine overall health status
    if (statistics.pendingReview > 100) {
      health.status = 'warning';
    }
    if (statistics.pendingReview > 200) {
      health.status = 'critical';
    }

    res.json({
      success: true,
      data: health,
      message: `Admin review system is ${health.status}`
    });
  });

  /**
   * @route GET /api/v1/admin/review/templates
   * @desc Get review action templates
   * @access Admin/Editor
   */
  getReviewTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templates = {
      approvalNotes: [
        'Excellent content quality, ready for publishing',
        'Good content with minor improvements applied',
        'Content approved with SEO optimizations',
        'High-quality content, well-structured and engaging'
      ],
      rejectionReasons: [
        'Content quality below standards',
        'Insufficient length or detail',
        'Poor SEO optimization',
        'Content not aligned with brand voice',
        'Factual errors or inaccuracies',
        'Duplicate or similar content exists'
      ],
      editSuggestions: [
        'Improve SEO title and description',
        'Add more detailed examples',
        'Enhance introduction and conclusion',
        'Include relevant internal links',
        'Optimize keyword density',
        'Improve readability and structure'
      ],
      qualityRatings: [
        { score: 9, label: 'Exceptional', description: 'Outstanding quality, ready for immediate publishing' },
        { score: 8, label: 'Excellent', description: 'High quality with minor improvements' },
        { score: 7, label: 'Good', description: 'Solid content with some enhancements needed' },
        { score: 6, label: 'Acceptable', description: 'Meets basic standards' },
        { score: 5, label: 'Needs Work', description: 'Requires significant improvements' }
      ]
    };

    res.json({
      success: true,
      data: templates,
      message: 'Review templates retrieved successfully'
    });
  });
} 