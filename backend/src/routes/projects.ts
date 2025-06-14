import { Router } from 'express';
import { ProjectController } from '@/controllers/ProjectController';
import { authMiddleware } from '@/middleware/auth';

const router = Router();
const projectController = new ProjectController();

// Health check endpoint (no auth required)
router.get('/health', projectController.getHealth.bind(projectController));

// All other routes require authentication
router.use(authMiddleware);

// Project CRUD operations
router.post('/', projectController.createProject.bind(projectController));
router.get('/', projectController.getProjects.bind(projectController));
router.get('/:id', projectController.getProjectById.bind(projectController));
router.put('/:id', projectController.updateProject.bind(projectController));
router.delete('/:id', projectController.deleteProject.bind(projectController));

// Project member management
router.post('/:id/members', projectController.addProjectMember.bind(projectController));
router.delete('/:id/members/:userId', projectController.removeProjectMember.bind(projectController));

// Project statistics
router.get('/:id/stats', projectController.getProjectStats.bind(projectController));

export default router; 