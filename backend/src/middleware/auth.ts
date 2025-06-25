import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserService } from "../services/UserService";
import { DatabaseService } from "../services/DatabaseService";
import { logger } from "@/utils/logger";
import { AppError } from "@/middleware/errorHandler";
import { env } from "@/config/env";
import type { User, AuthenticatedRequest } from "@/types";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

// Initialize services
const dbService = new DatabaseService();
const userService = new UserService(dbService);

// Helper function to check if we're using mock mode
function isMockMode(): boolean {
  return env.SUPABASE_URL.includes("placeholder") || env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder");
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from header
    const authHeader = req.get('Authorization');
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authorization token is required", 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Check if token is access token
    if (decoded.type !== "access") {
      throw new AppError("Invalid token type", 401);
    }

    if (isMockMode()) {
      // Mock mode - create user from JWT payload
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        name: "Mock User", // We don't have name in JWT, use default
        role: decoded.role as any,
        isActive: true,
        lastLoginAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.debug("Mock user authenticated", {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });
    } else {
      // Real database mode - use UserService
      const user = await userService.findUserById(decoded.userId);

      if (!user || !user.isActive) {
        throw new AppError("User not found or inactive", 401);
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: undefined, // TODO: Add lastLoginAt to user model
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      logger.debug("User authenticated", {
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError("Invalid token", 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError("Token expired", 401));
    } else {
      next(error);
    }
  }
};

// Optional authentication - doesn't throw error if no token
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.get('Authorization');
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    if (decoded.type === "access") {
      if (isMockMode()) {
        // Mock mode
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          name: "Mock User",
          role: decoded.role as any,
          isActive: true,
          lastLoginAt: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        // Real database mode
        const user = await userService.findUserById(decoded.userId);

        if (user && user.isActive) {
          req.user = {
            id: user.id,
            email: user.email,
            name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
            role: user.role,
            isActive: user.isActive,
            lastLoginAt: undefined,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          };
        }
      }
    }

    next();
  } catch (error) {
    // Ignore auth errors in optional auth
    next();
  }
};

// Role-based authorization
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("Insufficient permissions", 403));
    }

    next();
  };
};

// Admin only middleware
export const requireAdmin = requireRole(["admin"]);

// Editor or Admin middleware
export const requireEditor = requireRole(["admin", "editor"]);

// Export AuthenticatedRequest for use in other modules
export { AuthenticatedRequest } from "@/types";

// Also export directly for compatibility
export type { AuthenticatedRequest as AuthRequest }; 