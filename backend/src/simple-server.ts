import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

// Basic middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get("/api/v1/health", (req, res) => {
  res.json({
    success: true,
    message: "AI Content Agent API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
});

// Basic info endpoint
app.get("/api/v1/info", (req, res) => {
  res.json({
    success: true,
    data: {
      name: "AI Content Agent Backend",
      version: "1.0.0",
      status: "healthy",
      features: {
        authentication: "available",
        contentGeneration: "available",
        publishing: "available",
        analytics: "available",
      },
    },
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
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📖 Health check: http://localhost:${PORT}/api/v1/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
}); 