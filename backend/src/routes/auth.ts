import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "@/config/passport";
import { getDatabase } from "@/config/database";
import { logger } from "@/utils/logger";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { authMiddleware } from "@/middleware/auth";
import { env } from "@/config/env";
import type { AuthenticatedRequest, LoginRequest, CreateUserRequest, AuthResponse, UserRole, SSOAuthResponse } from "@/types";

const router = Router();

// Mock users for development (when using placeholder database)
const mockUsers = new Map();

// Helper function to check if we're using mock mode
function isMockMode(): boolean {
  return env.SUPABASE_URL.includes("placeholder") || env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder");
}

// Register new user
router.post("/register", asyncHandler(async (req, res) => {
  const { email, name, password, role = "user" }: CreateUserRequest = req.body;

  // Validate input
  if (!email || !name || !password) {
    throw new AppError("Email, name, and password are required", 400);
  }

  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters long", 400);
  }

  if (isMockMode()) {
    // Mock mode for development
    if (mockUsers.has(email.toLowerCase())) {
      throw new AppError("User with this email already exists", 409);
    }

    // Hash password
    const saltRounds = parseInt(process.env.HASH_SALT_ROUNDS ?? "12", 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = {
      id: `mock-${Date.now()}`,
      email: email.toLowerCase(),
      name,
      password_hash: passwordHash,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockUsers.set(email.toLowerCase(), newUser);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    logger.info("Mock user registered successfully", {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    const response: AuthResponse = {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role as UserRole,
        isActive: newUser.is_active,
        lastLoginAt: undefined,
        createdAt: new Date(newUser.created_at),
        updatedAt: new Date(newUser.updated_at),
      },
      token: accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
    };

    res.status(201).json({
      success: true,
      data: response,
      message: "User registered successfully (mock mode)",
    });
    return;
  }

  // Real database mode
  const db = getDatabase();

  // Check if user already exists
  const { data: existingUser } = await db
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .single();

  if (existingUser) {
    throw new AppError("User with this email already exists", 409);
  }

  // Hash password
  const saltRounds = parseInt(process.env.HASH_SALT_ROUNDS ?? "12", 10);
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const { data: newUser, error } = await db
    .from("users")
    .insert({
      email: email.toLowerCase(),
      name,
      password_hash: passwordHash,
      role,
      is_active: true,
    })
    .select("id, email, name, role, is_active, created_at, updated_at")
    .single();

  if (error) {
    logger.error("Failed to create user:", error);
    throw new AppError("Failed to create user", 500);
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });

  logger.info("User registered successfully", {
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });

  const response: AuthResponse = {
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      isActive: newUser.is_active,
      lastLoginAt: undefined,
      createdAt: new Date(newUser.created_at),
      updatedAt: new Date(newUser.updated_at),
    },
    token: accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes
  };

  res.status(201).json({
    success: true,
    data: response,
    message: "User registered successfully",
  });
}));

// Login user
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password }: LoginRequest = req.body;

  // Validate input
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  if (isMockMode()) {
    // Mock mode for development
    const user = mockUsers.get(email.toLowerCase());
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError("Invalid email or password", 401);
    }

    // Update last login
    user.last_login_at = new Date().toISOString();
    mockUsers.set(email.toLowerCase(), user);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info("Mock user logged in successfully", {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        isActive: user.is_active,
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : undefined,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      },
      token: accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
    };

    res.json({
      success: true,
      data: response,
      message: "Login successful (mock mode)",
    });
    return;
  }

  // Real database mode
  const db = getDatabase();

  // Get user from database
  const { data: user, error } = await db
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("is_active", true)
    .single();

  if (error || !user) {
    throw new AppError("Invalid email or password", 401);
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  // Update last login
  await db
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  logger.info("User logged in successfully", {
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const response: AuthResponse = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      isActive: user.is_active,
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : undefined,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    },
    token: accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes
  };

  res.json({
    success: true,
    data: response,
    message: "Login successful",
  });
}));

