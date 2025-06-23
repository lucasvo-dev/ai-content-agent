import { Router } from 'express';
import { LinkContentController } from '../controllers/LinkContentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const linkContentController = new LinkContentController();

// Apply authentication middleware to all routes (disabled for development)
// router.use(authMiddleware);

// Batch Job Management
router.post('/batch', authMiddleware, linkContentController.createBatchJob);
router.get('/batch/:jobId', authMiddleware, linkContentController.getBatchJobStatus);

// Batch Job Operations
router.post('/batch/:jobId/crawl', authMiddleware, linkContentController.startCrawling);
router.post('/batch/:jobId/generate', authMiddleware, linkContentController.generateContent);
router.post('/batch/:jobId/generate-content', authMiddleware, linkContentController.generateBatchContent);

// Content Item Management
router.post('/batch/:jobId/items/:itemId/approve', authMiddleware, linkContentController.approveContentItem);
router.post('/batch/:jobId/items/:itemId/regenerate', authMiddleware, linkContentController.regenerateContent);

// Content Retrieval
router.get('/batch/:jobId/approved', authMiddleware, linkContentController.getApprovedContent);

// Testing & Health Check
router.post('/test-scrape', linkContentController.testScrape);
router.get('/health', linkContentController.healthCheck);

// Removed unused endpoints

export default router; 