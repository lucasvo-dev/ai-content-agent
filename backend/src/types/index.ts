import { Request } from "express";

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  lastLoginAt: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
  // SSO fields
  provider?: 'local' | 'google' | 'microsoft';
  providerId?: string;
  emailVerified?: boolean;
}

export type UserRole = "admin" | "user" | "editor";

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, "passwordHash">;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

// SSO types
export interface SSOUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  provider: 'google' | 'microsoft';
  providerId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSOAuthResponse {
  user: SSOUser;
  token: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser: boolean;
}

// Content types
export interface Content {
  id: string;
  title: string;
  body: string;
  excerpt?: string;
  type: ContentType;
  status: ContentStatus;
  authorId: string;
  projectId: string;
  metadata: ContentMetadata;
  aiGenerated: boolean;
  qualityScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum ContentType {
  BLOG_POST = "blog_post",
  SOCIAL_MEDIA = "social_media",
  EMAIL = "email",
  LANDING_PAGE = "landing_page",
}

export enum ContentStatus {
  DRAFT = "draft",
  UNDER_REVIEW = "under_review",
  APPROVED = "approved",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

export interface ContentMetadata {
  keywords: string[];
  seoTitle?: string;
  seoDescription?: string;
  featuredImage?: string;
  wordCount: number;
  readingTime: number;
  targetAudience?: string;
  brandVoice?: BrandVoiceConfig;
}

export interface BrandVoiceConfig {
  tone: "professional" | "casual" | "friendly" | "authoritative";
  style: "formal" | "conversational" | "technical" | "creative";
  vocabulary: "simple" | "advanced" | "industry-specific";
  length: "concise" | "detailed" | "comprehensive";
}

// Content generation types
export interface ContentGenerationRequest {
  topic: string;
  type: ContentType;
  brandVoice: BrandVoiceConfig;
  targetAudience: string;
  keywords: string[];
  requirements: {
    wordCount?: string;
    includeImages?: boolean;
    includeHeadings?: boolean;
    includeCTA?: boolean;
    seoOptimized?: boolean;
    tone?: string;
  };
  context?: string;
  preferredProvider?: 'openai' | 'gemini' | 'auto';
}

export interface ContentGenerationResponse {
  content: {
    title: string;
    body: string;
    excerpt: string;
    metadata: ContentMetadata;
  };
  qualityScore: number;
  suggestions: string[];
  estimatedTime: number;
}

// Publishing types
export interface PublishingTarget {
  id: string;
  name: string;
  platform: Platform;
  credentials: PlatformCredentials;
  settings: PlatformSettings;
  isActive: boolean;
}

export enum Platform {
  WORDPRESS = "wordpress",
  FACEBOOK = "facebook",
  LINKEDIN = "linkedin",
  TWITTER = "twitter",
}

export interface PlatformCredentials {
  wordpress?: {
    siteUrl: string;
    username: string;
    applicationPassword: string;
  };
  facebook?: {
    pageId: string;
    accessToken: string;
  };
  linkedin?: {
    organizationId: string;
    accessToken: string;
  };
  twitter?: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  };
}

export interface PlatformSettings {
  wordpress?: {
    defaultStatus: "draft" | "publish";
    defaultCategories: string[];
    defaultTags: string[];
  };
  facebook?: {
    defaultPublished: boolean;
    defaultTargeting?: FacebookTargeting;
  };
}

export interface FacebookTargeting {
  countries?: string[];
  cities?: string[];
  ageMin?: number;
  ageMax?: number;
}

export interface PublishRequest {
  contentId: string;
  targetId: string;
  scheduledDate?: Date;
  customSettings?: Record<string, unknown>;
}

export interface PublishResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  message: string;
  publishedAt: Date;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  brandVoice: BrandVoiceConfig;
  targetAudience: string;
  keywords: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Analytics types
export interface AnalyticsData {
  contentId: string;
  platform: Platform;
  metrics: PlatformMetrics;
  collectedAt: Date;
}

export interface PlatformMetrics {
  wordpress?: {
    views: number;
    comments: number;
    shares: number;
  };
  facebook?: {
    reach: number;
    impressions: number;
    engagement: number;
    likes: number;
    shares: number;
    comments: number;
  };
  linkedin?: {
    impressions: number;
    clicks: number;
    reactions: number;
    comments: number;
    shares: number;
  };
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

// Express types
export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Alias for compatibility
export type AuthRequest = AuthenticatedRequest;

// Database types
export interface DatabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

// Environment types
export interface EnvConfig {
  NODE_ENV: string;
  PORT: string;
  HOST: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  REDIS_URL: string;
  // SSO Configuration
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: Record<string, unknown>;
  timestamp: Date;
  source: string;
}

export enum WebhookEventType {
  CONTENT_CREATED = "content.created",
  CONTENT_UPDATED = "content.updated",
  CONTENT_PUBLISHED = "content.published",
  CONTENT_FAILED = "content.failed",
  USER_REGISTERED = "user.registered",
  PROJECT_CREATED = "project.created",
}

// Additional types for services
export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface PublishingSettings {
  status?: "draft" | "publish";
  categories?: string[];
  tags?: string[];
  scheduledDate?: Date;
}

export interface GeneratedContent {
  title: string;
  body: string;
  excerpt?: string;
  metadata: ContentMetadata;
  qualityScore?: number;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  wordCount?: number;
  aiProvider?: string;
  sourceReference?: {
    url: string;
    title: string;
    usedAsReference: boolean;
    rewriteStyle: 'similar' | 'improved' | 'different_angle' | 'expanded';
  };
}

export interface ScrapingOptions {
  timeout?: number;
  waitFor?: string;
  userAgent?: string;
  enableJavaScript?: boolean;
}

export interface ScrapingResult {
  url: string;
  title: string;
  content: string;
  metadata: {
    description?: string;
    author?: string;
    publishDate?: string;
    images: string[];
    wordCount: number;
    language: string;
  };
  qualityScore: number;
  scrapedAt: string;
}

// Batch processing types
export interface BatchJob {
  id: string;
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    crawled: number;
    generated: number;
    failed: number;
  };
  settings: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentWorkflowItem {
  id: string;
  sourceUrl: string;
  status: 'pending' | 'crawling' | 'crawled' | 'generating' | 'generated' | 'approved' | 'failed';
  scrapedContent?: ScrapingResult;
  generatedContent?: GeneratedContent;
  settings?: any;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
} 