import { Router } from 'express';
import { AIController } from '../controllers/AIController.js';
// import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const aiController = new AIController();

// Health check endpoint (no auth required)
router.get('/health', aiController.checkHealth.bind(aiController));

// Public endpoints (no auth required)
router.get('/models', aiController.getModels.bind(aiController));
router.get('/templates', aiController.getTemplates.bind(aiController));

// All other routes require authentication (disabled for development)
// router.use(authMiddleware);

// AI content generation
router.post('/generate', aiController.generateContent.bind(aiController));

// Content analysis
router.post('/analyze/:contentId', aiController.analyzeContent.bind(aiController));

// Content regeneration
router.post('/regenerate/:contentId', aiController.regenerateContent.bind(aiController));

// AI usage statistics
router.get('/stats', aiController.getStats.bind(aiController));

export default router; 