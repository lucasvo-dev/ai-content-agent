# AI Content Agent - Technical Architecture

## System Overview

AI Content Agent là một hệ thống microservices được thiết kế để tự động tạo và đăng bài content lên WordPress và Facebook. Hệ thống sử dụng kiến trúc event-driven với AI/ML integration để đảm bảo scalability và maintainability.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web App - React]
        MOBILE[Mobile App]
        API_CLIENT[API Clients]
    end

    subgraph "API Gateway"
        GATEWAY[API Gateway - Express.js]
        AUTH[Authentication Service]
        RATE_LIMITER[Rate Limiter]
    end

    subgraph "Core Services"
        CONTENT[Content Service]
        SCHEDULER[Scheduler Service]
        ANALYTICS[Analytics Service]
        USER[User Service]
    end

    subgraph "AI/ML Layer"
        AI_ENGINE[AI Engine - LangChain]
        VECTOR_DB[Vector Database]
        EMBEDDING[Embedding Service]
    end

    subgraph "Integration Layer"
        WP_ADAPTER[WordPress Adapter]
        FB_ADAPTER[Facebook Adapter]
        NOTIFICATION[Notification Service]
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL - Supabase)]
        REDIS[(Redis Cache)]
        S3[(File Storage)]
    end

    subgraph "External APIs"
        OPENAI[OpenAI API]
        WP_API[WordPress REST API]
        FB_API[Facebook Graph API]
    end

    WEB --> GATEWAY
    MOBILE --> GATEWAY
    API_CLIENT --> GATEWAY

    GATEWAY --> AUTH
    GATEWAY --> RATE_LIMITER
    GATEWAY --> CONTENT
    GATEWAY --> SCHEDULER
    GATEWAY --> ANALYTICS
    GATEWAY --> USER

    CONTENT --> AI_ENGINE
    AI_ENGINE --> VECTOR_DB
    AI_ENGINE --> EMBEDDING
    AI_ENGINE --> OPENAI

    SCHEDULER --> WP_ADAPTER
    SCHEDULER --> FB_ADAPTER
    WP_ADAPTER --> WP_API
    FB_ADAPTER --> FB_API

    CONTENT --> POSTGRES
    USER --> POSTGRES
    ANALYTICS --> POSTGRES
    CONTENT --> REDIS
    CONTENT --> S3
```

## Technology Stack

### Backend Services

- **Runtime**: Node.js 20+ với TypeScript
- **Framework**: Express.js với Helmet, CORS, Rate Limiting
- **Authentication**: JWT với refresh tokens
- **Validation**: Joi/Zod cho request validation
- **Logging**: Winston với structured logging
- **Process Management**: PM2 cho production

### Frontend

- **Framework**: React 18+ với TypeScript
- **State Management**: Zustand/Redux Toolkit
- **UI Components**: Shadcn/ui với Tailwind CSS
- **Forms**: React Hook Form với Zod validation
- **HTTP Client**: Axios với interceptors
- **Routing**: React Router v6

### Database & Storage

- **Primary Database**: PostgreSQL 15+ (via Supabase)
- **Cache**: Redis 7+ cho session và caching
- **Vector Database**: Pinecone hoặc Chroma
- **File Storage**: Supabase Storage hoặc AWS S3
- **Search**: PostgreSQL Full-Text Search

### AI/ML Stack

- **Primary LLM**: OpenAI GPT-4/GPT-4 Turbo (Premium)
- **Secondary LLM**: Google Gemini Flash (Free tier)
- **Framework**: LangChain TypeScript
- **Embeddings**: OpenAI text-embedding-ada-002
- **Vector Operations**: Cosine similarity
- **Prompt Management**: Custom prompt templates
- **Provider Selection**: Hybrid AI system với manual override

### Manual AI Provider Selection Architecture

**Provider Options**:
- 🤖 **Auto Selection** (Intelligent) - System automatically selects optimal provider
- 🧠 **OpenAI GPT-4 Turbo** (Premium ~$0.01-0.03/1K tokens)
- ⚡ **Google Gemini Flash** (Free - 1,500 requests/day, 15 requests/minute)

**Selection Logic**:
```typescript
interface ContentGenerationRequest {
  type: "blog_post" | "social_media" | "email" | "ad_copy";
  topic: string;
  targetAudience: string;
  keywords: string[];
  brandVoice: BrandVoiceConfig;
  preferredProvider?: "openai" | "gemini" | "auto"; // Manual selection
}

