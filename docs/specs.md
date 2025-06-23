# AI Content Agent - Specification Document

## Tổng quan dự án

**AI Content Agent** là một hệ thống tự động tạo và đăng bài blog cho WordPress và Facebook, được xây dựng dựa trên công nghệ AI hiện đại. Dự án nhằm mục đích cung cấp giải pháp marketing automation toàn diện cho các doanh nghiệp.

## Mục tiêu dự án

### Mục tiêu chính

1. **Tự động tạo nội dung**: Sử dụng LLMs để tạo ra nội dung chất lượng cao
2. **Đăng bài tự động**: Tích hợp với WordPress và Facebook APIs để đăng bài tự động
3. **Tối ưu hóa nội dung**: Sử dụng Vector DBs và LangChain để fine-tune nội dung
4. **Quản lý chiến dịch**: Cung cấp dashboard để theo dõi và quản lý các chiến dịch marketing

### Mục tiêu mở rộng

- Hỗ trợ thêm các nền tảng social media khác (Instagram, LinkedIn, Twitter)
- Tích hợp phân tích performance và insights
- Hỗ trợ đa ngôn ngữ
- Tính năng A/B testing cho nội dung

## Kiến trúc hệ thống

### Tech Stack

- **Backend**: Node.js 20+ với Express.js
- **Frontend**: React 18+ với TypeScript
- **Database**: Supabase (PostgreSQL 15+)
- **AI/ML**:
  - OpenAI GPT-4 cho content generation
  - LangChain cho workflow automation
  - Vector Database (Pinecone/Chroma) cho semantic search
- **APIs**:
  - WordPress REST API
  - Facebook Graph API
- **Infrastructure**:
  - Docker cho containerization
  - Redis cho caching
  - JWT cho authentication

### Kiến trúc microservices

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Auth Service  │
│   (React.js)    │◄──►│   (Express.js)  │◄──►│   (JWT)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                   ┌────────────┼────────────┐
                   │            │            │
         ┌─────────▼───┐ ┌──────▼──────┐ ┌───▼────────┐
         │ Content     │ │ Scheduler   │ │ Analytics  │
         │ Service     │ │ Service     │ │ Service    │
         └─────────────┘ └─────────────┘ └────────────┘
                   │            │            │
         ┌─────────▼───┐ ┌──────▼──────┐ ┌───▼────────┐
         │ AI Engine   │ │ Publishing  │ │ Database   │
         │ (LangChain) │ │ Service     │ │ (Supabase) │
         └─────────────┘ └─────────────┘ └────────────┘
```

## Tính năng chính

### 1. Content Generation Engine

- **AI Content Creation**: Tạo blog posts, social media captions
- **Content Templates**: Quản lý các template cho các loại nội dung khác nhau
- **Brand Voice Tuning**: Điều chỉnh tone và style theo từng brand
- **SEO Optimization**: Tự động tối ưu keyword và meta tags

### 2. Content Management System

- **Content Calendar**: Lên lịch đăng bài theo chiến lược marketing
- **Content Library**: Lưu trữ và quản lý nội dung đã tạo
- **Version Control**: Theo dõi các phiên bản của nội dung
- **Approval Workflow**: Quy trình duyệt nội dung trước khi đăng

### 3. Publishing Automation

- **WordPress Integration**:
  - Tự động đăng bài lên WordPress sites
  - Quản lý categories, tags, featured images
  - Hỗ trợ custom post types
- **Facebook Integration**:
  - Đăng lên Facebook Pages
  - Quản lý Facebook Posts với media
  - Targeting audience theo demographics

### 4. Analytics & Monitoring

- **Performance Tracking**: Theo dõi engagement, reach, clicks
- **AI Performance Analysis**: Đánh giá hiệu quả của nội dung được tạo bởi AI
- **ROI Measurement**: Tính toán return on investment
- **Real-time Monitoring**: Cảnh báo khi có vấn đề với publishing

### 5. User Management

- **Multi-tenant Architecture**: Hỗ trợ nhiều clients/brands
- **Role-based Access Control**: Phân quyền theo vai trò
- **Team Collaboration**: Làm việc nhóm trên cùng dự án
- **Client Portal**: Dashboard riêng cho từng client

## API Design

### Authentication

```typescript
interface AuthRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: User;
  expiresIn: number;
}
```

### Content APIs

```typescript
// Content Generation
POST /api/v1/content/generate
{
  "type": "blog_post" | "social_media",
  "topic": string,
  "brandVoice": BrandVoiceConfig,
  "targetAudience": string,
  "keywords": string[],
  "length": "short" | "medium" | "long"
}

