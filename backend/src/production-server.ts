import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

// Import routes
import healthRoutes from "./routes/health";
import aiRoutes from "./routes/ai";
import linkContentRoutes from "./routes/link-content";
import wordPressMultiSiteRoutes from "./routes/wordpress-multisite";

console.log('🔧 Loading environment variables...');
dotenv.config();

console.log('🚀 Starting production-ready server...');

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
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10), // limit each IP to 100 requests per windowMs
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

// Health check endpoint (before auth)
app.use("/api/v1/health", healthRoutes);

// AI routes (with built-in auth where needed)
app.use("/api/v1/ai", aiRoutes);

// Link-based content routes
app.use("/api/v1/link-content", linkContentRoutes);

// WordPress Multi-Site routes
app.use("/api/v1/wordpress-multisite", wordPressMultiSiteRoutes);

// Basic test endpoint
app.get('/api/v1/test', (req, res) => {
  console.log('📞 Test endpoint called');
  res.json({
    success: true,
    message: 'Production server test endpoint',
    timestamp: new Date().toISOString(),
    server: 'production-server',
    endpoints: [
      'GET /api/v1/health',
      'GET /api/v1/test',
      'GET /api/v1/ai/health',
      'GET /api/v1/ai/models',
      'GET /api/v1/ai/templates',
      'POST /api/v1/ai/generate',
      'POST /api/v1/ai/analyze/:contentId',
      'GET /api/v1/ai/stats',
      'POST /api/v1/ai/regenerate/:contentId',
      'GET /api/v1/link-content/health',
      'POST /api/v1/link-content/test-scrape',
      'POST /api/v1/link-content/generate-enhanced',
      'GET /api/v1/wordpress-multisite/sites',
      'POST /api/v1/wordpress-multisite/smart-publish',
      'GET /api/v1/wordpress-multisite/health'
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
      '/api/v1/health',
      '/api/v1/test',
      '/api/v1/ai/*',
      '/api/v1/link-content/*',
      '/api/v1/wordpress-multisite/*'
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
      console.log(`🚀 Production server running on http://${HOST}:${PORT}`);
      console.log(`📖 Health Check: http://${HOST}:${PORT}/api/v1/health`);
      console.log(`🤖 AI Endpoints: http://${HOST}:${PORT}/api/v1/ai/health`);
      console.log(`🧪 Test Endpoint: http://${HOST}:${PORT}/api/v1/test`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
      console.log(`✅ Server is ready to accept connections!`);
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

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

console.log('🔧 Calling startServer...');
void startServer(); 