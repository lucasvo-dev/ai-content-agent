# AI Content Agent - API Documentation

## API Overview

**Base URL**: `https://api.aicontentagent.com/v1`  
**Authentication**: Bearer Token (JWT)  
**Content Type**: `application/json`  
**API Version**: v1

## Authentication

### POST /auth/login

Authenticate user và nhận access token.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "def502003b7b9c...",
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user"
    },
    "expiresIn": 900
  }
}
```

### POST /auth/register

Đăng ký tài khoản mới.

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

### POST /auth/refresh

Refresh access token bằng refresh token.

**Request Body:**

```json
{
  "refreshToken": "def502003b7b9c..."
}
```

### POST /auth/logout

Logout và invalidate tokens.

**Headers:**

```
Authorization: Bearer <access_token>
```

## SSO Authentication

### GET /auth/sso/status

Kiểm tra trạng thái SSO và các provider có sẵn.

**Response:**

```json
{
  "success": true,
  "data": {
    "google": {
      "available": true,
      "loginUrl": "/api/v1/auth/google"
    },
    "microsoft": {
      "available": true,
      "loginUrl": "/api/v1/auth/microsoft"
    }
  },
  "message": "SSO status retrieved successfully"
}
```

### GET /auth/google

Khởi tạo Google OAuth flow. Redirect user đến Google consent screen.

**Parameters:**

- Automatically redirects to Google OAuth consent page

### GET /auth/google/callback

Google OAuth callback endpoint. Handles Google OAuth response và tạo JWT tokens.

**Response (JSON API):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "google-mock-123456789",
      "email": "user@gmail.com",
      "name": "John Doe",
      "role": "user",
      "provider": "google",
      "providerId": "123456789",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "def502003b7b9c...",
    "expiresIn": 900,
    "isNewUser": false
  },
  "message": "Google SSO login successful"
}
```

**Response (Web Redirect):**

- Redirects to: `{FRONTEND_URL}/auth/sso-callback?token={jwt}&refresh={refreshToken}&provider=google`

### GET /auth/microsoft

Khởi tạo Microsoft OAuth flow. Redirect user đến Microsoft/Azure AD consent screen.

**Parameters:**

- Automatically redirects to Microsoft OAuth consent page

### GET /auth/microsoft/callback

Microsoft OAuth callback endpoint. Handles Microsoft OAuth response và tạo JWT tokens.

