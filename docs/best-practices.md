# AI Content Agent - Best Practices & Guidelines

## Overview

Tài liệu này tổng hợp các best practices được nghiên cứu từ industry leaders và các platform hàng đầu về AI content generation, marketing automation, và social media publishing.

## AI Content Generation Best Practices

### 1. Prompt Engineering

#### Effective Prompt Structure

```javascript
const promptTemplate = `
ROLE: You are an expert {expertType} writer specialized in {industry}.

CONTEXT: {brandContext}
- Brand Voice: {tone}, {style}
- Target Audience: {audience}
- Industry: {industry}

TASK: Create a {contentType} about {topic}

REQUIREMENTS:
- Length: {wordCount} words
- Include keywords: {keywords}
- Tone: {tone}
- Style: {style}
- Include: {requiredElements}

CONSTRAINTS:
- Do not mention competitors
- Follow brand guidelines
- Ensure factual accuracy
- Include call-to-action

OUTPUT FORMAT:
{outputFormat}
`;
```

#### Advanced Prompting Techniques

**Chain-of-Thought Prompting:**

```javascript
const chainOfThoughtPrompt = `
Let's approach this step by step:

1. First, identify the main pain points of {targetAudience}
2. Then, explain how {topic} addresses each pain point
3. Provide specific examples and case studies
4. Conclude with actionable next steps

Think through each step before writing...
`;
```

**Few-Shot Learning:**

```javascript
const fewShotPrompt = `
Here are examples of our brand voice:

Example 1: "Marketing automation doesn't have to be complicated. Here's how to start simple and scale smart."

Example 2: "Your customers want personalized experiences. AI makes it possible without the complexity."

Now write a similar introduction for: {topic}
`;
```

### 2. Content Quality Optimization

#### AI Content Quality Scoring

```javascript
const qualityMetrics = {
  relevance: 0.25, // Topic relevance to audience
  originality: 0.2, // Uniqueness of content
  readability: 0.2, // Ease of reading
  engagement: 0.15, // Potential for engagement
  seoOptimization: 0.1, // SEO score
  brandAlignment: 0.1, // Brand voice consistency
};

function calculateQualityScore(content, metrics) {
  return Object.entries(metrics).reduce((score, [metric, weight]) => {
    return score + evaluateMetric(content, metric) * weight;
  }, 0);
}
```

#### Content Enhancement Techniques

**1. Semantic Enrichment:**

```javascript
async function enhanceContent(content, keywords) {
  // Use vector similarity to find related concepts
  const relatedConcepts = await vectorDb.findSimilar(keywords, {
    threshold: 0.8,
    limit: 10,
  });

  // Enhance content with semantically related terms
  return await llm.enhance(content, {
    relatedConcepts,
    diversity: 0.7,
    coherence: 0.9,
  });
}
```

**2. Multi-Model Validation:**

```javascript
async function validateContent(content) {
  const results = await Promise.all([
    gpt4.score(content, "quality"),
    claude.score(content, "accuracy"),
    gemini.score(content, "creativity"),
  ]);

  return {
    averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    consensus: results.every((r) => r.score > 7.0),
    recommendations: results.flatMap((r) => r.suggestions),
  };
}
```

### 3. Brand Voice Consistency

#### Brand Voice Configuration

```javascript
const brandVoiceConfig = {
  personality: {
    traits: ["professional", "approachable", "innovative"],
    values: ["transparency", "efficiency", "customer-success"],
    avoidance: ["overly-technical", "pushy-sales", "buzzwords"],
  },
  communication: {
    tone: "conversational",
    formality: "semi-formal",
    perspective: "second-person",
    technicalLevel: "intermediate",
  },
  structure: {
    sentenceLength: "varied",
    paragraphLength: "medium",
    headings: "descriptive",
    bullets: "action-oriented",
  },
};
```

#### Voice Validation System

```javascript
class BrandVoiceValidator {
  async validateContent(content, brandVoice) {
    const metrics = {
      toneConsistency: await this.analyzeTone(content, brandVoice.tone),
      vocabularyFit: await this.analyzeVocabulary(
        content,
        brandVoice.vocabulary
      ),
      structureAlignment: await this.analyzeStructure(
        content,
        brandVoice.structure
      ),
      valueAlignment: await this.analyzeValues(content, brandVoice.values),
    };

    return {
      overallScore: this.calculateOverallScore(metrics),
      suggestions: this.generateSuggestions(metrics),
      passesValidation: metrics.every((m) => m.score > 0.7),
    };
  }
}
```