class HybridAIService {
  private selectProvider(request: ContentGenerationRequest): AIProvider {
    // Manual selection takes priority
    if (request.preferredProvider && request.preferredProvider !== 'auto') {
      if (this.isProviderAvailable(request.preferredProvider)) {
        return request.preferredProvider;
      }
      // Fallback if preferred provider unavailable
    }
    
    // Intelligent selection based on complexity
    const complexity = this.assessComplexity(request);
    return complexity > 0.7 ? 'openai' : 'gemini';
  }
  
  private assessComplexity(request: ContentGenerationRequest): number {
    let score = 0;
    
    // Content type complexity
    if (request.type === 'blog_post') score += 0.4;
    if (request.type === 'email') score += 0.3;
    if (request.type === 'social_media') score += 0.1;
    
    // Brand voice complexity
    if (request.brandVoice.vocabulary === 'industry-specific') score += 0.3;
    if (request.brandVoice.length === 'comprehensive') score += 0.2;
    
    return Math.min(score, 1.0);
  }
}
```

**Cost Optimization Benefits**:
- 60-80% cost reduction với intelligent provider selection
- Free tier utilization (Gemini) cho simple content
- Premium quality (OpenAI) cho complex content
- User control over cost vs quality trade-offs

### Google Gemini Flash Integration

**Setup Requirements**:
1. Google AI Studio account (free)
2. API key generation từ https://aistudio.google.com/
3. Environment configuration:

```bash
# Gemini Configuration
GEMINI_API_KEY=AIzaSyC-your-actual-api-key-here
```

**Free Tier Limits**:
- **Requests per minute**: 15
- **Requests per day**: 1,500
- **Tokens per minute**: 1,000,000
- **Cost**: **FREE**

**Integration Architecture**:
```typescript
class GeminiAIService {
  private client: GoogleGenerativeAI;
  
  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  
  async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    const model = this.client.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = this.buildPrompt(request);
    const result = await model.generateContent(prompt);
    
    return this.parseResponse(result.response.text());
  }
}
```

**Quality Comparison**:
- **OpenAI GPT-4**: 85-95 quality score, premium features
- **Gemini Flash**: 80-90 quality score, fast generation
- **Use Cases**: 
  - Gemini: Social media, simple emails, bulk content
  - OpenAI: Blog posts, technical content, premium campaigns

### Infrastructure

- **Containerization**: Docker với multi-stage builds
- **Orchestration**: Docker Compose (development), Kubernetes (production)
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

## Detailed Service Architecture

### 1. API Gateway Service

```typescript
// api-gateway/src/server.ts
import express from "express";
import { authMiddleware } from "./middleware/auth";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { loggingMiddleware } from "./middleware/logging";

const app = express();

// Global middleware
app.use(express.json());
app.use(loggingMiddleware);
app.use(rateLimitMiddleware);

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/content", authMiddleware, contentRoutes);
app.use("/api/v1/publishing", authMiddleware, publishingRoutes);
app.use("/api/v1/analytics", authMiddleware, analyticsRoutes);

