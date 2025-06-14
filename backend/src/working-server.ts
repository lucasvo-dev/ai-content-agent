import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

console.log('🔧 Loading environment variables...');
dotenv.config();

console.log('🚀 Starting working server...');

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "localhost";

console.log(`📋 Configuration:`);
console.log(`   - PORT: ${PORT}`);
console.log(`   - HOST: ${HOST}`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV ?? "development"}`);

// Basic middleware
console.log('🔧 Setting up middleware...');

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

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());

console.log('✅ Middleware setup completed');

// Simple routes
app.get('/api/v1/health', (req, res) => {
  console.log('📞 Health endpoint called');
  res.json({
    success: true,
    message: 'Working server is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? "development"
  });
});

app.get('/api/v1/test', (req, res) => {
  console.log('📞 Test endpoint called');
  res.json({
    success: true,
    message: 'Test endpoint working',
    server: 'working-server'
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    console.log('🔧 Starting server...');
    
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Working server running on http://${HOST}:${PORT}`);
      console.log(`📖 API Documentation: http://${HOST}:${PORT}/api/v1/health`);
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

console.log('🔧 Calling startServer...');
void startServer(); 