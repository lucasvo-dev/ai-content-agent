import type { EnvConfig } from "@/types";

const requiredEnvVars = [
  "NODE_ENV",
  "PORT",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "CLAUDE_API_KEY",
  "REDIS_URL",
] as const;

const optionalEnvVars = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
] as const;

export function validateEnv(): EnvConfig {
  const missing: string[] = [];
  const placeholders: string[] = [];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (!value) {
      missing.push(envVar);
    } else if (value.startsWith("placeholder")) {
      placeholders.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      "Please check your .env file and ensure all required variables are set."
    );
  }

  // Check optional SSO variables
  const ssoPlaceholders: string[] = [];
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar];
    if (value && value.startsWith("placeholder")) {
      ssoPlaceholders.push(envVar);
    }
  }

  // In development, warn about placeholder values but don't fail
  if (placeholders.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      `⚠️  Warning: Using placeholder values for: ${placeholders.join(", ")}\n` +
      "Some features may not work properly until real values are provided."
    );
  } else if (placeholders.length > 0 && process.env.NODE_ENV === "production") {
    throw new Error(
      `Production environment cannot use placeholder values: ${placeholders.join(", ")}\n` +
      "Please provide real values for all environment variables."
    );
  }

  if (ssoPlaceholders.length > 0) {
    console.warn(
      `⚠️  Warning: SSO features disabled - using placeholder values for: ${ssoPlaceholders.join(", ")}\n` +
      "Set real OAuth credentials to enable SSO functionality."
    );
  }

  return {
    NODE_ENV: process.env.NODE_ENV as "development" | "production" | "test",
    PORT: process.env.PORT || "3001",
    HOST: process.env.HOST || "localhost",
    SUPABASE_URL: process.env.SUPABASE_URL || "placeholder-url",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "placeholder-key",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key",
    JWT_SECRET: process.env.JWT_SECRET || "development-secret-key",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "placeholder-openai-key",
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "placeholder-gemini-key",
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "placeholder-claude-key",
    REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
    // SSO Configuration - handle optional properties
    GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'],
    GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'],
    MICROSOFT_CLIENT_ID: process.env['MICROSOFT_CLIENT_ID'],
    MICROSOFT_CLIENT_SECRET: process.env['MICROSOFT_CLIENT_SECRET'],
  };
}

// Export env as a lazy getter to avoid validation on import
let _env: EnvConfig | null = null;

export const env = new Proxy({} as EnvConfig, {
  get(target, prop) {
    if (!_env) {
      _env = validateEnv();
    }
    return _env[prop as keyof EnvConfig];
  }
});

// Export config alias for compatibility
export const config: EnvConfig = {
  NODE_ENV: process.env.NODE_ENV as "development" | "production" | "test",
  PORT: process.env.PORT || "3001",
  HOST: process.env.HOST || "localhost",
  SUPABASE_URL: process.env.SUPABASE_URL || "placeholder-url",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "placeholder-key",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key",
  JWT_SECRET: process.env.JWT_SECRET || "development-secret-key",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "placeholder-openai-key",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "placeholder-gemini-key",
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || "placeholder-claude-key",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  // SSO Configuration - handle optional properties
  GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'],
  GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'],
  MICROSOFT_CLIENT_ID: process.env['MICROSOFT_CLIENT_ID'],
  MICROSOFT_CLIENT_SECRET: process.env['MICROSOFT_CLIENT_SECRET'],
}; 