// Error handling
app.use(errorHandler);
```

**Responsibilities:**

- Request routing và load balancing
- Authentication và authorization
- Rate limiting và DDoS protection
- Request/response logging
- API versioning

**Key Features:**

- JWT token validation
- Role-based access control
- API rate limiting (100 req/min per user)
- Request/response compression
- CORS configuration

### 2. Content Service

```typescript
// content-service/src/models/Content.ts
interface Content {
  id: string;
  projectId: string;
  title: string;
  body: string;
  type: "blog_post" | "social_media";
  status: "draft" | "approved" | "published";
  metadata: {
    keywords: string[];
    targetAudience: string;
    brandVoice: BrandVoiceConfig;
    seoScore: number;
  };
  aiGenerated: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BrandVoiceConfig {
  tone: "professional" | "casual" | "friendly" | "authoritative";
  style: "formal" | "conversational" | "technical" | "creative";
  vocabulary: "simple" | "advanced" | "industry-specific";
  length: "concise" | "detailed" | "comprehensive";
}
```

**Responsibilities:**

- Content CRUD operations
- AI content generation
- Content versioning
- SEO optimization
- Brand voice management

**API Endpoints:**

```typescript
// Content Generation
POST /api/v1/content/generate
{
  "type": "blog_post",
  "topic": "AI in Marketing",
  "brandVoice": {
    "tone": "professional",
    "style": "conversational",
    "vocabulary": "industry-specific",
    "length": "comprehensive"
  },
  "targetAudience": "Marketing professionals",
  "keywords": ["AI", "marketing automation", "content strategy"],
  "length": "1500-2000 words"
}

// Content Management
GET /api/v1/content?status=draft&limit=20&offset=0
POST /api/v1/content
PUT /api/v1/content/:id
DELETE /api/v1/content/:id
```

### 3. AI Engine Service

```typescript
// ai-engine/src/services/ContentGenerator.ts
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { VectorStore } from "./VectorStore";

export class ContentGenerator {
  private llm: ChatOpenAI;
  private vectorStore: VectorStore;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 0.7,
    });
    this.vectorStore = new VectorStore();
  }

  async generateBlogPost(request: BlogPostRequest): Promise<GeneratedContent> {
    // 1. Retrieve similar content from vector database
    const similarContent = await this.vectorStore.similaritySearch(
      request.topic,
      5
    );

    // 2. Create context-aware prompt
    const prompt = PromptTemplate.fromTemplate(`
      Create a blog post about {topic} for {targetAudience}.
      
      Brand Voice:
      - Tone: {tone}
      - Style: {style}
      - Vocabulary: {vocabulary}
      
      Requirements:
      - Length: {length} words
      - Include keywords: {keywords}
      - SEO optimized
      
      Similar content for context:
      {context}
      
      Generate a compelling blog post with:
      1. Engaging title
      2. Meta description
      3. Well-structured content with headers
      4. Call-to-action
    `);

    // 3. Generate content
    const response = await this.llm.invoke(
      await prompt.format({
        topic: request.topic,
        targetAudience: request.targetAudience,
        tone: request.brandVoice.tone,
        style: request.brandVoice.style,
        vocabulary: request.brandVoice.vocabulary,
        length: request.length,
        keywords: request.keywords.join(", "),
        context: similarContent.map((c) => c.content).join("\n\n"),
      })
    );

    // 4. Process and validate content
    return this.processGeneratedContent(response.content, request);
  }

  private async processGeneratedContent(
    content: string,
    request: BlogPostRequest
  ): Promise<GeneratedContent> {
    // Extract title, meta description, and body
    const structured = this.parseStructuredContent(content);

    // Calculate SEO score
    const seoScore = await this.calculateSEOScore(structured, request.keywords);

    // Store embedding for future similarity searches
    await this.vectorStore.addDocument({
      content: structured.body,
      metadata: {
        topic: request.topic,
        keywords: request.keywords,
        type: "blog_post",
      },
    });

    return {
      ...structured,
      seoScore,
      metadata: {
        generatedAt: new Date(),
        model: "gpt-4-turbo-preview",
        promptVersion: "1.0",
      },
    };
  }
}
```

**AI Engine Features:**

- **Multi-model Support**: GPT-4, Claude, local models
- **Prompt Engineering**: Template-based prompt management
- **Content Quality Scoring**: Automated quality assessment
- **Vector Search**: Semantic similarity for content inspiration
- **Fine-tuning**: Brand-specific model adaptation

### 4. Publishing Service

```typescript
// publishing-service/src/adapters/WordPressAdapter.ts
import { WordPressApi } from "./WordPressApi";

export class WordPressAdapter {
  private api: WordPressApi;

  constructor(config: WordPressConfig) {
    this.api = new WordPressApi(config);
  }

