import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";

let supabase: SupabaseClient;

export async function connectDatabase(): Promise<SupabaseClient> {
  try {
    // Check if using placeholder values
    if (env.SUPABASE_URL.includes("placeholder") || env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder")) {
      logger.warn("⚠️  Skipping database connection - using placeholder credentials");
      logger.info("📝 Database features will be disabled until real credentials are provided");
      
      // Create a mock client for development
      supabase = createClient(
        "https://placeholder.supabase.co",
        "placeholder_key",
        {
          auth: { autoRefreshToken: false, persistSession: false },
        }
      );
      
      return supabase;
    }

    // Create Supabase client
    supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
        },
        db: {
          schema: "public",
        },
        global: {
          headers: {
            "x-application-name": "ai-content-agent",
          },
        },
      }
    );

    // Test connection
    const { data, error } = await supabase
      .from("users")
      .select("count")
      .limit(1);

    if (error && error.code !== "42P01") { // 42P01 = relation does not exist
      throw error;
    }

    logger.info("✅ Database connection established successfully");
    return supabase;

  } catch (error) {
    logger.error("❌ Failed to connect to database:", error);
    
    // In development with placeholders, don't fail
    if (env.NODE_ENV === "development" && 
        (env.SUPABASE_URL.includes("placeholder") || env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder"))) {
      logger.warn("🔧 Continuing in development mode without database");
      return supabase;
    }
    
    throw error;
  }
}

export function getDatabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Database not initialized. Call connectDatabase() first.");
  }
  return supabase;
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    return !error;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export { supabase }; 