// Content Management
GET /api/v1/content
POST /api/v1/content
PUT /api/v1/content/:id
DELETE /api/v1/content/:id
```

### Publishing APIs

```typescript
// WordPress Publishing
POST /api/v1/publish/wordpress
{
  "contentId": string,
  "siteUrl": string,
  "credentials": WordPressCredentials,
  "publishSettings": {
    "status": "draft" | "publish" | "scheduled",
    "scheduledDate": Date,
    "categories": string[],
    "tags": string[]
  }
}

// Facebook Publishing
POST /api/v1/publish/facebook
{
  "contentId": string,
  "pageId": string,
  "accessToken": string,
  "publishSettings": {
    "scheduled": boolean,
    "scheduledDate": Date,
    "targeting": FacebookTargeting
  }
}
```

## Database Schema

### Core Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects table (for multi-tenant)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Content table
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'blog_post', 'social_media'
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'approved', 'published'
  metadata JSONB,
  ai_generated BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Publishing logs
CREATE TABLE publishing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id),
  platform VARCHAR(50) NOT NULL, -- 'wordpress', 'facebook'
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'pending'
  external_id VARCHAR(255), -- ID from external platform
  published_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics table
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id),
  platform VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

## Security Requirements

### Authentication & Authorization

- JWT-based authentication với refresh tokens
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) cho admin accounts
- OAuth integration với Google/Microsoft

### Data Protection

- Encryption at rest cho sensitive data
- HTTPS enforced cho tất cả API calls
- API rate limiting và DDoS protection
- Regular security audits và penetration testing

### API Security

- API key management cho external integrations
- Input validation và sanitization
- SQL injection prevention
- XSS protection

## Performance Requirements

### Response Time

- API responses < 500ms cho 95% requests
- Content generation < 30 seconds
- Publishing actions < 10 seconds

### Scalability

- Hỗ trợ tối thiểu 1000 concurrent users
- Auto-scaling based on load
- Database optimization với indexing
- CDN cho static assets

### Availability

- 99.9% uptime target
- Monitoring và alerting systems
- Backup strategies (daily automated backups)
- Disaster recovery plan

## Integration Requirements

### WordPress Integration

- WordPress REST API authentication (Application Passwords)
- Support cho custom post types
- Media upload và management
- Plugin compatibility testing

### Facebook Integration

- Facebook Graph API v19.0+
- Page access tokens management
- Content approval workflow
- Compliance với Facebook policies

### AI/ML Integration

- OpenAI API rate limiting handling
- Vector database optimization
- Content quality scoring
- A/B testing framework

## Deployment Strategy

### Development Environment

### Port Configuration

**Development Ports:**

- Frontend Development Server: `http://localhost:5173` (Vite dev server)
- Backend Development Server: `http://localhost:3001`
- Database (PostgreSQL): `localhost:5432`
- Redis Cache: `localhost:6379`

**Production/Docker Ports:**

- Frontend: `3000` (Docker container)
- Backend: `8000` (Docker container)
- API Base URL: `https://api.aicontentagent.com/v1`

- Docker Compose setup
- Local database với seed data
- Hot reloading cho development

### Staging Environment

- Production-like environment
- Automated testing pipeline
- Performance testing

### Production Environment

- Multi-region deployment
- Load balancing
- Auto-scaling groups
- Monitoring và logging

## Testing Strategy

### Unit Testing

- Backend: Jest với >90% code coverage
- Frontend: React Testing Library
- API testing với Supertest

### Integration Testing

- Database integration tests
- External API integration tests
- End-to-end workflow testing

### Performance Testing

- Load testing với Artillery
- Stress testing cho AI components
- Database performance testing

## Compliance & Legal

### Data Privacy

- GDPR compliance
- Data retention policies
- User consent management
- Right to be forgotten implementation

### Content Policies

- Platform-specific content guidelines
- Copyright infringement prevention
- Spam prevention measures
- Content moderation workflows

## Success Metrics

### Technical Metrics

- API response times
- System uptime
- Error rates
- Content generation accuracy

### Business Metrics

- User engagement rates
- Content publishing success rate
- Customer acquisition cost
- Monthly recurring revenue (MRR)

### AI Performance Metrics

- Content quality scores
- SEO performance
- Social media engagement
- A/B testing results

## Timeline & Milestones

### Phase 1 (Months 1-3): Core Foundation

- Backend API development
- Database design và setup
- Basic frontend interface
- WordPress integration

### Phase 2 (Months 4-6): AI Integration

- LangChain integration
- Content generation engine
- Vector database setup
- Facebook integration

### Phase 3 (Months 7-9): Advanced Features

- Analytics dashboard
- Advanced scheduling
- Performance optimization
- Security hardening

### Phase 4 (Months 10-12): Production Ready

- Production deployment
- Monitoring setup
- Documentation completion
- User onboarding flow

## Risk Assessment

### Technical Risks

- AI API rate limits và costs
- External API changes
- Performance bottlenecks
- Security vulnerabilities

### Business Risks