**Response (JSON API):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "microsoft-mock-987654321",
      "email": "user@outlook.com",
      "name": "Jane Smith",
      "role": "user",
      "provider": "microsoft",
      "providerId": "987654321",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "def502003b7b9c...",
    "expiresIn": 900,
    "isNewUser": true
  },
  "message": "Microsoft SSO login successful"
}
```

**Response (Web Redirect):**

- Redirects to: `{FRONTEND_URL}/auth/sso-callback?token={jwt}&refresh={refreshToken}&provider=microsoft`

## User Management

### GET /users/profile

Lấy thông tin profile của user hiện tại.

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "emailVerified": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### PUT /users/profile

Cập nhật thông tin profile.

**Request Body:**

```json
{
  "firstName": "John Updated",
  "lastName": "Doe Updated"
}
```

## Project Management

### GET /projects

Lấy danh sách các projects của user.

**Query Parameters:**

- `limit` (number, optional): Số lượng projects trả về (default: 20, max: 100)
- `offset` (number, optional): Offset cho pagination (default: 0)
- `search` (string, optional): Tìm kiếm theo tên project

**Response:**

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "456e7890-e89b-12d3-a456-426614174001",
        "name": "Marketing Blog",
        "description": "AI-generated content for marketing blog",
        "ownerId": "123e4567-e89b-12d3-a456-426614174000",
        "settings": {
          "defaultBrandVoice": {
            "tone": "professional",
            "style": "conversational"
          }
        },
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

### POST /projects

Tạo project mới.

**Request Body:**

```json
{
  "name": "New Marketing Project",
  "description": "Project for automated marketing content",
  "settings": {
    "defaultBrandVoice": {
      "tone": "professional",
      "style": "conversational",
      "vocabulary": "industry-specific",
      "length": "comprehensive"
    },
    "targetAudience": "Marketing professionals",
    "defaultKeywords": ["marketing", "automation", "AI"]
  }
}
```

### GET /projects/:projectId

Lấy thông tin chi tiết của một project.

### PUT /projects/:projectId

Cập nhật thông tin project.

### DELETE /projects/:projectId

Xóa project (chỉ owner mới có quyền).

## Content Management

### POST /content/generate

Tạo content mới bằng AI.

**Request Body:**

```json
{
  "projectId": "456e7890-e89b-12d3-a456-426614174001",
  "type": "blog_post",
  "topic": "The Future of AI in Marketing Automation",
  "brandVoice": {
    "tone": "professional",
    "style": "conversational",
    "vocabulary": "industry-specific",
    "length": "comprehensive"
  },
  "targetAudience": "Marketing professionals and business owners",
  "keywords": [
    "AI",
    "marketing automation",
    "content strategy",
    "personalization"
  ],
  "requirements": {
    "wordCount": "1500-2000",
    "includeHeadings": true,
    "includeCTA": true,
    "seoOptimized": true
  },
  "context": "Write for a marketing technology blog focused on helping mid-size businesses adopt AI tools"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "789e1234-e89b-12d3-a456-426614174002",
    "title": "The Future of AI in Marketing Automation: A Game-Changer for Modern Businesses",
    "body": "In today's rapidly evolving digital landscape, artificial intelligence...",
    "excerpt": "Discover how AI is revolutionizing marketing automation...",
    "type": "blog_post",
    "status": "draft",
    "metadata": {
      "seoTitle": "AI in Marketing Automation: Future Trends & Benefits",
      "seoDescription": "Explore the transformative impact of AI on marketing automation...",
      "keywords": [
        "AI",
        "marketing automation",
        "content strategy",
        "personalization"
      ],
      "wordCount": 1847,
      "readingTime": 7,
      "seoScore": 92,
      "aiModel": "gpt-4-turbo-preview",
      "promptVersion": "1.0"
    },
    "aiGenerated": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /content

Lấy danh sách content.

**Query Parameters:**

- `projectId` (string, required): ID của project
- `type` (string, optional): Loại content (`blog_post`, `social_media`)
- `status` (string, optional): Trạng thái (`draft`, `approved`, `published`)
- `search` (string, optional): Tìm kiếm trong title và body
- `limit` (number, optional): Số lượng items (default: 20, max: 100)
- `offset` (number, optional): Offset cho pagination
- `sortBy` (string, optional): Sort field (`createdAt`, `updatedAt`, `title`)
- `sortOrder` (string, optional): Sort order (`asc`, `desc`)

**Response:**

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "789e1234-e89b-12d3-a456-426614174002",
        "title": "The Future of AI in Marketing Automation",
        "excerpt": "Discover how AI is revolutionizing marketing automation...",
        "type": "blog_post",
        "status": "draft",
        "wordCount": 1847,
        "seoScore": 92,
        "aiGenerated": true,
        "createdBy": {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "firstName": "John",
          "lastName": "Doe"
        },
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

### GET /content/:contentId

Lấy chi tiết content.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "789e1234-e89b-12d3-a456-426614174002",
    "projectId": "456e7890-e89b-12d3-a456-426614174001",
    "title": "The Future of AI in Marketing Automation",
    "body": "Full content body here...",
    "excerpt": "Content excerpt...",
    "type": "blog_post",
    "status": "draft",
    "metadata": {
      "seoTitle": "AI in Marketing Automation: Future Trends",
      "seoDescription": "Explore the transformative impact...",
      "keywords": ["AI", "marketing automation"],
      "wordCount": 1847,
      "readingTime": 7,
      "seoScore": 92,
      "aiModel": "gpt-4-turbo-preview",
      "promptVersion": "1.0",
      "brandVoice": {
        "tone": "professional",
        "style": "conversational"
      }
    },
    "aiGenerated": true,
    "createdBy": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "firstName": "John",
      "lastName": "Doe"
    },
    "versions": [
      {
        "versionNumber": 1,
        "createdAt": "2024-01-15T10:30:00Z",
        "changes": "Initial AI generation"
      }
    ],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### PUT /content/:contentId

