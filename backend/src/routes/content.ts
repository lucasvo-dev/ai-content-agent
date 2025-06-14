import { Router } from 'express';
import { ContentController } from '@/controllers/ContentController';
import { authMiddleware } from '@/middleware/auth';

const router = Router();
const contentController = new ContentController();

// Health check endpoint (no auth required)
router.get('/health', contentController.getHealth.bind(contentController));

// All other routes require authentication
router.use(authMiddleware);

// Content search and analytics (must be before /:id routes)
router.get('/search', contentController.searchContent.bind(contentController));
router.get('/analytics', contentController.getContentAnalytics.bind(contentController));

// Get all content
router.get("/", contentController.getContent.bind(contentController));

// Create content
router.post("/", contentController.createContent.bind(contentController));

// Get content by ID
router.get("/:id", contentController.getContentById.bind(contentController));

// Update content
router.put("/:id", contentController.updateContent.bind(contentController));

// Delete content
router.delete("/:id", contentController.deleteContent.bind(contentController));

// Duplicate content
router.post("/:id/duplicate", contentController.duplicateContent.bind(contentController));

// Content specific operations
router.get('/:id/versions', contentController.getContentVersions.bind(contentController));

export default router; 