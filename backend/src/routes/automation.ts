import { Router } from 'express';
import { AutomationController } from '../controllers/AutomationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const automationController = new AutomationController();

// ===== AUTOMATION INITIALIZATION =====
router.post('/initialize', automationController.initializeServices);
router.get('/health', automationController.healthCheck);
router.get('/dashboard', automationController.getDashboardOverview);

// ===== LANGCHAIN SERVICES =====
// Deep content research
router.post('/research/conduct', automationController.conductResearch);

// RAG-powered content generation
router.post('/content/generate-rag', automationController.generateContentWithRAG);

// Automated content generation
router.post('/content/generate-automated', automationController.generateAutomatedContent);

// ===== VECTOR DATABASE SERVICES =====
// Semantic search
router.post('/vectordb/search', automationController.searchSimilarContent);

// Content uniqueness analysis
router.post('/vectordb/analyze-uniqueness', automationController.analyzeContentUniqueness);

// Content gap analysis
router.post('/vectordb/find-gaps', automationController.findContentGaps);

// Database statistics
router.get('/vectordb/stats', automationController.getVectorDBStats);

// ===== SCHEDULER SERVICES =====
// Schedule automation jobs
router.post('/scheduler/content-generation', automationController.scheduleContentGeneration);
router.post('/scheduler/content-publishing', automationController.scheduleContentPublishing);
router.post('/scheduler/performance-analysis', automationController.schedulePerformanceAnalysis);

// Job management
router.get('/scheduler/jobs', automationController.getScheduledJobs);
router.put('/scheduler/jobs/:jobId/toggle', automationController.toggleJob);
router.delete('/scheduler/jobs/:jobId', automationController.deleteJob);

// Performance metrics
router.get('/scheduler/metrics', automationController.getPerformanceMetrics);

export default router; 