- Market competition
- Platform policy changes
- Customer acquisition challenges
- Regulatory compliance

### Mitigation Strategies

- Multiple AI provider fallbacks
- Comprehensive testing
- Regular security audits
- Legal consultation

## Multi-Site Management Architecture

### Mục tiêu hệ thống

Xây dựng hệ thống quản lý đa trang web và đa nền tảng với khả năng:

1. **Multi-WordPress Sites Management**: Quản lý nhiều site WordPress
2. **Multi-Facebook Pages Management**: Quản lý nhiều Facebook pages
3. **Site-Specific AI Training**: Fine-tuning AI cho từng site riêng biệt
4. **Automated Content Pipeline**: Tự động tạo content phù hợp với từng site
5. **Performance Analytics per Site**: Theo dõi hiệu suất từng site/page

### Database Schema Mở Rộng

```sql
-- Sites Management (WordPress)
CREATE TABLE wordpress_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  site_url VARCHAR(500) NOT NULL,
  username VARCHAR(255) NOT NULL,
  application_password TEXT NOT NULL, -- encrypted
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, error
  settings JSONB DEFAULT '{}',
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Facebook Pages Management
CREATE TABLE facebook_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  page_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL, -- encrypted
  status VARCHAR(50) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Site-Specific AI Training Data
CREATE TABLE site_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID, -- Can reference wordpress_sites OR facebook_pages
  site_type VARCHAR(50) NOT NULL, -- 'wordpress' or 'facebook'
  approved_content_id UUID REFERENCES content(id),
  performance_metrics JSONB, -- engagement, clicks, conversions
  user_feedback INTEGER CHECK (user_feedback BETWEEN 1 AND 10),
  training_status VARCHAR(50) DEFAULT 'pending', -- pending, processed, used
  created_at TIMESTAMP DEFAULT NOW()
);

-- Site-Specific AI Models
CREATE TABLE site_ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  site_type VARCHAR(50) NOT NULL,
  model_version VARCHAR(100) NOT NULL,
  training_data_count INTEGER DEFAULT 0,
  performance_score NUMERIC(5,2),
  is_active BOOLEAN DEFAULT false,
  model_config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Content Generation Jobs (Site-Specific)
CREATE TABLE automated_content_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  site_type VARCHAR(50) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  generation_frequency VARCHAR(50), -- daily, weekly, monthly
  next_run_at TIMESTAMP,
  last_run_at TIMESTAMP,
  job_config JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Site Management API

```typescript
// WordPress Sites Management
POST /api/v1/sites/wordpress
{
  "name": "My Marketing Blog",
  "siteUrl": "https://myblog.com",
  "username": "admin",
  "applicationPassword": "xxxx xxxx xxxx xxxx",
  "settings": {
    "defaultCategory": "Marketing",
    "defaultStatus": "draft",
    "autoPublish": false,
    "contentTypes": ["blog_post"],
    "targetAudience": "Marketing professionals",
    "brandVoice": {
      "tone": "professional",
      "style": "conversational"
    }
  }
}

// Facebook Pages Management
POST /api/v1/sites/facebook
{
  "name": "Company Facebook Page",
  "pageId": "123456789",
  "accessToken": "EAABwzLixnjY...",
  "settings": {
    "autoPublish": true,
    "contentTypes": ["social_media"],
    "targetAudience": "Tech enthusiasts",
    "postingSchedule": {
      "frequency": "daily",
      "times": ["09:00", "15:00", "18:00"]
    }
  }
}

// Get all sites for a project
GET /api/v1/sites?projectId={projectId}

// Site-specific content generation
POST /api/v1/sites/{siteId}/generate-content
{
  "useSiteModel": true, // Use site-specific fine-tuned model
  "contentType": "blog_post",
  "topic": "AI Marketing Trends 2024",
  "sourceUrls": ["https://example.com/article"]
}
```

### Site-Specific AI Training System

```typescript
// services/SiteAITrainingService.ts
export class SiteAITrainingService {
  async collectTrainingData(
    siteId: string,
    siteType: "wordpress" | "facebook"
  ) {
    // 1. Collect approved content for this site
    const approvedContent = await this.getApprovedContent(siteId, siteType);

    // 2. Collect performance metrics
    const performanceData = await this.getPerformanceMetrics(siteId, siteType);

    // 3. Analyze successful patterns
    const patterns = await this.analyzeSuccessPatterns(
      approvedContent,
      performanceData
    );

    return patterns;
  }

  async trainSiteSpecificModel(siteId: string, siteType: string) {
    const trainingData = await this.collectTrainingData(siteId, siteType);

    if (trainingData.length < 10) {
      throw new Error(
        "Insufficient training data. Need at least 10 approved posts."
      );
    }

    // Create fine-tuning job
    const fineTuningJob = await this.createFineTuningJob({
      baseModel: "gpt-4-turbo",
      trainingData: trainingData,
      siteConfig: await this.getSiteConfig(siteId, siteType),
    });

    return fineTuningJob;
  }