  async publishPost(
    content: Content,
    settings: PublishSettings
  ): Promise<PublishResult> {
    try {
      // 1. Prepare content for WordPress
      const wpPost = this.formatForWordPress(content, settings);

      // 2. Upload media if exists
      if (content.media) {
        wpPost.featured_media = await this.uploadMedia(content.media);
      }

      // 3. Create/update post
      const result = settings.postId
        ? await this.api.updatePost(settings.postId, wpPost)
        : await this.api.createPost(wpPost);

      // 4. Handle categories and tags
      if (settings.categories) {
        await this.api.setPostCategories(result.id, settings.categories);
      }

      if (settings.tags) {
        await this.api.setPostTags(result.id, settings.tags);
      }

      return {
        success: true,
        externalId: result.id.toString(),
        url: result.link,
        publishedAt: new Date(result.date),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        retryable: this.isRetryableError(error),
      };
    }
  }

  private formatForWordPress(content: Content, settings: PublishSettings) {
    return {
      title: content.title,
      content: content.body,
      status: settings.status || "publish",
      excerpt: content.metadata.excerpt,
      date: settings.scheduledDate?.toISOString(),
      categories: settings.categories?.map((cat) => cat.id),
      tags: settings.tags?.map((tag) => tag.id),
      meta: {
        seo_title: content.metadata.seoTitle,
        seo_description: content.metadata.seoDescription,
      },
    };
  }
}
```

**Publishing Features:**

- **Multi-platform Support**: WordPress, Facebook, Instagram (future)
- **Scheduled Publishing**: Queue-based scheduling system
- **Retry Logic**: Automatic retry with exponential backoff
- **Media Management**: Image optimization và upload
- **Error Handling**: Comprehensive error tracking
- **Webhooks**: Real-time publishing status updates

### 5. Scheduler Service

```typescript
// scheduler-service/src/services/SchedulerService.ts
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

export class SchedulerService {
  private publishQueue: Queue;
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.publishQueue = new Queue("publishing", {
      connection: this.redis,
    });