Cập nhật content.

**Request Body:**

```json
{
  "title": "Updated title",
  "body": "Updated content body...",
  "excerpt": "Updated excerpt",
  "status": "approved",
  "metadata": {
    "seoTitle": "Updated SEO title",
    "seoDescription": "Updated SEO description"
  }
}
```

### DELETE /content/:contentId

Xóa content.

### POST /content/:contentId/duplicate

Tạo bản copy của content.

### POST /content/:contentId/regenerate

Regenerate content bằng AI với prompt mới.

**Request Body:**

```json
{
  "prompt": "Rewrite this content with a more casual tone",
  "preserveStructure": true,
  "brandVoice": {
    "tone": "casual",
    "style": "conversational"
  }
}
```

## Platform Connections

### GET /connections

Lấy danh sách platform connections.

**Query Parameters:**

- `projectId` (string, required): ID của project
- `platform` (string, optional): Filter theo platform (`wordpress`, `facebook`)

**Response:**

```json
{
  "success": true,
  "data": {
    "connections": [
      {
        "id": "abc123-def456-ghi789",
        "projectId": "456e7890-e89b-12d3-a456-426614174001",
        "platform": "wordpress",
        "name": "Main Blog",
        "settings": {
          "siteUrl": "https://myblog.com",
          "defaultCategory": "Marketing",
          "defaultStatus": "draft"
        },
        "isActive": true,
        "lastTested": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### POST /connections

Tạo platform connection mới.

**Request Body:**

```json
{
  "projectId": "456e7890-e89b-12d3-a456-426614174001",
  "platform": "wordpress",
  "name": "Main Blog",
  "credentials": {
    "siteUrl": "https://myblog.com",
    "username": "admin",
    "applicationPassword": "xxxx xxxx xxxx xxxx"
  },
  "settings": {
    "defaultCategory": "Marketing",
    "defaultStatus": "draft",
    "autoPublish": false
  }
}
```

### PUT /connections/:connectionId

Cập nhật platform connection.

### DELETE /connections/:connectionId

Xóa platform connection.

### POST /connections/:connectionId/test

Test connection để verify credentials.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "connected",
    "message": "Connection successful",
    "details": {
      "siteTitle": "My Marketing Blog",
      "siteUrl": "https://myblog.com",
      "wordpressVersion": "6.4.2",
      "availableCategories": [
        { "id": 1, "name": "Marketing" },
        { "id": 2, "name": "Technology" }
      ]
    }
  }
}
```

## Publishing

### POST /publishing/schedule

Lên lịch đăng bài.

**Request Body:**