## WordPress Integration Best Practices

### 1. Authentication & Security

#### Application Passwords Implementation

```javascript
class WordPressClient {
  constructor(config) {
    this.baseUrl = config.siteUrl;
    this.credentials = {
      username: config.username,
      applicationPassword: config.applicationPassword,
    };
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: "minute",
    });
  }

  async authenticateRequest(request) {
    // Use Application Passwords for secure authentication
    const authString = Buffer.from(
      `${this.credentials.username}:${this.credentials.applicationPassword}`
    ).toString("base64");

    request.headers.Authorization = `Basic ${authString}`;

    // Add rate limiting
    await this.rateLimiter.removeTokens(1);

    return request;
  }
}
```

#### Security Best Practices

```javascript
const securityConfig = {
  // Encrypt sensitive credentials
  encryption: {
    algorithm: "aes-256-gcm",
    keyDerivation: "pbkdf2",
    iterations: 100000,
  },

  // Validate SSL certificates
  httpsAgent: new https.Agent({
    rejectUnauthorized: true,
    checkServerIdentity: true,
  }),

  // Request validation
  validation: {
    maxContentLength: 10000000, // 10MB
    allowedFileTypes: ["jpg", "png", "gif", "webp"],
    sanitizeHtml: true,
  },
};
```

### 2. Content Optimization for WordPress

#### SEO-Optimized Publishing

```javascript
async function publishOptimizedPost(content, settings) {
  const optimizedContent = {
    title: content.title,
    content: content.body,
    excerpt: content.excerpt || generateExcerpt(content.body),

    // SEO optimization
    yoast_meta: {
      title: content.seoTitle || content.title,
      description: content.seoDescription || content.excerpt,
      canonical: settings.canonicalUrl,
      robots: {
        index: true,
        follow: true,
      },
    },

    // Categories and tags
    categories: await resolveCategories(settings.categories),
    tags: await resolveTags(settings.tags),

    // Media handling
    featured_media: await uploadFeaturedImage(content.featuredImage),

    // Publishing settings
    status: settings.status || "draft",
    date: settings.scheduledDate?.toISOString(),

    // Custom fields
    meta: {
      _custom_reading_time: calculateReadingTime(content.body),
      _content_quality_score: content.qualityScore,
      _ai_generated: content.aiGenerated,
    },
  };

  return await wpClient.posts.create(optimizedContent);
}
```

#### Media Management

```javascript
class MediaManager {
  async optimizeAndUpload(imageUrl, altText) {
    // Download and optimize image
    const imageBuffer = await this.downloadImage(imageUrl);
    const optimizedImage = await sharp(imageBuffer)
      .resize(1200, 630, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    // Upload to WordPress
    const media = await this.wpClient.media.create({
      file: optimizedImage,
      title: altText,
      alt_text: altText,
      description: altText,
    });

    return media.id;
  }

  async generateFeaturedImage(content) {
    // Generate AI image based on content
    const imagePrompt = `Create a professional blog featured image for: ${content.title}`;
    const imageUrl = await aiImageGenerator.create(imagePrompt);

    return await this.optimizeAndUpload(imageUrl, content.title);
  }
}
```

### 3. Error Handling & Retry Logic

#### Robust Error Handling

```javascript
class WordPressPublisher {
  async publishWithRetry(content, settings, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.publish(content, settings);

        // Log successful publish
        await this.logPublishEvent("success", {
          contentId: content.id,
          wordpressId: result.id,
          attempt,
        });

        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          await this.logPublishEvent("failed", {
            contentId: content.id,
            error: error.message,
            attempt,
            final: true,
          });
          throw error;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await this.sleep(delay);

        await this.logPublishEvent("retry", {
          contentId: content.id,
          error: error.message,
          attempt,
          nextRetryIn: delay,
        });
      }
    }
  }

  isRetryableError(error) {
    const retryableStatuses = [408, 429, 502, 503, 504];
    const retryableMessages = [
      "timeout",
      "network error",
      "connection reset",
      "rate limit",
    ];

    return (
      retryableStatuses.includes(error.status) ||
      retryableMessages.some((msg) => error.message.toLowerCase().includes(msg))
    );
  }
}
```

## Facebook Integration Best Practices

### 1. Graph API Optimization