  async generateContentWithSiteModel(siteId: string, request: ContentRequest) {
    // Check if site has trained model
    const siteModel = await this.getSiteModel(siteId);

    if (siteModel && siteModel.performance_score > 8.0) {
      // Use site-specific model
      return await this.generateWithSiteModel(siteModel, request);
    } else {
      // Use general model with site preferences
      return await this.generateWithSitePreferences(siteId, request);
    }
  }
}
```

### Automated Content Pipeline

```typescript
// services/AutomatedContentPipeline.ts
export class AutomatedContentPipeline {
  async setupAutomation(siteId: string, config: AutomationConfig) {
    // 1. Create automated job
    const job = await this.createAutomationJob({
      siteId,
      contentType: config.contentType,
      frequency: config.frequency, // daily, weekly, monthly
      sourceStrategy: config.sourceStrategy, // trending_topics, competitor_analysis, keyword_research
      generationSettings: config.generationSettings,
    });

    // 2. Schedule recurring job
    await this.scheduleRecurringJob(job);

    return job;
  }

  async executeAutomatedGeneration(jobId: string) {
    const job = await this.getJob(jobId);
    const site = await this.getSite(job.site_id, job.site_type);

    // 1. Research trending topics or source content
    const sources = await this.researchContentSources(job.job_config);

    // 2. Generate content using site-specific model
    const generatedContent = await this.generateContentBatch(sources, site);

    // 3. Quality check and review
    const qualityScores = await this.qualityCheck(generatedContent);

    // 4. Auto-publish high-quality content or queue for review
    for (const content of generatedContent) {
      if (content.qualityScore > 8.5 && site.settings.autoPublish) {
        await this.publishContent(content, site);
      } else {
        await this.queueForReview(content, site);
      }
    }
  }
}
```

### Site Performance Analytics

```typescript
// Multi-site analytics dashboard
GET /api/v1/analytics/sites-overview?projectId={projectId}
{
  "sites": [
    {
      "id": "site-1",
      "name": "Marketing Blog",
      "type": "wordpress",
      "metrics": {
        "totalPosts": 45,
        "avgQualityScore": 8.7,
        "avgEngagement": 5.2,
        "autoPublishRate": 65,
        "modelPerformance": 8.9
      },
      "lastActivity": "2024-01-20T15:30:00Z"
    },
    {
      "id": "page-1",
      "name": "Company Facebook",
      "type": "facebook",
      "metrics": {
        "totalPosts": 78,
        "avgQualityScore": 8.1,
        "avgEngagement": 7.8,
        "autoPublishRate": 85,
        "modelPerformance": 8.3
      },
      "lastActivity": "2024-01-20T16:45:00Z"
    }
  ],
  "overallMetrics": {
    "totalSites": 12,
    "totalContent": 567,
    "avgQualityScore": 8.4,
    "automationEfficiency": 78
  }
}
```

### Implementation Phases

#### Phase 1: Multi-Site Foundation (2-3 weeks)

- WordPress sites management interface
- Facebook pages management interface
- Site-specific settings and preferences
- Basic site connection and testing

#### Phase 2: Site-Specific Training (3-4 weeks)

- Approved content tracking per site
- Performance metrics collection
- Site-specific AI training pipeline
- Model performance evaluation

#### Phase 3: Automated Content Pipeline (4-5 weeks)

- Automated content generation jobs
- Quality-based auto-publishing
- Content scheduling and management
- Error handling and monitoring

#### Phase 4: Advanced Analytics & Optimization (2-3 weeks)

- Multi-site performance dashboard
- Site comparison and optimization suggestions
- A/B testing for content strategies
- ROI analytics per site

### Benefits của Architecture này

1. **Scalability**: Có thể quản lý hàng trăm sites/pages
2. **Personalization**: AI được fine-tune riêng cho từng site
3. **Efficiency**: Automated pipeline giảm manual work 90%
4. **Quality**: Site-specific training cải thiện content quality
5. **Analytics**: Deep insights cho optimization chiến lược

### Technical Considerations

- **Security**: Encrypted credentials, secure API access
- **Performance**: Efficient queuing system, background processing
- **Reliability**: Error handling, retry mechanisms, monitoring
- **Cost Optimization**: Intelligent AI provider selection, caching
- **Compliance**: Platform policies, content guidelines

---

**Tài liệu này sẽ được cập nhật thường xuyên khi có thay đổi trong yêu cầu hoặc implementation.**

**Phiên bản**: 1.0  
**Ngày tạo**: ${new Date().toLocaleDateString('vi-VN')}  
**Người tạo**: AI Assistant  
**Trạng thái**: Draft
