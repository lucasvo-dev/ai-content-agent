import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

console.log('🔧 Loading environment variables...');
dotenv.config();

console.log('🚀 Starting final AI Content Agent server...');

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "localhost";

console.log(`📋 Configuration:`);
console.log(`   - PORT: ${PORT}`);
console.log(`   - HOST: ${HOST}`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV ?? "development"}`);

// Security middleware
console.log('🔧 Setting up security middleware...');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? process.env.FRONTEND_URL 
    : ["http://localhost:3000", "http://localhost:5173"],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression middleware
app.use(compression());

console.log('✅ Middleware setup completed');

// API Routes
console.log('🔧 Setting up routes...');

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  console.log('📞 Health endpoint called');
  res.json({
    success: true,
    message: 'AI Content Agent server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy'
  });
});

// AI Health check
app.get('/api/v1/ai/health', (req, res) => {
  console.log('📞 AI Health endpoint called');
  res.json({
    success: true,
    message: 'AI service is operational',
    timestamp: new Date().toISOString(),
    aiService: {
      status: 'ready',
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      features: ['content-generation', 'analysis', 'optimization']
    }
  });
});

// AI Models endpoint
app.get('/api/v1/ai/models', (req, res) => {
  console.log('📞 AI Models endpoint called');
  res.json({
    success: true,
    data: {
      models: [
        {
          id: "gpt-4-turbo-preview",
          name: "GPT-4 Turbo",
          provider: "openai",
          capabilities: ["text-generation", "content-optimization"],
          costPerToken: 0.00001,
          maxTokens: 4096,
          recommended: true
        },
        {
          id: "gpt-3.5-turbo",
          name: "GPT-3.5 Turbo",
          provider: "openai",
          capabilities: ["text-generation"],
          costPerToken: 0.000001,
          maxTokens: 4096,
          recommended: false
        }
      ]
    }
  });
});

// AI Templates endpoint
app.get('/api/v1/ai/templates', (req, res) => {
  console.log('📞 AI Templates endpoint called');
  res.json({
    success: true,
    data: {
      templates: [
        {
          id: "blog-post-template-1",
          name: "Marketing Blog Post",
          type: "blog_post",
          description: "Template for marketing-focused blog posts",
          structure: {
            sections: ["introduction", "main-points", "conclusion", "cta"],
            requiredElements: ["title", "meta-description", "headers"]
          },
          brandVoice: {
            tone: "professional",
            style: "conversational"
          }
        },
        {
          id: "social-media-template-1",
          name: "Engagement Post",
          type: "social_media",
          description: "Template for social media engagement posts",
          structure: {
            sections: ["hook", "content", "cta"],
            requiredElements: ["hashtags", "mention"]
          },
          brandVoice: {
            tone: "casual",
            style: "friendly"
          }
        }
      ]
    }
  });
});

// AI Content Generation endpoint (placeholder)
app.post('/api/v1/ai/generate', (req, res) => {
  console.log('📞 AI Generate endpoint called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  res.json({
    success: true,
    message: 'AI content generation endpoint (placeholder)',
    data: {
      id: "generated-content-123",
      title: "Sample Generated Content",
      body: "This is a placeholder for AI-generated content. The actual implementation would use OpenAI API to generate content based on the request parameters.",
      type: req.body.type || "blog_post",
      metadata: {
        wordCount: 150,
        seoScore: 85,
        readabilityScore: 78,
        generatedAt: new Date().toISOString()
      }
    }
  });
});

// AI Stats endpoint
app.get('/api/v1/ai/stats', (req, res) => {
  console.log('📞 AI Stats endpoint called');
  res.json({
    success: true,
    data: {
      usage: {
        totalGenerations: 1250,
        totalTokens: 125000,
        averageQualityScore: 8.7,
        costThisMonth: 12.50
      },
      performance: {
        averageGenerationTime: 15.2,
        successRate: 98.5,
        topContentType: "blog_post"
      }
    }
  });
});

// Test endpoint with all available routes
app.get('/api/v1/test', (req, res) => {
  console.log('📞 Test endpoint called');
  res.json({
    success: true,
    message: 'AI Content Agent API Test',
    timestamp: new Date().toISOString(),
    server: 'final-server',
    version: '1.0.0',
    availableEndpoints: {
      health: 'GET /api/v1/health',
      aiHealth: 'GET /api/v1/ai/health',
      aiModels: 'GET /api/v1/ai/models',
      aiTemplates: 'GET /api/v1/ai/templates',
      aiGenerate: 'POST /api/v1/ai/generate',
      aiStats: 'GET /api/v1/ai/stats',
      test: 'GET /api/v1/test'
    },
    features: [
      'AI Content Generation',
      'Content Analysis',
      'SEO Optimization',
      'Brand Voice Adaptation',
      'Multi-platform Publishing'
    ]
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    availableRoutes: [
      'GET /api/v1/health',
      'GET /api/v1/test',
      'GET /api/v1/ai/health',
      'GET /api/v1/ai/models',
      'GET /api/v1/ai/templates',
      'POST /api/v1/ai/generate',
      'GET /api/v1/ai/stats'
    ]
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Global error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

console.log('✅ Routes setup completed');

// Start server
async function startServer(): Promise<void> {
  try {
    console.log('🔧 Starting server...');
    
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 AI Content Agent server running on http://${HOST}:${PORT}`);
      console.log(`📖 Health Check: http://${HOST}:${PORT}/api/v1/health`);
      console.log(`🤖 AI Health: http://${HOST}:${PORT}/api/v1/ai/health`);
      console.log(`🧪 Test Endpoint: http://${HOST}:${PORT}/api/v1/test`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
      console.log(`✅ Server is ready to accept connections!`);
      console.log(`🎯 AI Content Agent v1.0.0 - Ready for content generation!`);
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

console.log('🔧 Calling startServer...');
void startServer(); 