```json
{
  "contentId": "789e1234-e89b-12d3-a456-426614174002",
  "connectionId": "abc123-def456-ghi789",
  "scheduledDate": "2024-01-20T15:00:00Z",
  "settings": {
    "status": "publish",
    "categories": ["Marketing", "AI"],
    "tags": ["artificial intelligence", "marketing automation"],
    "featuredImage": {
      "url": "https://example.com/image.jpg",
      "alt": "AI Marketing illustration"
    },
    "customFields": {
      "author_bio": "John is a marketing automation expert"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "job_abc123def456",
    "contentId": "789e1234-e89b-12d3-a456-426614174002",
    "connectionId": "abc123-def456-ghi789",
    "status": "scheduled",
    "scheduledDate": "2024-01-20T15:00:00Z",
    "estimatedPublishTime": "2024-01-20T15:00:30Z",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /publishing/jobs

Lấy danh sách publishing jobs.

**Query Parameters:**

- `projectId` (string, required): ID của project
- `status` (string, optional): Filter theo status (`scheduled`, `publishing`, `published`, `failed`)
- `platform` (string, optional): Filter theo platform
- `limit` (number, optional): Số lượng items
- `offset` (number, optional): Offset cho pagination

**Response:**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "job_abc123def456",
        "contentId": "789e1234-e89b-12d3-a456-426614174002",
        "contentTitle": "The Future of AI in Marketing Automation",
        "platform": "wordpress",
        "connectionName": "Main Blog",
        "status": "published",
        "scheduledDate": "2024-01-20T15:00:00Z",
        "publishedDate": "2024-01-20T15:00:15Z",
        "externalId": "142",
        "externalUrl": "https://myblog.com/ai-marketing-automation",
        "retryCount": 0,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-20T15:00:15Z"
      }
    ],
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

### GET /publishing/jobs/:jobId

Lấy chi tiết publishing job.

### PUT /publishing/jobs/:jobId

Cập nhật publishing job (reschedule, cancel).

**Request Body:**

```json
{
  "action": "reschedule",
  "scheduledDate": "2024-01-21T15:00:00Z"
}
```

### POST /publishing/jobs/:jobId/retry

Retry failed publishing job.

### DELETE /publishing/jobs/:jobId

Cancel scheduled publishing job.

## Analytics

### GET /analytics/overview

Lấy overview analytics cho project.

**Query Parameters:**

- `projectId` (string, required): ID của project
- `dateFrom` (string, optional): Start date (ISO 8601)
- `dateTo` (string, optional): End date (ISO 8601)
- `platform` (string, optional): Filter theo platform

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalContent": 25,
      "publishedContent": 18,
      "totalViews": 15420,
      "totalEngagement": 892,
      "averageEngagementRate": 5.8,
      "topPerformingPlatform": "wordpress"
    },
    "contentPerformance": [
      {
        "contentId": "789e1234-e89b-12d3-a456-426614174002",
        "title": "The Future of AI in Marketing Automation",
        "platform": "wordpress",
        "views": 1250,
        "engagement": 67,
        "engagementRate": 5.36,
        "publishedDate": "2024-01-20T15:00:15Z"
      }
    ],
    "platformMetrics": {
      "wordpress": {
        "totalPosts": 12,
        "totalViews": 8420,
        "averageViews": 701,
        "totalComments": 234
      },
      "facebook": {
        "totalPosts": 6,
        "totalReach": 7000,
        "totalEngagement": 658,
        "averageEngagementRate": 9.4
      }
    }
  }
}
```

### GET /analytics/content/:contentId

Lấy detailed analytics cho một content.

**Response:**

```json
{
  "success": true,
  "data": {
    "contentId": "789e1234-e89b-12d3-a456-426614174002",
    "title": "The Future of AI in Marketing Automation",
    "platforms": {
      "wordpress": {
        "postId": "142",
        "url": "https://myblog.com/ai-marketing-automation",
        "publishedDate": "2024-01-20T15:00:15Z",
        "metrics": {
          "views": 1250,
          "comments": 15,
          "shares": 23,
          "averageReadTime": "4:32",
          "bounceRate": 0.35,
          "seoScore": 92
        },
        "timeSeriesData": [
          {
            "date": "2024-01-20",
            "views": 245,
            "comments": 3
          }
        ]
      }
    },
    "aiMetrics": {
      "contentQualityScore": 8.7,
      "seoOptimizationScore": 9.2,
      "readabilityScore": 8.1,
      "engagementPrediction": 6.8
    }
  }
}
```

### GET /analytics/trends

Lấy trending metrics và insights.

**Response:**

```json
{
  "success": true,
  "data": {
    "contentTrends": {
      "topTopics": [
        { "topic": "AI Marketing", "count": 5, "avgEngagement": 7.2 },
        { "topic": "Automation", "count": 3, "avgEngagement": 6.8 }
      ],
      "topKeywords": [
        {
          "keyword": "artificial intelligence",
          "frequency": 12,
          "performance": 8.1
        },
        {
          "keyword": "marketing automation",
          "frequency": 8,
          "performance": 7.9
        }
      ]
    },
    "performanceInsights": {
      "bestPerformingContentType": "blog_post",
      "optimalPostingTimes": {
        "wordpress": ["09:00", "14:00", "16:00"],
        "facebook": ["12:00", "18:00", "20:00"]
      },
      "contentLengthOptimal": {
        "blog_post": "1500-2000",
        "social_media": "100-150"
      }
    }
  }
}
```

## AI & Templates

### GET /ai/models

Lấy danh sách AI models available.

**Response:**

```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "gpt-4-turbo-preview",
        "name": "GPT-4 Turbo",
        "provider": "openai",
        "capabilities": ["text-generation", "content-optimization"],
        "costPerToken": 0.00001,
        "maxTokens": 4096,
        "recommended": true
      }
    ]
  }
}
```