#### Efficient API Usage

```javascript
class FacebookPublisher {
  constructor(config) {
    this.pageAccessToken = config.pageAccessToken;
    this.pageId = config.pageId;
    this.apiVersion = "v19.0";

    // Implement request batching
    this.batchQueue = [];
    this.batchSize = 50;
  }

  async publishPost(content, settings) {
    const postData = {
      message: content.body,
      published: settings.published ?? true,
      scheduled_publish_time: settings.scheduledDate
        ? Math.floor(settings.scheduledDate.getTime() / 1000)
        : undefined,

      // Audience targeting
      targeting: settings.targeting
        ? {
            geo_locations: {
              countries: settings.targeting.countries,
              cities: settings.targeting.cities,
            },
            age_min: settings.targeting.ageMin,
            age_max: settings.targeting.ageMax,
          }
        : undefined,

      // Call-to-action
      call_to_action: settings.cta
        ? {
            type: settings.cta.type,
            value: {
              link: settings.cta.link,
              link_title: settings.cta.title,
            },
          }
        : undefined,
    };

    // Handle media attachments
    if (content.media) {
      if (content.media.type === "photo") {
        return await this.publishPhoto(content, postData);
      } else if (content.media.type === "video") {
        return await this.publishVideo(content, postData);
      }
    }

    return await this.publishTextPost(postData);
  }

  async publishPhoto(content, postData) {
    const photoData = {
      url: content.media.url,
      caption: postData.message,
      published: postData.published,
      scheduled_publish_time: postData.scheduled_publish_time,
      targeting: postData.targeting,
    };

    const response = await this.makeApiCall(
      `/${this.pageId}/photos`,
      "POST",
      photoData
    );

    return {
      id: response.id,
      postId: response.post_id,
    };
  }
}
```

#### Rate Limiting & Compliance

```javascript
class FacebookRateLimiter {
  constructor() {
    this.limits = {
      posts: { count: 25, window: 3600000 }, // 25 posts per hour
      apiCalls: { count: 200, window: 3600000 }, // 200 calls per hour
      pages: { count: 5, window: 86400000 }, // 5 pages per day
    };

    this.usage = new Map();
  }

  async checkLimit(type, identifier) {
    const key = `${type}:${identifier}`;
    const now = Date.now();
    const limit = this.limits[type];

    if (!this.usage.has(key)) {
      this.usage.set(key, []);
    }

    const usage = this.usage.get(key);

    // Remove old entries outside the window
    const validEntries = usage.filter(
      (timestamp) => now - timestamp < limit.window
    );

    if (validEntries.length >= limit.count) {
      const oldestEntry = Math.min(...validEntries);
      const waitTime = limit.window - (now - oldestEntry);
      throw new RateLimitError(`Rate limit exceeded. Wait ${waitTime}ms`);
    }

    validEntries.push(now);
    this.usage.set(key, validEntries);
  }
}
```

### 2. Content Optimization for Facebook

#### Engagement-Optimized Content

```javascript
function optimizeForFacebook(content) {
  return {
    // Optimal post length for Facebook
    message: truncateText(content.body, 200),

    // Include engaging elements
    engagement: {
      includeEmojis: true,
      askQuestion: content.type === "engagement",
      includeHashtags: content.keywords?.slice(0, 3).map((k) => `#${k}`) || [],
      callToAction: generateCTA(content.type),
    },

    // Visual optimization
    media: content.media
      ? {
          ...content.media,
          optimizedForMobile: true,
          aspectRatio: "1.91:1", // Facebook recommended
        }
      : null,

    // Timing optimization
    scheduling: {
      optimalTimes: ["12:00", "15:00", "18:00"], // Based on audience analysis
      timezone: content.targetTimezone || "UTC",
    },
  };
}

function generateCTA(contentType) {
  const ctas = {
    blog: "Read the full article",
    product: "Learn more",
    event: "Get tickets",
    video: "Watch now",
    engagement: "Share your thoughts",
  };

  return ctas[contentType] || "Learn more";
}
```

#### Facebook-Specific Analytics

```javascript
class FacebookAnalytics {
  async getPostInsights(postId) {
    const insights = await this.makeApiCall(`/${postId}/insights`, "GET", {
      metric: [
        "post_impressions",
        "post_impressions_unique",
        "post_engagements",
        "post_reactions",
        "post_clicks",
        "post_shares",
        "post_comments",
        "post_video_views", // for video posts
      ].join(","),
    });

    return this.formatInsights(insights.data);
  }

