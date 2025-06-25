import { Content } from '../models/Content';
import { GeneratedContent, ReviewQueueItem, ReviewFilters, ApprovalOptions, BulkApprovalOptions, ApprovalResult, QualityScore, ReviewMetrics } from '../types';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface ReviewQueueSettings {
  autoApprovalThreshold: number;
  maxPendingItems: number;
  defaultReviewTimeout: number; // hours
}

interface ContentEdit {
  field: string;
  oldValue: string;
  newValue: string;
  timestamp: Date;
  adminId: string;
}

export class AdminReviewService {
  private reviewQueue: Map<string, ReviewQueueItem> = new Map();
  private qualityScores: Map<string, QualityScore> = new Map();
  private settings: ReviewQueueSettings = {
    autoApprovalThreshold: 85,
    maxPendingItems: 100,
    defaultReviewTimeout: 24
  };

  constructor() {
    logger.info('AdminReviewService initialized');
  }

  /**
   * Add content to review queue
   */
  async addToReviewQueue(
    content: GeneratedContent,
    batchJobId?: string,
    priority: number = 1
  ): Promise<ReviewQueueItem> {
    try {
      const reviewId = `review_${Date.now()}_${uuidv4().slice(0, 8)}`;
      
      // Calculate quality score
      const qualityScore = await this.calculateQualityScore(content);
      
      const reviewItem: ReviewQueueItem = {
        id: reviewId,
        contentId: content.id,
        batchJobId,
        content,
        status: 'pending',
        priority,
        qualityScore,
        preview: this.generatePreview(content),
        estimatedReadTime: this.calculateReadTime(content.body),
        createdAt: new Date(),
        metadata: {
          aiProvider: content.aiProvider || 'unknown',
          uniquenessScore: content.metadata?.uniquenessScore || 0,
          seoScore: content.metadata?.seoScore || 0,
          sourceUrls: content.sourceResearch || []
        }
      };

      // Auto-approve high quality content if enabled
      if (qualityScore.overall >= this.settings.autoApprovalThreshold) {
        reviewItem.status = 'auto_approved';
        reviewItem.autoApproved = true;
        reviewItem.reviewedAt = new Date();
        logger.info(`Content ${content.id} auto-approved with quality score ${qualityScore.overall}`);
      }

      this.reviewQueue.set(reviewId, reviewItem);
      this.qualityScores.set(content.id, qualityScore);

      logger.info(`Content added to review queue: ${reviewId}`);
      return reviewItem;
    } catch (error) {
      logger.error('Error adding content to review queue:', error);
      throw new AppError('Failed to add content to review queue', 500);
    }
  }

