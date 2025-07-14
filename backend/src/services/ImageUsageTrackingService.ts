import { logger } from '../utils/logger';

interface UsageEntry {
  imageId: string | number;
  imagePath: string;
  usedAt: Date;
  contentTopic: string;
  category: string;
}

export class ImageUsageTrackingService {
  private usedImages: Map<string, UsageEntry> = new Map();
  private readonly MAX_USAGE_HISTORY = 1000; // Keep track of last 1000 used images
  private readonly COOLDOWN_HOURS = 24; // Don't reuse images for 24 hours
  
  constructor() {
    this.loadUsageHistory();
    
    // Clean up old entries periodically
    setInterval(() => {
      this.cleanupOldEntries();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Mark images as used for a specific content generation
   */
  markImagesAsUsed(
    images: Array<{ id: string | number; image_path: string }>, 
    contentTopic: string, 
    category: string = 'general'
  ): void {
    const now = new Date();
    
    for (const image of images) {
      const key = this.getImageKey(image.id, image.image_path);
      
      const entry: UsageEntry = {
        imageId: image.id,
        imagePath: image.image_path,
        usedAt: now,
        contentTopic,
        category
      };
      
      this.usedImages.set(key, entry);
      
      logger.info(`📝 Marked image as used: ${image.image_path} (topic: ${contentTopic})`);
    }
    
    // Limit memory usage
    if (this.usedImages.size > this.MAX_USAGE_HISTORY) {
      this.cleanupOldEntries();
    }
    
    this.saveUsageHistory();
  }

  /**
   * Filter out recently used images from a list
   */
  filterUnusedImages<T extends { id: string | number; image_path: string }>(
    images: T[], 
    category: string = 'general',
    forceMinimum: number = 3
  ): T[] {
    const now = new Date();
    const cooldownMs = this.COOLDOWN_HOURS * 60 * 60 * 1000;
    
    // Filter out recently used images
    const unusedImages = images.filter(image => {
      const key = this.getImageKey(image.id, image.image_path);
      const usage = this.usedImages.get(key);
      
      if (!usage) {
        return true; // Never used
      }
      
      const timeSinceUsed = now.getTime() - usage.usedAt.getTime();
      const isExpired = timeSinceUsed >= cooldownMs;
      
      if (!isExpired) {
        logger.info(`⏰ Skipping recently used image: ${image.image_path} (used ${Math.round(timeSinceUsed / (60 * 60 * 1000))}h ago)`);
      }
      
      return isExpired;
    });
    
    // If we filtered out too many images, include some recent ones to ensure variety
    if (unusedImages.length < forceMinimum && images.length >= forceMinimum) {
      logger.warn(`⚠️ Only ${unusedImages.length} unused images available, including some recent ones for variety`);
      
      // Sort images by usage date (oldest first) and add them back
      const recentImages = images
        .filter(image => !unusedImages.includes(image))
        .sort((a, b) => {
          const keyA = this.getImageKey(a.id, a.image_path);
          const keyB = this.getImageKey(b.id, b.image_path);
          const usageA = this.usedImages.get(keyA);
          const usageB = this.usedImages.get(keyB);
          
          if (!usageA) return -1;
          if (!usageB) return 1;
          
          return usageA.usedAt.getTime() - usageB.usedAt.getTime();
        });
      
      const neededCount = forceMinimum - unusedImages.length;
      unusedImages.push(...recentImages.slice(0, neededCount));
      
      logger.info(`📸 Added ${neededCount} older images for variety. Total: ${unusedImages.length}`);
    }
    
    logger.info(`🎲 Filtered images: ${images.length} → ${unusedImages.length} unused (category: ${category})`);
    return unusedImages;
  }

  /**
   * Get usage statistics for debugging
   */
  getUsageStats(): {
    totalTracked: number;
    recentlyUsed: number;
    categoriesUsed: string[];
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const now = new Date();
    const cooldownMs = this.COOLDOWN_HOURS * 60 * 60 * 1000;
    
    const entries = Array.from(this.usedImages.values());
    const recentEntries = entries.filter(entry => 
      (now.getTime() - entry.usedAt.getTime()) < cooldownMs
    );
    
    const categories = Array.from(new Set(entries.map(entry => entry.category)));
    
    const dates = entries.map(entry => entry.usedAt);
    const oldestEntry = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const newestEntry = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    
    return {
      totalTracked: this.usedImages.size,
      recentlyUsed: recentEntries.length,
      categoriesUsed: categories,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Reset usage tracking (for development/testing)
   */
  clearUsageHistory(): void {
    this.usedImages.clear();
    this.saveUsageHistory();
    logger.info('🗑️ Cleared all image usage history');
  }

  /**
   * Get recently used images for a specific category
   */
  getRecentlyUsedImages(category: string = 'general', limit: number = 10): UsageEntry[] {
    const categoryEntries = Array.from(this.usedImages.values())
      .filter(entry => entry.category === category)
      .sort((a, b) => b.usedAt.getTime() - a.usedAt.getTime())
      .slice(0, limit);
    
    return categoryEntries;
  }

  private getImageKey(id: string | number, imagePath: string): string {
    // Use both ID and path for robust tracking
    return `${id}:${imagePath}`;
  }

  private cleanupOldEntries(): void {
    const now = new Date();
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    let removedCount = 0;
    
    for (const [key, entry] of this.usedImages.entries()) {
      const age = now.getTime() - entry.usedAt.getTime();
      
      if (age > maxAgeMs) {
        this.usedImages.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.info(`🧹 Cleaned up ${removedCount} old image usage entries (older than 7 days)`);
      this.saveUsageHistory();
    }
  }

  private loadUsageHistory(): void {
    try {
      // In production, this would load from database or persistent storage
      // For now, we'll use memory-only tracking
      logger.info('📚 Image usage tracking service initialized (memory-only)');
    } catch (error) {
      logger.warn('⚠️ Failed to load usage history, starting fresh:', error);
    }
  }

  private saveUsageHistory(): void {
    try {
      // In production, this would save to database or persistent storage
      // For now, we'll just log the stats
      const stats = this.getUsageStats();
      logger.info('💾 Usage stats:', {
        totalTracked: stats.totalTracked,
        recentlyUsed: stats.recentlyUsed,
        categories: stats.categoriesUsed.join(', ')
      });
    } catch (error) {
      logger.warn('⚠️ Failed to save usage history:', error);
    }
  }
} 