  formatInsights(rawData) {
    const formatted = {};

    rawData.forEach((metric) => {
      formatted[metric.name] = {
        value: metric.values[0]?.value || 0,
        endTime: metric.values[0]?.end_time,
        title: metric.title,
        description: metric.description,
      };
    });

    // Calculate engagement rate
    formatted.engagement_rate = {
      value:
        (formatted.post_engagements.value / formatted.post_impressions.value) *
        100,
      description: "Engagement rate as percentage of impressions",
    };

    return formatted;
  }
}
```

## Marketing Automation Best Practices

### 1. Content Strategy & Planning

#### AI-Driven Content Calendar

```javascript
class ContentCalendar {
  async generateCalendar(config) {
    const {
      duration = 30, // days
      frequency = 3, // posts per week
      brandVoice,
      targetAudience,
      businessGoals,
    } = config;

    // Analyze trending topics
    const trendingTopics = await this.analyzeTrends(config.industry);

    // Generate content themes
    const themes = await this.generateThemes({
      trends: trendingTopics,
      audience: targetAudience,
      goals: businessGoals,
    });

    // Create posting schedule
    const schedule = this.createPostingSchedule(duration, frequency);

    // Generate content ideas for each slot
    const calendar = await Promise.all(
      schedule.map(async (slot) => {
        const theme = this.selectTheme(themes, slot);
        const contentIdea = await this.generateContentIdea(theme, brandVoice);

        return {
          date: slot.date,
          platform: slot.platform,
          theme: theme.name,
          contentIdea,
          status: "planned",
        };
      })
    );

    return calendar;
  }
}
```

#### Performance-Based Optimization

```javascript
class PerformanceOptimizer {
  async optimizeContent(historicalData) {
    // Analyze top-performing content
    const topContent = historicalData
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 10);

    // Extract patterns
    const patterns = {
      optimalLength: this.analyzeLength(topContent),
      bestTopics: this.analyzeTopics(topContent),
      effectiveKeywords: this.analyzeKeywords(topContent),
      successfulFormats: this.analyzeFormats(topContent),
      optimalTiming: this.analyzeTiming(topContent),
    };

    // Generate recommendations
    return {
      contentRecommendations: await this.generateRecommendations(patterns),
      schedulingRecommendations: patterns.optimalTiming,
      keywordRecommendations: patterns.effectiveKeywords,
    };
  }

  analyzeLength(content) {
    const lengths = content.map((c) => c.wordCount);
    return {
      average: lengths.reduce((sum, l) => sum + l, 0) / lengths.length,
      optimal: this.findOptimalRange(
        lengths,
        content.map((c) => c.engagementRate)
      ),
    };
  }
}
```

### 2. Multi-Platform Coordination

#### Cross-Platform Content Adaptation

```javascript
class PlatformAdapter {
  async adaptContent(content, platforms) {
    const adaptations = {};

    for (const platform of platforms) {
      adaptations[platform] = await this.adaptForPlatform(content, platform);
    }

    return adaptations;
  }

  async adaptForPlatform(content, platform) {
    const platformRules = {
      wordpress: {
        maxLength: 3000,
        includeHeadings: true,
        seoOptimization: true,
        imageRequirement: "featured",
      },
      facebook: {
        maxLength: 200,
        includeEmojis: true,
        visualFocus: true,
        engagementHooks: true,
      },
      linkedin: {
        maxLength: 300,
        professionalTone: true,
        industryInsights: true,
        hashtags: 3,
      },
      twitter: {
        maxLength: 280,
        threads: true,
        hashtags: 2,
        brevity: true,
      },
    };

    const rules = platformRules[platform];

    return {
      title: await this.adaptTitle(content.title, rules),
      body: await this.adaptBody(content.body, rules),
      media: await this.adaptMedia(content.media, rules),
      metadata: await this.adaptMetadata(content.metadata, rules),
    };
  }
}
```

#### Synchronized Publishing Strategy

```javascript
class PublishingOrchestrator {
  async orchestratePublishing(content, platforms, strategy) {
    const publishingPlan = this.createPublishingPlan(platforms, strategy);

    for (const phase of publishingPlan) {
      await this.executePhase(content, phase);

      if (phase.waitTime) {
        await this.sleep(phase.waitTime);
      }
    }
  }

