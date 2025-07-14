import { Router } from 'express';
import { PhotoGalleryService } from '../services/PhotoGalleryService';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = Router();
const photoGalleryService = new PhotoGalleryService();

/**
 * GET /api/v1/image-usage/stats
 * Get image usage statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = photoGalleryService.getUsageStats();
  
  res.json({
    success: true,
    data: stats,
    message: 'Image usage statistics retrieved successfully'
  });
}));

/**
 * GET /api/v1/image-usage/recent/:category?
 * Get recently used images for a category
 */
router.get('/recent/:category?', asyncHandler(async (req, res) => {
  const category = req.params.category || 'general';
  const limit = parseInt(req.query.limit as string) || 20;
  
  const recentImages = photoGalleryService.getRecentlyUsedImages(category, limit);
  
  res.json({
    success: true,
    data: {
      category,
      images: recentImages,
      count: recentImages.length
    },
    message: `Recently used images for category "${category}" retrieved successfully`
  });
}));

/**
 * POST /api/v1/image-usage/clear
 * Clear image usage history (for development/testing)
 */
router.post('/clear', asyncHandler(async (req, res) => {
  logger.info('🗑️ Clearing image usage history (admin request)');
  
  photoGalleryService.clearUsageHistory();
  
  res.json({
    success: true,
    message: 'Image usage history cleared successfully'
  });
}));

/**
 * GET /api/v1/image-usage/health
 * Health check for image usage tracking
 */
router.get('/health', asyncHandler(async (req, res) => {
  const stats = photoGalleryService.getUsageStats();
  
  res.json({
    success: true,
    data: {
      tracking: 'active',
      memoryUsage: stats.totalTracked,
      recentlyUsed: stats.recentlyUsed,
      categories: stats.categoriesUsed.length,
      status: stats.totalTracked > 0 ? 'tracking' : 'initialized'
    },
    message: 'Image usage tracking is healthy'
  });
}));

export default router; 