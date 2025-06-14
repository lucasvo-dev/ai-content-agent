import { Router } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { requireAdmin } from "@/middleware/auth";
import { UserController } from "../controllers/UserController";
import type { AuthenticatedRequest } from "@/types";

const router = Router();
const userController = new UserController();

// Health check
router.get("/health", userController.healthCheck);

// Get all users (admin only)
router.get("/", requireAdmin, asyncHandler(userController.listUsers));

// Get current user profile
router.get("/profile", asyncHandler(userController.getProfile));

// Update user profile
router.put("/profile", asyncHandler(userController.updateProfile));

// Get user statistics
router.get("/stats", asyncHandler(userController.getStats));

// Change password
router.post("/change-password", asyncHandler(userController.changePassword));

// Deactivate account
router.delete("/account", asyncHandler(userController.deactivateAccount));

// Get user by ID (admin only or own profile)
router.get("/:userId", asyncHandler(userController.getUserById));

// Update user (admin only)
router.put("/:userId", requireAdmin, asyncHandler(userController.updateUser));

export default router; 