  createPublishingPlan(platforms, strategy) {
    const strategies = {
      simultaneous: [{ platforms: platforms, timing: "immediate" }],

      sequential: platforms.map((platform, index) => ({
        platforms: [platform],
        timing: "immediate",
        waitTime: index > 0 ? 15 * 60 * 1000 : 0, // 15 minutes between
      })),

      priority: [
        { platforms: ["wordpress"], timing: "immediate" },
        {
          platforms: ["facebook", "linkedin"],
          timing: "immediate",
          waitTime: 30 * 60 * 1000,
        },
        {
          platforms: ["twitter"],
          timing: "immediate",
          waitTime: 60 * 60 * 1000,
        },
      ],
    };

    return strategies[strategy] || strategies.sequential;
  }
}
```

### 3. Analytics & Insights

#### Comprehensive Performance Tracking

```javascript
class AnalyticsAggregator {
  async aggregatePerformance(contentId, timeRange) {
    const platformData = await Promise.all([
      this.getWordPressAnalytics(contentId, timeRange),
      this.getFacebookAnalytics(contentId, timeRange),
      this.getLinkedInAnalytics(contentId, timeRange),
    ]);

    return {
      totalReach: platformData.reduce((sum, data) => sum + data.reach, 0),
      totalEngagement: platformData.reduce(
        (sum, data) => sum + data.engagement,
        0
      ),
      averageEngagementRate: this.calculateAverageEngagementRate(platformData),
      bestPerformingPlatform: this.findBestPlatform(platformData),
      contentQualityScore: await this.calculateQualityScore(contentId),
      roiAnalysis: await this.calculateROI(contentId, platformData),
    };
  }

  async generateInsights(aggregatedData) {
    const insights = {
      performanceInsights: this.analyzePerformance(aggregatedData),
      audienceInsights: await this.analyzeAudience(aggregatedData),
      contentInsights: this.analyzeContent(aggregatedData),
      timingInsights: this.analyzeTiming(aggregatedData),
      recommendations: await this.generateRecommendations(aggregatedData),
    };

    return insights;
  }
}
```

## Security & Compliance Best Practices

### 1. Data Protection

#### Encryption Standards

```javascript
class EncryptionManager {
  constructor() {
    this.algorithm = "aes-256-gcm";
    this.keyDerivation = "scrypt";
  }

  async encryptCredentials(credentials, userKey) {
    const salt = crypto.randomBytes(32);
    const key = await this.deriveKey(userKey, salt);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(this.algorithm, key, { iv });

    let encrypted = cipher.update(JSON.stringify(credentials), "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      algorithm: this.algorithm,
    };
  }

  async deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 32, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }
}
```

### 2. Platform Compliance

#### GDPR Compliance

```javascript
class GDPRManager {
  async handleDataRequest(userId, requestType) {
    switch (requestType) {
      case "access":
        return await this.exportUserData(userId);

      case "deletion":
        return await this.deleteUserData(userId);

      case "portability":
        return await this.exportUserDataPortable(userId);

      case "rectification":
        return await this.updateUserData(userId);

      default:
        throw new Error("Invalid GDPR request type");
    }
  }

  async exportUserData(userId) {
    const userData = {
      profile: await this.getUserProfile(userId),
      content: await this.getUserContent(userId),
      analytics: await this.getUserAnalytics(userId),
      connections: await this.getUserConnections(userId, { encrypted: false }),
      logs: await this.getUserLogs(userId),
    };

    return {
      data: userData,
      exportDate: new Date().toISOString(),
      format: "JSON",
      requestedBy: userId,
    };
  }
}
```

### 3. Platform Policy Compliance

#### Content Policy Validation

```javascript
class ContentPolicyValidator {
  async validateContent(content, platform) {
    const validators = {
      facebook: this.validateFacebookContent,
      wordpress: this.validateWordPressContent,
      linkedin: this.validateLinkedInContent,
    };

    const validator = validators[platform];
    if (!validator) {
      throw new Error(`No validator for platform: ${platform}`);
    }

    return await validator.call(this, content);
  }

