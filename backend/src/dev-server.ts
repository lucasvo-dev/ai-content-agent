// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { HybridAIService } from './services/HybridAIService.js';
import { LinkContentController } from './controllers/LinkContentController.js';
import type { ContentGenerationRequest } from './types/content.js';

const app = express();
const PORT = 3001;

// CORS configuration
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
  credentials: true,
}));

app.use(express.json());

// Initialize services
const aiService = new HybridAIService();
const linkContentController = new LinkContentController();

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: '1.0.0',
    environment: 'development'
  });
});

// AI health check endpoint
app.get('/api/v1/ai/health', async (req, res) => {
  try {
    const availableProviders = aiService.getAvailableProviders();
    const stats = await aiService.getUsageStats();
    
    res.json({
      success: true,
      aiService: {
        status: 'ready',
        currentProvider: 'hybrid',
        availableProviders: availableProviders,
        strategy: 'Intelligent cost optimization',
        limits: {
          requestsPerMinute: 60,
          requestsPerDay: 1000
        }
      },
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'AI service health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// AI models endpoint
app.get('/api/v1/ai/models', (req, res) => {
  const availableProviders = aiService.getAvailableProviders();
  
  const models = [];
  
  // Check if OpenAI is available
  const hasOpenAI = availableProviders.some(p => p.provider === 'openai' && p.available);
  if (hasOpenAI) {
    models.push({
      id: 'gpt-4-turbo-preview',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      status: 'available',
      cost: '$0.01-0.03 per generation',
      description: 'Premium quality, best for complex content'
    });
  }
  
  // Check if Gemini is available
  const hasGemini = availableProviders.some(p => p.provider === 'gemini' && p.available);
  if (hasGemini) {
    models.push({
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'gemini',
      status: 'available',
      cost: 'Free (1,500 requests/day)',
      description: 'Fast generation, good for simple content'
    });
  }

  res.json({
    success: true,
    data: {
      models
    }
  });
});

// AI templates endpoint
app.get('/api/v1/ai/templates', (req, res) => {
  const templates = [
    {
      id: 'blog-post-template',
      name: 'Blog Post Template',
      type: 'blog_post',
      description: 'Professional blog post with SEO optimization'
    },
    {
      id: 'social-media-template',
      name: 'Social Media Template',
      type: 'social_media',
      description: 'Engaging social media content'
    },
    {
      id: 'email-template',
      name: 'Email Template',
      type: 'email',
      description: 'Professional email content'
    }
  ];

  res.json({
    success: true,
    data: {
      templates
    }
  });
});

// AI content generation endpoint
app.post('/api/v1/ai/generate', async (req, res) => {
  try {
    const request: ContentGenerationRequest = req.body;
    
    console.log('🎯 Content generation request:', {
      type: request.type,
      topic: request.topic,
      provider: request.preferredProvider || 'auto'
    });

    const content = await aiService.generateContent(request);
    
    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('❌ Content generation failed:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Content generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// AI stats endpoint
app.get('/api/v1/ai/stats', async (req, res) => {
  try {
    const stats = await aiService.getUsageStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch AI stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Link-based content endpoints
app.post('/api/v1/link-content/batch', linkContentController.createBatchJob);
app.get('/api/v1/link-content/batch/:jobId', linkContentController.getBatchJobStatus);
app.post('/api/v1/link-content/batch/:jobId/crawl', linkContentController.startCrawling);
app.post('/api/v1/link-content/batch/:jobId/generate', linkContentController.generateContent);
app.post('/api/v1/link-content/batch/:jobId/items/:itemId/approve', linkContentController.approveContentItem);
app.post('/api/v1/link-content/batch/:jobId/items/:itemId/regenerate', linkContentController.regenerateContent);
app.get('/api/v1/link-content/batch/:jobId/approved', linkContentController.getApprovedContent);
app.post('/api/v1/link-content/test-scrape', linkContentController.testScrape);
app.get('/api/v1/link-content/health', linkContentController.healthCheck);

// WordPress sites endpoints - Mock data for development
app.get('/api/v1/wordpress-sites/available-for-publishing', (req, res) => {
  res.json({
    success: true,
    data: {
      sites: [
        {
          id: 'site_1',
          name: 'My WordPress Blog',
          url: 'https://myblog.com',
          isActive: true,
          lastTested: new Date().toISOString()
        },
        {
          id: 'site_2',
          name: 'Tech News Site',
          url: 'https://technews.example.com',
          isActive: true,
          lastTested: new Date().toISOString()
        }
      ]
    },
    message: 'Mock WordPress sites for development'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Development server running on http://localhost:${PORT}`);
  console.log(`📖 Health check: http://localhost:${PORT}/api/v1/health`);
  console.log(`🤖 AI health: http://localhost:${PORT}/api/v1/ai/health`);
  const providers = aiService.getAvailableProviders();
  console.log(`🧠 Available providers: ${providers.map(p => p.provider).join(', ')}`);
}); 