import { Router } from 'express';
// import { AutomationController } from '../controllers/AutomationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
// const automationController = new AutomationController();

// Temporarily disabled all automation routes due to dependency issues

// Placeholder endpoint
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Automation services are temporarily disabled',
    status: 'disabled'
  });
});

export default router; 