  async validateFacebookContent(content) {
    const violations = [];

    // Check for prohibited content
    if (await this.containsProhibitedContent(content.body)) {
      violations.push("Contains prohibited content");
    }

    // Check for spam indicators
    if (this.detectSpamPatterns(content.body)) {
      violations.push("Potential spam content detected");
    }

    // Check image compliance
    if (content.media && !(await this.validateImage(content.media))) {
      violations.push("Image does not meet platform guidelines");
    }

    return {
      compliant: violations.length === 0,
      violations,
      recommendations: this.generateComplianceRecommendations(violations),
    };
  }
}
```

## Performance Optimization Best Practices

### 1. Database Optimization

#### Query Optimization

```sql
-- Efficient content retrieval with proper indexing
CREATE INDEX CONCURRENTLY idx_content_project_status_created
ON content (project_id, status, created_at DESC);

-- Analytics data partitioning
CREATE TABLE analytics_snapshots_y2024 PARTITION OF analytics_snapshots
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Vector similarity search optimization
CREATE INDEX CONCURRENTLY idx_embeddings_similarity
ON content_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Optimized analytics query
SELECT
  c.id,
  c.title,
  c.created_at,
  AVG(a.metrics->>'engagement_rate')::numeric as avg_engagement,
  COUNT(pj.id) as total_publishes
FROM content c
LEFT JOIN publishing_jobs pj ON c.id = pj.content_id
LEFT JOIN analytics_snapshots a ON pj.id = a.publishing_job_id
WHERE c.project_id = $1
  AND c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.id, c.title, c.created_at
ORDER BY avg_engagement DESC NULLS LAST
LIMIT 20;
```

#### Caching Strategy

```javascript
class CacheStrategy {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.ttls = {
      content: 3600, // 1 hour
      analytics: 1800, // 30 minutes
      aiResponses: 7200, // 2 hours
      userSessions: 86400, // 24 hours
    };
  }

  async cacheAIResponse(prompt, response) {
    const key = this.generatePromptKey(prompt);
    await this.redis.setex(
      `ai:${key}`,
      this.ttls.aiResponses,
      JSON.stringify(response)
    );
  }

  async getCachedAIResponse(prompt) {
    const key = this.generatePromptKey(prompt);
    const cached = await this.redis.get(`ai:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  generatePromptKey(prompt) {
    return crypto.createHash("sha256").update(prompt).digest("hex");
  }
}
```

### 2. API Performance

#### Rate Limiting & Throttling

```javascript
class APIThrottler {
  constructor() {
    this.limits = new Map();
    this.queues = new Map();
  }

  async throttle(key, limit, window) {
    if (!this.limits.has(key)) {
      this.limits.set(key, []);
    }

    const timestamps = this.limits.get(key);
    const now = Date.now();

    // Remove old entries
    const validTimestamps = timestamps.filter((t) => now - t < window);
    this.limits.set(key, validTimestamps);

    if (validTimestamps.length >= limit) {
      const waitTime = window - (now - validTimestamps[0]);
      await this.delay(waitTime);
      return this.throttle(key, limit, window);
    }

    validTimestamps.push(now);
    this.limits.set(key, validTimestamps);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 3. Monitoring & Alerting

#### Comprehensive Monitoring

```javascript
class MonitoringSystem {
  constructor() {
    this.metrics = new prometheus.Registry();
    this.setupMetrics();
  }

  setupMetrics() {
    this.apiDuration = new prometheus.Histogram({
      name: "api_request_duration_seconds",
      help: "API request duration",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    this.aiGenerationDuration = new prometheus.Histogram({
      name: "ai_generation_duration_seconds",
      help: "AI content generation duration",
      labelNames: ["model", "content_type"],
      buckets: [1, 5, 10, 30, 60, 120],
    });

    this.publishingSuccess = new prometheus.Counter({
      name: "publishing_success_total",
      help: "Successful publishing operations",
      labelNames: ["platform"],
    });

    this.publishingErrors = new prometheus.Counter({
      name: "publishing_errors_total",
      help: "Failed publishing operations",
      labelNames: ["platform", "error_type"],
    });
  }

  recordAPIRequest(method, route, statusCode, duration) {
    this.apiDuration
      .labels(method, route, statusCode.toString())
      .observe(duration);
  }

  recordAIGeneration(model, contentType, duration) {
    this.aiGenerationDuration.labels(model, contentType).observe(duration);
  }
}
```

---

**Document Version**: 1.0  
**Last Updated**: ${new Date().toLocaleDateString('vi-VN')}  
**Sources**: OpenAI Best Practices, WordPress Developer Handbook, Facebook Developer Docs, Industry Research  
**Next Review**: Monthly
