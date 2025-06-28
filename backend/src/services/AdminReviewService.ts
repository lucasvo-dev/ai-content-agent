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

export interface ReviewItem {
  id?: string;
  content: {
    id: string;
    title: string;
    body: string;
    excerpt: string;
    type: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
    metadata: {
      keywords: string[];
      seoTitle: string;
      seoDescription: string;
      qualityScore: number;
    };
  };
  qualityScore: number;
  aiProvider: string;
  autoApproved: boolean;
  sourceReference: {
    url: string;
    title: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  reviewNotes?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface ReviewQueueOptions {
  limit?: number;
  qualityScoreMin?: number;
  status?: ReviewItem['status'];
  autoApprovedOnly?: boolean;
}

export class AdminReviewService {
  private reviewQueue: ReviewItem[] = [];
  private approvedContent: ReviewItem[] = [];
  private qualityScores: Map<string, QualityScore> = new Map();
  private settings: ReviewQueueSettings = {
    autoApprovalThreshold: 85,
    maxPendingItems: 100,
    defaultReviewTimeout: 24
  };

  constructor() {
    logger.info('📋 AdminReviewService initialized');
  }

  /**
   * Add content to review queue
   */
  async addToReviewQueue(item: Omit<ReviewItem, 'id' | 'submittedAt' | 'status'>): Promise<string> {
    const reviewItem: ReviewItem = {
      ...item,
      id: uuidv4(),
      status: item.autoApproved ? 'approved' : 'pending',
      submittedAt: new Date()
    };

    if (item.autoApproved) {
      this.approvedContent.push(reviewItem);
      logger.info(`✅ Content auto-approved: ${reviewItem.content.title}`, {
        id: reviewItem.id,
        qualityScore: reviewItem.qualityScore
      });
    } else {
      this.reviewQueue.push(reviewItem);
      logger.info(`📝 Content added to review queue: ${reviewItem.content.title}`, {
        id: reviewItem.id,
        qualityScore: reviewItem.qualityScore
      });
    }

    return reviewItem.id!;
  }

  /**
   * Get approved content for publishing
   */
  async getApprovedContent(options: ReviewQueueOptions = {}): Promise<{
    items: ReviewItem[];
    totalCount: number;
  }> {
    let filtered = this.approvedContent.filter(item => item.status === 'approved');

    // Apply filters
    if (options.qualityScoreMin) {
      filtered = filtered.filter(item => item.qualityScore >= options.qualityScoreMin!);
    }

    if (options.autoApprovedOnly) {
      filtered = filtered.filter(item => item.autoApproved);
    }

    // Sort by quality score descending
    filtered.sort((a, b) => b.qualityScore - a.qualityScore);

    // Apply limit
    const items = options.limit ? filtered.slice(0, options.limit) : filtered;

    return {
      items,
      totalCount: filtered.length
    };
  }

  /**
   * Get pending review items
   */
  async getPendingReview(options: ReviewQueueOptions = {}): Promise<{
    items: ReviewItem[];
    totalCount: number;
  }> {
    let filtered = this.reviewQueue.filter(item => item.status === 'pending');

    // Apply filters
    if (options.qualityScoreMin) {
      filtered = filtered.filter(item => item.qualityScore >= options.qualityScoreMin!);
    }

    // Sort by quality score descending, then by submitted date
    filtered.sort((a, b) => {
      if (a.qualityScore !== b.qualityScore) {
        return b.qualityScore - a.qualityScore;
      }
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });

    // Apply limit
    const items = options.limit ? filtered.slice(0, options.limit) : filtered;

    return {
      items,
      totalCount: filtered.length
    };
  }

  /**
   * Approve content item
   */
  async approveContent(itemId: string, reviewedBy: string, notes?: string): Promise<boolean> {
    const itemIndex = this.reviewQueue.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      logger.warn(`Review item not found: ${itemId}`);
      return false;
    }

    const item = this.reviewQueue[itemIndex];
    item.status = 'approved';
    item.reviewedAt = new Date();
    item.reviewedBy = reviewedBy;
    item.reviewNotes = notes;

    // Move to approved content
    this.approvedContent.push(item);
    this.reviewQueue.splice(itemIndex, 1);

    logger.info(`✅ Content approved: ${item.content.title}`, {
      id: itemId,
      reviewedBy,
      qualityScore: item.qualityScore
    });

    return true;
  }

  /**
   * Reject content item
   */
  async rejectContent(itemId: string, reviewedBy: string, reason: string): Promise<boolean> {
    const itemIndex = this.reviewQueue.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      logger.warn(`Review item not found: ${itemId}`);
      return false;
    }

    const item = this.reviewQueue[itemIndex];
    item.status = 'rejected';
    item.reviewedAt = new Date();
    item.reviewedBy = reviewedBy;
    item.reviewNotes = reason;

    logger.info(`❌ Content rejected: ${item.content.title}`, {
      id: itemId,
      reviewedBy,
      reason
    });

    return true;
  }