    this.setupWorkers();
  }

  async schedulePost(
    contentId: string,
    platform: string,
    scheduledDate: Date,
    settings: PublishSettings
  ): Promise<string> {
    const jobId = `${contentId}-${platform}-${Date.now()}`;

    await this.publishQueue.add(
      "publish-content",
      {
        contentId,
        platform,
        settings,
      },
      {
        jobId,
        delay: scheduledDate.getTime() - Date.now(),
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    return jobId;
  }

  private setupWorkers() {
    const worker = new Worker(
      "publishing",
      async (job) => {
        const { contentId, platform, settings } = job.data;

        // Get content from database
        const content = await this.getContent(contentId);

        // Get appropriate adapter
        const adapter = this.getAdapter(platform, settings.credentials);

        // Publish content
        const result = await adapter.publishPost(content, settings);

        // Log result
        await this.logPublishingResult(contentId, platform, result);

        return result;
      },
      {
        connection: this.redis,
        concurrency: 5,
      }
    );

    worker.on("completed", (job, result) => {
      console.log(`Job ${job.id} completed:`, result);
    });

    worker.on("failed", (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });
  }
}
```

### 6. Analytics Service

```typescript
// analytics-service/src/services/MetricsCollector.ts
export class MetricsCollector {
  async collectWordPressMetrics(postId: string, config: WordPressConfig) {
    const api = new WordPressApi(config);

    // Get post data
    const post = await api.getPost(postId);

    // Collect metrics
    const metrics = {
      views: await this.getPageViews(post.link),
      comments: post.comment_count,
      shares: await this.getSocialShares(post.link),
      seoScore: await this.calculateSEOMetrics(post),
      readTime: this.calculateReadTime(post.content),
    };

    await this.storeMetrics(postId, "wordpress", metrics);
    return metrics;
  }

  async collectFacebookMetrics(postId: string, accessToken: string) {
    const api = new FacebookGraphApi(accessToken);

    const insights = await api.getPostInsights(postId, [
      "post_impressions",
      "post_engagements",
      "post_clicks",
      "post_reactions",
      "post_shares",
      "post_comments",
    ]);

    const metrics = this.formatFacebookMetrics(insights);
    await this.storeMetrics(postId, "facebook", metrics);
    return metrics;
  }
}
```

## Database Design

### Core Schema

```sql
-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Multi-tenant Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- Content Management
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    excerpt TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    metadata JSONB DEFAULT '{}',
    ai_generated BOOLEAN DEFAULT false,
    ai_model VARCHAR(100),
    ai_prompt_version VARCHAR(20),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(500),
    body TEXT,
    excerpt TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Publishing and Integration
CREATE TABLE platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    credentials JSONB NOT NULL, -- encrypted
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_tested TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE publishing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    platform_connection_id UUID REFERENCES platform_connections(id),
    status VARCHAR(50) DEFAULT 'scheduled',
    scheduled_date TIMESTAMP,
    published_date TIMESTAMP,
    external_id VARCHAR(255),
    external_url TEXT,
    settings JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Analytics and Metrics
CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publishing_job_id UUID REFERENCES publishing_jobs(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    metrics JSONB NOT NULL,
    collected_at TIMESTAMP DEFAULT NOW()
);

-- AI and Vector Storage
CREATE TABLE content_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    embedding_model VARCHAR(100) NOT NULL,
    embedding VECTOR(1536), -- for OpenAI embeddings
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_content_project_status ON content(project_id, status);
CREATE INDEX idx_content_type_created ON content(type, created_at DESC);
CREATE INDEX idx_publishing_jobs_scheduled ON publishing_jobs(scheduled_date) WHERE status = 'scheduled';
CREATE INDEX idx_analytics_job_collected ON analytics_snapshots(publishing_job_id, collected_at DESC);
CREATE INDEX idx_embeddings_similarity ON content_embeddings USING ivfflat (embedding vector_cosine_ops);
```

## Security Architecture

### Authentication & Authorization

```typescript
// auth/src/services/AuthService.ts
export class AuthService {
  async authenticateUser(email: string, password: string): Promise<AuthResult> {
    // 1. Validate user credentials
    const user = await this.userRepository.findByEmail(email);
    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // 2. Generate JWT tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // 3. Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  private generateAccessToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: "access",
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
  }
}
```

### Data Encryption

```typescript
// security/src/services/EncryptionService.ts
export class EncryptionService {
  private readonly algorithm = "aes-256-gcm";
  private readonly keyDerivationRounds = 100000;

  async encryptSensitiveData(
    data: string,
    userKey: string
  ): Promise<EncryptedData> {
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const key = crypto.pbkdf2Sync(
      userKey,
      salt,
      this.keyDerivationRounds,
      32,
      "sha512"
    );
    const cipher = crypto.createCipher(this.algorithm, key, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  }

  async decryptSensitiveData(
    encryptedData: EncryptedData,
    userKey: string
  ): Promise<string> {
    const key = crypto.pbkdf2Sync(
      userKey,
      Buffer.from(encryptedData.salt, "hex"),
      this.keyDerivationRounds,
      32,
      "sha512"
    );

    const decipher = crypto.createDecipher(
      this.algorithm,
      key,
      Buffer.from(encryptedData.iv, "hex")
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"));

    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
```

## Performance Optimization

### Caching Strategy

```typescript
// cache/src/services/CacheService.ts
export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async cacheContent(contentId: string, content: Content, ttl: number = 3600) {
    await this.redis.setex(
      `content:${contentId}`,
      ttl,
      JSON.stringify(content)
    );
  }

  async getCachedContent(contentId: string): Promise<Content | null> {
    const cached = await this.redis.get(`content:${contentId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheAIResponse(prompt: string, response: string, ttl: number = 7200) {
    const key = `ai:${crypto
      .createHash("sha256")
      .update(prompt)
      .digest("hex")}`;
    await this.redis.setex(key, ttl, response);
  }

  async invalidateUserCache(userId: string) {
    const keys = await this.redis.keys(`user:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Database Optimization

```sql
-- Performance indexes
CREATE INDEX CONCURRENTLY idx_content_search ON content
    USING gin(to_tsvector('english', title || ' ' || body));

CREATE INDEX CONCURRENTLY idx_analytics_time_series ON analytics_snapshots
    (publishing_job_id, collected_at DESC)
    INCLUDE (metrics);

-- Partitioning for analytics data
CREATE TABLE analytics_snapshots_y2024m01 PARTITION OF analytics_snapshots
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Query optimization examples
EXPLAIN ANALYZE
SELECT c.*, p.name as project_name
FROM content c
JOIN projects p ON c.project_id = p.id
WHERE c.status = 'published'
    AND c.created_at >= NOW() - INTERVAL '30 days'
ORDER BY c.created_at DESC
LIMIT 20;
```

## Monitoring & Observability

### Application Metrics

```typescript
// monitoring/src/services/MetricsService.ts
import prometheus from "prom-client";

export class MetricsService {
  private httpRequestDuration = new prometheus.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
  });

  private aiGenerationCounter = new prometheus.Counter({
    name: "ai_content_generation_total",
    help: "Total number of AI content generations",
    labelNames: ["model", "type", "status"],
  });

  private publishingJobsGauge = new prometheus.Gauge({
    name: "publishing_jobs_pending",
    help: "Number of pending publishing jobs",
    labelNames: ["platform"],
  });

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ) {
    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration);
  }

  recordAIGeneration(model: string, type: string, status: "success" | "error") {
    this.aiGenerationCounter.labels(model, type, status).inc();
  }

  updatePendingJobs(platform: string, count: number) {
    this.publishingJobsGauge.labels(platform).set(count);
  }
}
```

### Health Checks

```typescript
// health/src/services/HealthService.ts
export class HealthService {
  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOpenAI(),
      this.checkExternalAPIs(),
    ]);

    const results = checks.map((check, index) => ({
      service: ["database", "redis", "openai", "external_apis"][index],
      status: check.status === "fulfilled" ? "healthy" : "unhealthy",
      error: check.status === "rejected" ? check.reason.message : null,
    }));

    const overallStatus = results.every((r) => r.status === "healthy")
      ? "healthy"
      : "unhealthy";

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
    };
  }

  private async checkDatabase(): Promise<void> {
    await this.db.query("SELECT 1");
  }

  private async checkRedis(): Promise<void> {
    await this.redis.ping();
  }

  private async checkOpenAI(): Promise<void> {
    await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Health check" }],
      max_tokens: 5,
    });
  }
}
```

## Deployment Architecture

### Docker Configuration

```dockerfile
# Dockerfile.backend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

USER nextjs

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Docker Compose for Development

```yaml
# docker-compose.yml
version: "3.8"

# Note: This is production/Docker configuration
# Development servers run on different ports:
# Frontend dev: localhost:5173, Backend dev: localhost:3001

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000" # Production port mapping
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - REACT_APP_API_URL=http://localhost:8000 # Points to Docker backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/ai_content_agent
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=ai_content_agent
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes Deployment

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-content-agent-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: ai-content-agent/backend:latest
          ports:
            - containerPort: 8000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-secret
                  key: url
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: openai-secret
                  key: api-key
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
```

## Scalability Considerations

### Horizontal Scaling

- **Stateless Services**: Tất cả services được thiết kế stateless
- **Load Balancing**: Nginx load balancer với health checks
- **Database Read Replicas**: PostgreSQL read replicas cho read-heavy operations
- **Redis Clustering**: Redis cluster cho high-availability caching

### Vertical Scaling

- **Resource Optimization**: Container resource limits và requests
- **Database Optimization**: Connection pooling, query optimization

### Auto-scaling

- **Horizontal Pod Autoscaler (HPA)**: Kubernetes HPA dựa trên CPU/memory metrics để scale pods horizontally
- **Vertical Pod Autoscaler (VPA)**: Tự động điều chỉnh resource requests/limits cho containers

### Cost Optimization

- **AI API Caching**: Cache AI responses để giảm API calls
- **Content Deduplication**: Detect và reuse similar content
- **Resource Monitoring**: Track và optimize infrastructure costs

---

**Document Version**: 1.0  
**Last Updated**: ${new Date().toLocaleDateString('vi-VN')}  
**Next Review**: Weekly during development phase
