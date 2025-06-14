declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Server Configuration
      NODE_ENV?: 'development' | 'production' | 'test';
      PORT?: string;
      HOST?: string;
      
      // Database Configuration (Supabase)
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
      SUPABASE_SERVICE_ROLE_KEY?: string;
      
      // Authentication
      JWT_SECRET?: string;
      JWT_EXPIRES_IN?: string;
      JWT_REFRESH_SECRET?: string;
      JWT_REFRESH_EXPIRES_IN?: string;
      
      // AI Services
      OPENAI_API_KEY?: string;
      OPENAI_MODEL?: string;
      OPENAI_MAX_TOKENS?: string;
      
      // LangChain Configuration
      LANGCHAIN_TRACING_V2?: string;
      LANGCHAIN_API_KEY?: string;
      
      // Vector Database (Pinecone)
      PINECONE_API_KEY?: string;
      PINECONE_ENVIRONMENT?: string;
      PINECONE_INDEX_NAME?: string;
      
      // Redis Configuration
      REDIS_URL?: string;
      REDIS_PASSWORD?: string;
      
      // WordPress Integration
      WORDPRESS_DEFAULT_USERNAME?: string;
      WORDPRESS_DEFAULT_APP_PASSWORD?: string;
      
      // Facebook Integration
      FACEBOOK_APP_ID?: string;
      FACEBOOK_APP_SECRET?: string;
      FACEBOOK_GRAPH_API_VERSION?: string;
      
      // Email Configuration
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;
      
      // File Upload Configuration
      MAX_FILE_SIZE?: string;
      UPLOAD_PATH?: string;
      ALLOWED_FILE_TYPES?: string;
      
      // Rate Limiting
      RATE_LIMIT_WINDOW_MS?: string;
      RATE_LIMIT_MAX_REQUESTS?: string;
      
      // Monitoring & Logging
      LOG_LEVEL?: string;
      LOG_FILE_PATH?: string;
      ENABLE_REQUEST_LOGGING?: string;
      
      // External Services
      UNSPLASH_ACCESS_KEY?: string;
      PEXELS_API_KEY?: string;
      FRONTEND_URL?: string;
      
      // Security
      ENCRYPTION_KEY?: string;
      HASH_SALT_ROUNDS?: string;
      
      // Feature Flags
      ENABLE_AI_CONTENT_GENERATION?: string;
      ENABLE_WORDPRESS_PUBLISHING?: string;
      ENABLE_FACEBOOK_PUBLISHING?: string;
      ENABLE_ANALYTICS?: string;
      ENABLE_WEBHOOKS?: string;
    }
  }
}

export {}; 