  /**
   * Get review queue items with filters
   */
  async getReviewQueue(
    adminId: string,
    filters: ReviewFilters = {}
  ): Promise<{
    reviewItems: ReviewQueueItem[];
    summary: ReviewMetrics;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasNext: boolean;
    };
  }> {
    try {
      let items = Array.from(this.reviewQueue.values());

      // Apply filters
      if (filters.status) {
        items = items.filter(item => item.status === filters.status);
      }
      if (filters.batchJobId) {
        items = items.filter(item => item.batchJobId === filters.batchJobId);
      }
      if (filters.priority) {
        const priorityMap = { low: 1, medium: 2, high: 3 };
        items = items.filter(item => item.priority >= priorityMap[filters.priority as keyof typeof priorityMap]);
      }

      // Sort by priority and creation date
      items.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.createdAt.getTime() - b.createdAt.getTime(); // Older first
      });

      const total = items.length;
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      const paginatedItems = items.slice(offset, offset + limit);

      // Calculate summary metrics
      const summary = this.calculateReviewMetrics(items);

      return {
        reviewItems: paginatedItems,
        summary,
        pagination: {
          total,
          limit,
          offset,
          hasNext: offset + limit < total
        }
      };
    } catch (error) {
      logger.error('Error getting review queue:', error);
      throw new AppError('Failed to get review queue', 500);
    }
  }

  /**
   * Approve single content
   */
  async approveContent(
    contentId: string,
    adminId: string,
    options: ApprovalOptions = { approve: true }
  ): Promise<ApprovalResult> {
    try {
      const reviewItem = this.findReviewItemByContentId(contentId);
      
      if (!reviewItem) {
        throw new AppError('Content not found in review queue', 404);
      }

      if (reviewItem.status === 'approved') {
        throw new AppError('Content already approved', 400);
      }

      // Apply edits if provided
      let finalContent = reviewItem.content;
      if (options.edits && Object.keys(options.edits).length > 0) {
        finalContent = await this.applyContentEdits(reviewItem.content, options.edits, adminId);
      }

      // Update review item
      reviewItem.status = 'approved';
      reviewItem.reviewedBy = adminId;
      reviewItem.reviewedAt = new Date();
      reviewItem.adminNotes = options.notes;
      reviewItem.qualityRating = options.qualityRating || (typeof reviewItem.qualityScore === 'number' ? reviewItem.qualityScore : reviewItem.qualityScore.overall || 0);
      reviewItem.content = finalContent;

      // Add to fine-tuning dataset
      await this.addToFineTuningDataset(finalContent, {
        qualityRating: reviewItem.qualityRating,
        adminApproved: true,
        approvedBy: adminId
      });

      logger.info(`Content approved: ${contentId} by admin ${adminId}`);

      return {
        success: true,
        contentId,
        message: 'Content approved successfully',
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt: reviewItem.reviewedAt,
        qualityRating: reviewItem.qualityRating,
        queuedForPublishing: options.autoPublish || false,
        addedToTrainingDataset: true
      };
    } catch (error) {
      logger.error(`Error approving content ${contentId}:`, error);
      throw error instanceof AppError ? error : new AppError('Failed to approve content', 500);
    }
  }

  /**
   * Reject content
   */
  async rejectContent(
    contentId: string,
    adminId: string,
    reason: string,
    options: { regenerate?: boolean } = {}
  ): Promise<ApprovalResult> {
    try {
      const reviewItem = this.findReviewItemByContentId(contentId);
      
      if (!reviewItem) {
        throw new AppError('Content not found in review queue', 404);
      }

      reviewItem.status = 'rejected';
      reviewItem.reviewedBy = adminId;
      reviewItem.reviewedAt = new Date();
      reviewItem.adminNotes = reason;

      logger.info(`Content rejected: ${contentId} by admin ${adminId}, reason: ${reason}`);

      return {
        success: true,
        contentId,
        status: 'rejected',
        reviewedBy: adminId,
        reviewedAt: reviewItem.reviewedAt,
        regenerationQueued: options.regenerate || false
      };
    } catch (error) {
      logger.error(`Error rejecting content ${contentId}:`, error);
      throw error instanceof AppError ? error : new AppError('Failed to reject content', 500);
    }
  }

  /**
   * Bulk approve/reject content
   */
  async bulkApprove(
    contentIds: string[],
    adminId: string,
    options: BulkApprovalOptions
  ): Promise<{
    successCount: number;
    errorCount: number;
    results: ApprovalResult[];
    errors: Array<{ contentId: string; error: string }>;
  }> {
    try {
      const results: ApprovalResult[] = [];
      const errors: Array<{ contentId: string; error: string }> = [];

      // Process in chunks to avoid overwhelming the system
      const concurrency = options.concurrency || 5;
      const chunks = this.chunkArray(contentIds, concurrency);

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (contentId) => {
          try {
            const result = await this.approveContent(contentId, adminId, {
              approve: true,
              autoPublish: options.autoPublish,
              qualityRating: options.defaultQualityRating || 4,
              notes: options.adminNotes
            });
            results.push(result);
          } catch (error) {
            errors.push({
              contentId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        });

        await Promise.all(chunkPromises);
        
        // Add delay between chunks to prevent rate limiting
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Bulk approval completed: ${results.length} successful, ${errors.length} errors`);

      return {
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors
      };
    } catch (error) {
      logger.error('Error in bulk approval:', error);
      throw new AppError('Failed to process bulk approval', 500);
    }
  }

  /**
   * Edit content in review queue
   */
  async editContent(
    contentId: string,
    adminId: string,
    edits: Record<string, any>
  ): Promise<{ success: boolean; content: GeneratedContent }> {
    try {
      const reviewItem = this.findReviewItemByContentId(contentId);
      
      if (!reviewItem) {
        throw new AppError('Content not found in review queue', 404);
      }

      const updatedContent = await this.applyContentEdits(reviewItem.content, edits, adminId);
      reviewItem.content = updatedContent;
      reviewItem.status = 'editing';
      reviewItem.lastEditedBy = adminId;
      reviewItem.lastEditedAt = new Date();

      // Recalculate quality score after edits
      const newQualityScore = await this.calculateQualityScore(updatedContent);
      reviewItem.qualityScore = newQualityScore;
      this.qualityScores.set(contentId, newQualityScore);

      logger.info(`Content edited: ${contentId} by admin ${adminId}`);

      return {
        success: true,
        content: updatedContent
      };
    } catch (error) {
      logger.error(`Error editing content ${contentId}:`, error);
      throw error instanceof AppError ? error : new AppError('Failed to edit content', 500);
    }
  }

  /**
   * Get approved content by ID
   */
  async getApprovedContent(contentId: string): Promise<GeneratedContent | null> {
    try {
      const reviewItem = this.findReviewItemByContentId(contentId);
      
      if (!reviewItem) {
        return null;
      }

      if (reviewItem.status !== 'approved' && reviewItem.status !== 'auto_approved') {
        return null;
      }

      return reviewItem.content;
    } catch (error) {
      logger.error(`Error getting approved content ${contentId}:`, error);
      throw new AppError('Failed to get approved content', 500);
    }
  }

  /**
   * Get review statistics
   */
  async getReviewStatistics(): Promise<ReviewMetrics> {
    try {
      const allItems = Array.from(this.reviewQueue.values());
      return this.calculateReviewMetrics(allItems);
    } catch (error) {
      logger.error('Error getting review statistics:', error);
      throw new AppError('Failed to get review statistics', 500);
    }
  }

  /**
   * Private helper methods
   */
  private findReviewItemByContentId(contentId: string): ReviewQueueItem | undefined {
    return Array.from(this.reviewQueue.values()).find(item => item.contentId === contentId);
  }

  private async calculateQualityScore(content: GeneratedContent): Promise<QualityScore> {
    let score = 0;
    const details: Record<string, number> = {};

    // Content length score (0-25 points)
    const wordCount = content.body.split(' ').length;
    if (wordCount >= 1000) {
      details.length = 25;
    } else if (wordCount >= 500) {
      details.length = 20;
    } else if (wordCount >= 300) {
      details.length = 15;
    } else {
      details.length = 10;
    }

    // Structure score (0-25 points)
    const hasHeadings = /^#{1,6}\s/m.test(content.body);
    const hasParagraphs = content.body.split('\n\n').length > 2;
    const hasIntroConclusion = content.body.includes('introduction') || content.body.includes('conclusion');
    
    if (hasHeadings && hasParagraphs && hasIntroConclusion) {
      details.structure = 25;
    } else if (hasHeadings && hasParagraphs) {
      details.structure = 20;
    } else if (hasParagraphs) {
      details.structure = 15;
    } else {
      details.structure = 10;
    }

    // SEO score (0-25 points)
    const seoScore = content.metadata?.seoScore || 0;
    details.seo = Math.min(seoScore / 4, 25); // Convert 0-100 to 0-25

    // Uniqueness score (0-25 points)
    const uniquenessScore = content.metadata?.uniquenessScore || 0;
    details.uniqueness = uniquenessScore * 25; // Convert 0-1 to 0-25

    const overall = Math.round(Object.values(details).reduce((sum, val) => sum + val, 0));

    return {
      overall: Math.min(overall, 100),
      details,
      calculatedAt: new Date()
    };
  }

  private generatePreview(content: GeneratedContent): string {
    const preview = content.body
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, 3)
      .join(' ')
      .substring(0, 200);
    
    return preview + (preview.length >= 200 ? '...' : '');
  }

  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.split(' ').length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  private async applyContentEdits(
    content: GeneratedContent,
    edits: Record<string, any>,
    adminId: string
  ): Promise<GeneratedContent> {
    const updatedContent = { ...content };
    const editHistory: ContentEdit[] = updatedContent.editHistory || [];

    // Apply edits
    Object.entries(edits).forEach(([field, newValue]) => {
      if (field in updatedContent && updatedContent[field as keyof GeneratedContent] !== newValue) {
        editHistory.push({
          field,
          oldValue: String(updatedContent[field as keyof GeneratedContent]),
          newValue: String(newValue),
          timestamp: new Date(),
          adminId
        });
        
        (updatedContent as any)[field] = newValue;
      }
    });

    updatedContent.editHistory = editHistory;
    return updatedContent;
  }

  private async addToFineTuningDataset(
    content: GeneratedContent,
    metadata: {
      qualityRating: number;
      adminApproved: boolean;
      approvedBy: string;
    }
  ): Promise<void> {
    // Implementation would save to fine-tuning dataset
    // For now, just log the action
    logger.info(`Added content ${content.id} to fine-tuning dataset with quality rating ${metadata.qualityRating}`);
  }

  private calculateReviewMetrics(items: ReviewQueueItem[]): ReviewMetrics {
    const total = items.length;
    const pending = items.filter(item => item.status === 'pending').length;
    const approved = items.filter(item => item.status === 'approved').length;
    const rejected = items.filter(item => item.status === 'rejected').length;
    const autoApproved = items.filter(item => item.autoApproved).length;

    const qualityScores = items.map(item => typeof item.qualityScore === 'number' ? item.qualityScore : item.qualityScore.overall || 0);
    const averageQualityScore = qualityScores.length > 0 
      ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
      : 0;

    const priorityCounts = {
      high: items.filter(item => item.priority >= 3).length,
      medium: items.filter(item => item.priority === 2).length,
      low: items.filter(item => item.priority === 1).length
    };

    return {
      totalPending: pending,
      totalApproved: approved,
      totalRejected: rejected,
      averageQualityScore,
      approvalRate: total > 0 ? Math.round((approved + autoApproved) / total * 100) : 0,
      averageReviewTime: 0, // Mock value
      totalItems: total,
      pendingReview: pending,
      approved,
      rejected,
      autoApproved,
      priorityCounts,
      averageReadTime: items.length > 0 
        ? Math.round(items.reduce((sum, item) => sum + (item.estimatedReadTime || 0), 0) / items.length)
        : 0
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
} 