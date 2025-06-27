// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import session from "express-session";
import passport from "@/config/passport";

import { errorHandler } from "@/middleware/errorHandler";
import { requestLogger } from "@/middleware/requestLogger";
import { authMiddleware } from "@/middleware/auth";
import { validateEnv } from "@/config/env";
import { connectDatabase } from "@/config/database";
import { logger } from "@/utils/logger";

// Routes
import authRoutes from "@/routes/auth";
import userRoutes from "@/routes/users";
import projectRoutes from "@/routes/projects";
import contentRoutes from "@/routes/content";
import aiRoutes from "@/routes/ai";
import publishingRoutes from "@/routes/publishing";
import analyticsRoutes from "@/routes/analytics";
import healthRoutes from "@/routes/health";
import linkContentRoutes from "@/routes/link-content";
import wordPressSitesRoutes from "@/routes/wordpress-sites";
import wordPressMultiSiteRoutes from "@/routes/wordpress-multisite";
import automationRoutes from "@/routes/automation";

// Validate environment variables
validateEnv();

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "localhost";

// Security middleware
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
    : ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
  credentials: true,
}));

// Rate limiting (increased for development)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "1000", 10), // limit each IP to 1000 requests per minute
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

// Session middleware (for Passport SSO)
app.use(session({
  secret: process.env['SESSION_SECRET'] || process.env.JWT_SECRET || "fallback-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request logging
if (process.env.ENABLE_REQUEST_LOGGING === "true") {
  app.use(requestLogger);
}

// Health check endpoint (before auth)
app.use("/api/v1/health", healthRoutes);

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/content", contentRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/publishing", publishingRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/link-content", linkContentRoutes);
app.use("/api/v1/wordpress-sites", wordPressSitesRoutes);
app.use("/api/v1/wordpress-multisite", wordPressMultiSiteRoutes);
app.use("/api/v1/automation", automationRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use(errorHandler);

// Start server
async function startServer(): Promise<void> {
  try {
    // Temporarily disable database connection for testing
    // await connectDatabase();
    // logger.info("Database connected successfully");
    
    logger.info("Starting server without database connection (development mode)");

    app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
      logger.info(`📖 API Documentation: http://${HOST}:${PORT}/api/v1/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// Start the server
void startServer(); 