// Refresh token
router.post("/refresh", asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
      email: string;
      role: string;
      type: string;
    };

    if (decoded.type !== "refresh") {
      throw new AppError("Invalid token type", 401);
    }

    const db = getDatabase();

    // Verify user still exists and is active
    const { data: user, error } = await db
      .from("users")
      .select("id, email, role, is_active")
      .eq("id", decoded.userId)
      .eq("is_active", true)
      .single();

    if (error || !user) {
      throw new AppError("User not found or inactive", 401);
    }

    // Generate new access token
    const { accessToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        token: accessToken,
        expiresIn: 15 * 60, // 15 minutes
      },
      message: "Token refreshed successfully",
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError("Invalid refresh token", 401);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("Refresh token expired", 401);
    }
    throw error;
  }
}));

// Get current user
router.get("/me", authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: req.user,
    message: "User profile retrieved successfully",
  });
}));

// Logout (optional - for logging purposes)
router.post("/logout", authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
  logger.info("User logged out", {
    userId: req.user?.id,
    email: req.user?.email,
  });

  res.json({
    success: true,
    message: "Logout successful",
  });
}));

// Helper function to generate tokens
function generateTokens(payload: { userId: string; email: string; role: string }) {
  const accessTokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    type: "access" as const,
  };

  const refreshTokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    type: "refresh" as const,
  };

  const accessToken = jwt.sign(
    accessTokenPayload,
    process.env.JWT_SECRET || "development-secret-key",
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    refreshTokenPayload,
    process.env.JWT_SECRET || "development-secret-key", // Use same secret for now
    { expiresIn: "30d" }
  );

  return { accessToken, refreshToken };
}

// === SSO ROUTES ===

// Google SSO - Initiate authentication
router.get("/google", 
  passport.authenticate("google", { 
    scope: ["profile", "email"] 
  })
);

// Google SSO - Callback
router.get("/google/callback", 
  passport.authenticate("google", { failureRedirect: "/login?error=google_auth_failed" }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    
    if (!user) {
      return res.redirect("/login?error=google_auth_failed");
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info("Google SSO successful", {
      userId: user.id,
      email: user.email,
      provider: "google"
    });

    // In production, redirect to frontend with tokens
    // For now, return JSON response for API testing
    if (req.headers.accept?.includes('application/json')) {
      const response: SSOAuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          provider: "google",
          providerId: user.providerId,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token: accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        isNewUser: !user.existingUser
      };

      res.json({
        success: true,
        data: response,
        message: "Google SSO login successful"
      });
    } else {
      // Redirect to frontend with tokens in URL (for web flow)
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${frontendUrl}/auth/sso-callback?token=${accessToken}&refresh=${refreshToken}&provider=google`);
    }
  })
);

// Microsoft SSO - Initiate authentication
router.get("/microsoft", 
  passport.authenticate("microsoft", { 
    scope: ["user.read"] 
  })
);

// Microsoft SSO - Callback
router.get("/microsoft/callback", 
  passport.authenticate("microsoft", { failureRedirect: "/login?error=microsoft_auth_failed" }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    
    if (!user) {
      return res.redirect("/login?error=microsoft_auth_failed");
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info("Microsoft SSO successful", {
      userId: user.id,
      email: user.email,
      provider: "microsoft"
    });

    // In production, redirect to frontend with tokens
    // For now, return JSON response for API testing
    if (req.headers.accept?.includes('application/json')) {
      const response: SSOAuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          provider: "microsoft",
          providerId: user.providerId,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token: accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        isNewUser: !user.existingUser
      };

      res.json({
        success: true,
        data: response,
        message: "Microsoft SSO login successful"
      });
    } else {
      // Redirect to frontend with tokens in URL (for web flow)
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res.redirect(`${frontendUrl}/auth/sso-callback?token=${accessToken}&refresh=${refreshToken}&provider=microsoft`);
    }
  })
);

// SSO Status endpoint - Check if SSO is available
router.get("/sso/status", asyncHandler(async (req, res) => {
  const ssoStatus = {
    google: {
      available: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) && 
                 !(env.GOOGLE_CLIENT_ID?.includes('placeholder')),
      loginUrl: "/api/v1/auth/google"
    },
    microsoft: {
      available: !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) && 
                 !(env.MICROSOFT_CLIENT_ID?.includes('placeholder')),
      loginUrl: "/api/v1/auth/microsoft"
    }
  };

  res.json({
    success: true,
    data: ssoStatus,
    message: "SSO status retrieved successfully"
  });
}));

export default router;