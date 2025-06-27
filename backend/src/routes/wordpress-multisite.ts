import { Router } from 'express';
import { WordPressMultiSiteController } from '../controllers/WordPressMultiSiteController';

const router = Router();
const controller = new WordPressMultiSiteController();

// Site management routes
router.get('/sites', controller.getSites);
router.get('/sites/:siteId', controller.getSite);
router.put('/sites/:siteId', controller.updateSiteConfig);

// Connection testing
router.post('/test-connections', controller.testConnections);

// Publishing routes
router.post('/smart-publish', controller.smartPublish);
router.post('/cross-post', controller.crossPost);
router.post('/preview-routing', controller.previewRouting);

// Analytics and statistics
router.get('/stats', controller.getPublishingStats);
router.get('/routing-rules', controller.getRoutingRules);

// Bulk operations
router.post('/bulk', controller.bulkOperations);

// Health check
router.get('/health', controller.healthCheck);

export default router; 