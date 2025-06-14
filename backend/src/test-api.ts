import express from 'express';
import cors from 'cors';
import { ProjectController } from './controllers/ProjectController';
import { ContentController } from './controllers/ContentController';

const app = express();
const PORT = 3002;

// Basic middleware
app.use(cors());
app.use(express.json());

// Test endpoints without authentication
const projectController = new ProjectController();
const contentController = new ContentController();

// Health checks
app.get('/api/v1/projects/health', projectController.getHealth.bind(projectController));
app.get('/api/v1/content/health', contentController.getHealth.bind(contentController));

// Basic info endpoint
app.get('/api/v1/info', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'AI Content Agent API',
      version: '1.0.0',
      endpoints: {
        projects: '/api/v1/projects/health',
        content: '/api/v1/content/health'
      },
      timestamp: new Date().toISOString()
    },
    message: 'API is running successfully'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test API Server running on http://localhost:${PORT}`);
  console.log(`📖 Test endpoints:`);
  console.log(`   - http://localhost:${PORT}/api/v1/info`);
  console.log(`   - http://localhost:${PORT}/api/v1/projects/health`);
  console.log(`   - http://localhost:${PORT}/api/v1/content/health`);
});

export default app; 