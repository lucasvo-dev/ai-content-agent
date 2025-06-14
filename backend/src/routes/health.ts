import { Router } from "express";
import { getDatabase, checkDatabaseHealth } from "@/config/database";
import { logger } from "@/utils/logger";
import { asyncHandler } from "@/middleware/errorHandler";
import Redis from "ioredis";

const router = Router();

// Basic health check
router.get("/", asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: "AI Content Agent API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
}));

// Detailed health check
router.get("/detailed", asyncHandler(async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabaseHealthStatus(),
    checkRedisHealth(),
    checkOpenAIHealth(),
  ]);

  const results = checks.map((check, index) => ({
    service: ["database", "redis", "openai"][index],
    status: check.status === "fulfilled" && check.value ? "healthy" : "unhealthy",
    error: check.status === "rejected" ? (check.reason as Error).message : null,
  }));

  const overallStatus = results.every((r) => r.status === "healthy") 
    ? "healthy" 
    : "unhealthy";

  const response = {
    success: true,
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: results,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  const statusCode = overallStatus === "healthy" ? 200 : 503;
  res.status(statusCode).json(response);
}));

// Database health check
async function checkDatabaseHealthStatus(): Promise<boolean> {
  try {
    return await checkDatabaseHealth();
  } catch (error) {
    logger.error("Database health check failed:", error);
    return false;
  }
}

// Redis health check
async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!process.env.REDIS_URL) {
      return false;
    }

    const redis = new Redis(process.env.REDIS_URL);
    await redis.ping();
    await redis.disconnect();
    return true;
  } catch (error) {
    logger.error("Redis health check failed:", error);
    return false;
  }
}

// OpenAI health check
async function checkOpenAIHealth(): Promise<boolean> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return false;
    }

    // Simple API test - we'll implement this when OpenAI service is ready
    return true;
  } catch (error) {
    logger.error("OpenAI health check failed:", error);
    return false;
  }
}

// Readiness probe (for Kubernetes)
router.get("/ready", asyncHandler(async (req, res) => {
  const isDatabaseReady = await checkDatabaseHealthStatus();
  
  if (isDatabaseReady) {
    res.json({
      success: true,
      message: "Service is ready",
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      success: false,
      message: "Service is not ready",
      timestamp: new Date().toISOString(),
    });
  }
}));

// Liveness probe (for Kubernetes)
router.get("/live", asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: "Service is alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}));

export default router; 