  /**
   * Request revision for content item
   */
  async requestRevision(itemId: string, reviewedBy: string, revisionNotes: string): Promise<boolean> {
    const itemIndex = this.reviewQueue.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      logger.warn(`Review item not found: ${itemId}`);
      return false;
    }

    const item = this.reviewQueue[itemIndex];
    item.status = 'needs_revision';
    item.reviewedAt = new Date();
    item.reviewedBy = reviewedBy;
    item.reviewNotes = revisionNotes;

    logger.info(`🔄 Revision requested: ${item.content.title}`, {
      id: itemId,
      reviewedBy,
      notes: revisionNotes
    });

    return true;
  }

  /**
   * Update content after revision
   */
  async updateContent(
    itemId: string,
    updatedContent: Partial<ReviewItem['content']>
  ): Promise<boolean> {
    const item = this.reviewQueue.find(item => item.id === itemId);
    
    if (!item || item.status !== 'needs_revision') {
      logger.warn(`Review item not found or not in revision status: ${itemId}`);
      return false;
    }

    // Update content
    Object.assign(item.content, updatedContent);
    item.status = 'pending';
    item.submittedAt = new Date(); // Reset submission time

    logger.info(`📝 Content updated after revision: ${item.content.title}`, {
      id: itemId
    });

    return true;
  }

  /**
   * Get review statistics
   */
  getReviewStats(): {
    pending: number;
    approved: number;
    rejected: number;
    needsRevision: number;
    avgQualityScore: number;
    avgReviewTime: number; // in minutes
  } {
    const pending = this.reviewQueue.filter(item => item.status === 'pending').length;
    const approved = this.reviewQueue.filter(item => item.status === 'approved').length + this.approvedContent.length;
    const rejected = this.reviewQueue.filter(item => item.status === 'rejected').length;
    const needsRevision = this.reviewQueue.filter(item => item.status === 'needs_revision').length;

    const allItems = [...this.reviewQueue, ...this.approvedContent];
    const avgQualityScore = allItems.length > 0
      ? allItems.reduce((sum, item) => sum + item.qualityScore, 0) / allItems.length
      : 0;

    // Calculate average review time for reviewed items
    const reviewedItems = allItems.filter(item => item.reviewedAt);
    const avgReviewTime = reviewedItems.length > 0
      ? reviewedItems.reduce((sum, item) => {
          const reviewTime = item.reviewedAt!.getTime() - item.submittedAt.getTime();
          return sum + (reviewTime / 1000 / 60); // Convert to minutes
        }, 0) / reviewedItems.length
      : 0;

    return {
      pending,
      approved,
      rejected,
      needsRevision,
      avgQualityScore,
      avgReviewTime
    };
  }

  /**
   * Get review item by ID
   */
  async getReviewItem(itemId: string): Promise<ReviewItem | null> {
    const queueItem = this.reviewQueue.find(item => item.id === itemId);
    if (queueItem) return queueItem;

    const approvedItem = this.approvedContent.find(item => item.id === itemId);
    return approvedItem || null;
  }

  /**
   * Clean up old items (older than 30 days)
   */
  async cleanupOldItems(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const initialQueueLength = this.reviewQueue.length;
    const initialApprovedLength = this.approvedContent.length;

    this.reviewQueue = this.reviewQueue.filter(item => 
      item.status === 'pending' || item.submittedAt >= thirtyDaysAgo
    );

    this.approvedContent = this.approvedContent.filter(item =>
      item.submittedAt >= thirtyDaysAgo
    );

    const cleanedCount = (initialQueueLength - this.reviewQueue.length) + 
                        (initialApprovedLength - this.approvedContent.length);

    if (cleanedCount > 0) {
      logger.info(`🧹 Cleaned up ${cleanedCount} old review items`);
    }

    return cleanedCount;
  }

  /**
   * Private helper methods
   */
  private findReviewItemByContentId(contentId: string): ReviewItem | undefined {
    return this.reviewQueue.find(item => item.content.id === contentId);
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

  private calculateReviewMetrics(items: ReviewItem[]): ReviewMetrics {
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