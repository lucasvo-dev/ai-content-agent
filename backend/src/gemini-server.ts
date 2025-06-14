// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import aiRoutes from './routes/ai.js';

console.log('🔧 Environment variables loaded');

console.log('🚀 Starting AI Content Agent server with Hybrid AI (OpenAI + Gemini)...');

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "localhost";

console.log(`📋 Configuration:`);
console.log(`   - PORT: ${PORT}`);
console.log(`   - HOST: ${HOST}`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV ?? "development"}`);
console.log(`   - AI Provider: Hybrid (OpenAI + Gemini)`);

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

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL
    : ["http://localhost:3000", "http://localhost:5173"],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10), // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());

console.log('✅ Middleware setup completed');

// Routes
console.log('🔧 Setting up routes...');

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  console.log('📞 Health endpoint called');
  res.json({
    success: true,
    message: 'AI Content Agent server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    status: 'healthy',
    aiProvider: 'Hybrid AI (OpenAI + Gemini)',
    cost: 'Intelligent cost optimization'
  });
});

// AI routes with Gemini integration
app.use('/api/v1/ai', aiRoutes);

// Test endpoint
app.get('/api/v1/test', (req, res) => {
  console.log('📞 Test endpoint called');
  res.json({
    success: true,
    message: 'AI Content Agent API Test - Hybrid AI Integration',
    timestamp: new Date().toISOString(),
    server: 'gemini-server',
    version: '1.0.0',
          aiProvider: {
        name: 'Hybrid AI System',
        models: ['OpenAI GPT-4 Turbo', 'Google Gemini Flash'],
        strategy: 'Intelligent provider selection',
        features: [
          'Premium quality with OpenAI',
          'Cost optimization with Gemini',
          'Intelligent complexity assessment',
          'Automatic fallback handling',
          'Multi-provider redundancy'
        ]
      },
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
        'Hybrid AI Content Generation',
        'Intelligent Provider Selection',
        'Cost Optimization',
        'Content Quality Analysis',
        'SEO Optimization',
        'Brand Voice Adaptation',
        'Multi-format Content Support',
        'Real-time System Monitoring'
      ]
  });
});

console.log('✅ Routes setup completed');

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Start server
async function startServer() {
  try {
    console.log('🔧 Starting server...');
    
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 AI Content Agent server running on http://${HOST}:${PORT}`);
      console.log(`📖 Health Check: http://${HOST}:${PORT}/api/v1/health`);
      console.log(`🤖 AI Health: http://${HOST}:${PORT}/api/v1/ai/health`);
      console.log(`🧪 Test Endpoint: http://${HOST}:${PORT}/api/v1/test`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
      console.log(`✅ Server is ready to accept connections!`);
      console.log(`🎯 AI Content Agent v1.0.0 - Powered by Hybrid AI (OpenAI + Gemini)!`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
}

// Start the server
console.log('🔧 Calling startServer...');
startServer(); 