import { Router } from 'express';
import { WordPressSiteController } from '../controllers/WordPressSiteController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const wpSiteController = new WordPressSiteController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// WordPress site management routes
router.post('/', wpSiteController.addSite);
router.get('/', wpSiteController.getUserSites);
router.get('/stats', wpSiteController.getSitesStats);
router.get('/available-for-publishing', wpSiteController.getAvailableSites);

// Site-specific routes
router.get('/:siteId', wpSiteController.getSite);
router.put('/:siteId', wpSiteController.updateSite);
router.delete('/:siteId', wpSiteController.deleteSite);
router.get('/:siteId/taxonomy', wpSiteController.getSiteTaxonomy);
router.post('/:siteId/test', wpSiteController.testSiteConnection);

// Utility routes
router.post('/test-connection', wpSiteController.testConnection);
router.post('/test-all', wpSiteController.testAllSites);

export default router; 