### POST /ai/analyze-content

Phân tích content quality bằng AI.

**Request Body:**

```json
{
  "content": "Full content text here...",
  "analysisType": ["quality", "seo", "readability", "engagement"]
}
```

### GET /templates

Lấy danh sách content templates.

**Response:**

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "blog-post-template-1",
        "name": "Marketing Blog Post",
        "type": "blog_post",
        "description": "Template for marketing-focused blog posts",
        "structure": {
          "sections": ["introduction", "main-points", "conclusion", "cta"],
          "requiredElements": ["title", "meta-description", "headers"]
        },
        "brandVoice": {
          "tone": "professional",
          "style": "conversational"
        },
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### POST /templates

Tạo template mới.

### GET /templates/:templateId

Lấy chi tiết template.

### PUT /templates/:templateId

Cập nhật template.

### DELETE /templates/:templateId

Xóa template.

## Webhooks

### GET /webhooks

Lấy danh sách webhooks.

### POST /webhooks

Tạo webhook mới.

**Request Body:**

```json
{
  "projectId": "456e7890-e89b-12d3-a456-426614174001",
  "url": "https://myapp.com/webhook/content-published",
  "events": ["content.published", "content.failed"],
  "secret": "webhook_secret_key"
}
```

### PUT /webhooks/:webhookId

Cập nhật webhook.

### DELETE /webhooks/:webhookId

Xóa webhook.

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

### Common Error Codes

| Code                  | HTTP Status | Description                       |
| --------------------- | ----------- | --------------------------------- |
| `VALIDATION_ERROR`    | 400         | Request validation failed         |
| `UNAUTHORIZED`        | 401         | Invalid or missing authentication |
| `FORBIDDEN`           | 403         | Insufficient permissions          |
| `NOT_FOUND`           | 404         | Resource not found                |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests                 |
| `INTERNAL_ERROR`      | 500         | Internal server error             |
| `AI_SERVICE_ERROR`    | 502         | AI service unavailable            |
| `PLATFORM_API_ERROR`  | 503         | External platform API error       |

## Rate Limiting

### Rate Limits

| Endpoint Category  | Limit        | Window   |
| ------------------ | ------------ | -------- |
| Authentication     | 10 requests  | 1 minute |
| Content Generation | 20 requests  | 1 hour   |
| Content Management | 100 requests | 1 minute |
| Publishing         | 50 requests  | 1 hour   |
| Analytics          | 200 requests | 1 minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642089600
X-RateLimit-Retry-After: 60
```

## Pagination

### Standard Pagination

Query parameters:

- `limit`: Number of items per page (default: 20, max: 100)
- `offset`: Number of items to skip (default: 0)

Response format:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 150,
    "limit": 20,
    "offset": 40,
    "hasNext": true,
    "hasPrevious": true
  }
}
```

## Webhooks Events

### Event Types

| Event               | Description                    | Payload                              |
| ------------------- | ------------------------------ | ------------------------------------ |
| `content.created`   | New content created            | `{contentId, projectId, type}`       |
| `content.updated`   | Content updated                | `{contentId, changes}`               |
| `content.published` | Content published successfully | `{contentId, platform, externalUrl}` |
| `content.failed`    | Publishing failed              | `{contentId, platform, error}`       |
| `project.created`   | New project created            | `{projectId, name}`                  |
| `user.registered`   | New user registered            | `{userId, email}`                    |

### Webhook Payload Example

```json
{
  "event": "content.published",
  "timestamp": "2024-01-20T15:00:15Z",
  "data": {
    "contentId": "789e1234-e89b-12d3-a456-426614174002",
    "projectId": "456e7890-e89b-12d3-a456-426614174001",
    "platform": "wordpress",
    "externalId": "142",
    "externalUrl": "https://myblog.com/ai-marketing-automation",
    "publishedAt": "2024-01-20T15:00:15Z"
  },
  "signature": "sha256=..."
}
```

---

**API Version**: v1  
**Last Updated**: ${new Date().toLocaleDateString('vi-VN')}  
**Support**: api-support@aicontentagent.com
