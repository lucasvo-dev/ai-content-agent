import { Request } from "express";

// Re-export from content types
export type { 
  ContentGenerationRequest,
  ContentType,
  BrandVoice,
  ContentAnalysisResult,
  ImprovementSuggestion
} from './content.js';

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
  LANDING_PAGE = "ad_copy",
}

export enum ContentStatus {
  DRAFT = "draft",
  PENDING_REVIEW = "pending_review",
  APPROVED = "approved",
  PUBLISHED = "published",
  ARCHIVED = "archived",
  ERROR = "error",
}

export interface ContentMetadata {
  sourceUrl?: string;
  wordCount?: number;
  readabilityScore?: any;
  seoScore?: number;
  engagementScore?: any;
  aiModel?: string;
  promptVersion?: string;
  processingTime?: number;
  warnings?: string[];
  featuredImage?: string;
  featuredImageAlt?: string;
  featuredImageCaption?: string;
  galleryImages?: Array<{
    url: string;
    alt_text: string;
    caption?: string;
    wp_media_id?: number;
  }>;
  [key: string]: any;
}

export interface BrandVoiceConfig {
  /** Tone of the content, e.g. "professional", "casual" */
  tone: string;

  /** Writing style, e.g. "formal", "conversational" */
  style: string;

  /** Vocabulary complexity, e.g. "simple", "advanced" */
  vocabulary: string;

  /** Desired length description, e.g. "concise", "detailed" */
  length: string;

  /** Optional brand name to inject into content */
  brandName?: string;
}

// Content generation types
export interface ContentGenerationRequest {
  type: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
  topic: string;
  context?: string;
  targetAudience: string;
  keywords: string[];
  brandVoice: BrandVoiceConfig;
  preferredProvider?: 'auto' | 'openai' | 'gemini' | 'claude';
  imageSettings?: ImageSettings;
  language?: 'english' | 'vietnamese';
  specialInstructions?: string;
  requirements?: string;
}

export interface ImageSettings {
  includeImages: boolean;
  imageSelection?: "category" | "folder" | "manual";
  imageCategory?: string;
  specificFolder?: string;
  maxImages?: number | "auto";
  ensureConsistency?: boolean;
  selectedImages?: string[];
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
  // Additional properties
  performanceTrackingEnabled?: boolean;
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
  GEMINI_API_KEY: string;
  CLAUDE_API_KEY: string;
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
  delayBetweenPosts?: number;
  enablePerformanceTracking?: boolean;
  autoOptimization?: boolean;
}

export interface GeneratedContent {
  id?: string;
  title: string;
  body: string;
  excerpt?: string;
  type: ContentType;
  status: ContentStatus;
  metadata: ContentMetadata;
  qualityScore?: number;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  wordCount?: number;
  aiProvider?: string;
  generatedAt?: Date;
  editHistory?: any[];
  batchJobId?: string;
  sourceResearch?: any;
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
    url?: string;
  };
  qualityScore: number;
  scrapedAt: string;
  // Additional properties
  wordCount?: number;
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

// Admin Review System Types
export interface ReviewQueueItem {
  id: string;
  contentId?: string;
  content?: GeneratedContent;
  title?: string;
  type?: ContentType;
  qualityScore: QualityScore | number;
  aiProvider?: string;
  generatedAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'editing' | 'auto_approved';
  sourceReference?: {
    url: string;
    title: string;
  };
  reviewedBy?: string;
  reviewedAt?: Date;
  adminNotes?: string;
  qualityRating?: number;
  lastEditedBy?: string;
  lastEditedAt?: Date;
  autoApproved?: boolean;
  priority?: number;
  estimatedReadTime?: number;
  batchJobId?: string;
  createdAt?: Date;
  preview?: string;
  metadata?: any;
}

export interface ReviewFilters {
  status?: 'pending' | 'approved' | 'rejected' | string;
  type?: ContentType;
  qualityScoreMin?: number;
  qualityScoreMax?: number;
  aiProvider?: string;
  dateFrom?: Date;
  dateTo?: Date;
  batchJobId?: string;
  priority?: number | 'low' | 'medium' | 'high' | string;
  limit?: number;
  offset?: number;
}

export interface ApprovalOptions {
  approve?: boolean;
  feedback?: string;
  qualityScore?: number;
  publishImmediately?: boolean;
  // Additional options
  notes?: string;
  edits?: any;
  qualityRating?: number;
  autoPublish?: boolean;
  publishSettings?: any;
}

export interface BulkApprovalOptions {
  contentIds?: string[];
  approve?: boolean;
  feedback?: string;
  publishImmediately?: boolean;
  // Additional options
  autoPublish?: boolean;
  defaultQualityRating?: number;
  adminNotes?: string;
  concurrency?: number;
  publishSettings?: any;
}

export interface ApprovalResult {
  contentId: string;
  success: boolean;
  message?: string;
  publishResult?: PublishResult;
  // Additional fields
  status?: string;
  reviewedAt?: Date;
  qualityRating?: number;
  queuedForPublishing?: boolean;
  reviewedBy?: string;
  addedToTrainingDataset?: boolean;
  regenerationQueued?: boolean;
}

export interface QualityScore {
  overall?: number;
  seo?: number;
  readability?: number;
  engagement?: number;
  uniqueness?: number;
  // Additional scoring details
  details?: any;
  calculatedAt?: Date;
}

export interface ReviewMetrics {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  averageQualityScore: number;
  approvalRate: number;
  averageReviewTime: number;
  // Additional metrics
  totalItems?: number;
  averageEstimatedReadTime?: number;
  averageReadTime?: number;
  priorityBreakdown?: {
    high: number;
    medium: number;
    low: number;
  };
  priorityCounts?: any;
  pendingReview?: number;
  autoApproved?: number;
  approved?: number;
  rejected?: number;
}

// Automated Publishing Types
export interface AutomatedPublishingJob {
  id: string;
  contentId?: string;
  contentIds?: string[]; // For bulk publishing
  targetId?: string;
  scheduledDate?: Date;
  status: 'scheduled' | 'processing' | 'completed' | 'failed' | 'pending' | 'partially_completed' | 'completed_with_errors';
  retryCount?: number;
  lastAttempt?: Date;
  result?: PublishResult;
  error?: string;
  createdAt: Date;
  updatedAt?: Date;
  // Additional properties
  settings?: any;
  progress?: {
    total: number;
    published: number;
    failed: number;
    percentage?: number;
    currentStage?: string;
    estimatedTimeRemaining?: string;
    processing?: number;
  };
  results?: PublishingResult[];
  completedAt?: Date;
  wpCredentials?: any;
}

export interface PublishingTask {
  id: string;
  batchId?: string;
  contentId: string;
  targetId: string;
  scheduledDate?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  result?: PublishResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublishingResult {
  taskId: string;
  contentId: string;
  targetId: string;
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  publishedAt?: Date;
  error?: string;
  metrics?: ContentPerformanceMetrics;
  // Additional properties
  wordpressId?: string;
  url?: string;
  message?: string;
  performanceTrackingEnabled?: boolean;
}

export interface ContentPerformanceMetrics {
  views?: number;
  clicks?: number;
  shares?: number;
  comments?: number;
  likes?: number;
  engagement?: number;
  reach?: number;
  impressions?: number;
  ctr?: number;
  conversionRate?: number;
  // Additional tracking fields
  currentMetrics?: {
    views?: number;
    engagementRate?: number;
    comments?: number;
    shares?: number;
    averageTimeOnPage?: number;
  };
  seoMetrics?: any;
  lastTrackedAt?: Date;
  trackingHistory?: any[];
  qualityScore?: number;
  contentId?: string;
  wordpressId?: string;
  // More additional fields
  wpPostId?: string;
  publishedUrl?: string;
  publishedAt?: Date;
  aiProvider?: string;
  createdAt?: Date;
  initialMetrics?: any;
}

// Batch Generation Types
export interface BatchGenerationJob {
  id: string;
  projectId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'completed_with_errors';
  progress: {
    total: number;
    completed: number;
    failed: number;
    processing?: number;
    currentStage?: string;
    percentage?: number;
    estimatedTimeRemaining?: string;
  };
  settings: BatchGenerationSettings;
  results: GenerationTask[];
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
  researchJobId?: string;
}

export interface BatchGenerationSettings {
  contentType: ContentType | 'blog_post';
  targetAudience: string;
  brandVoice: BrandVoiceConfig;
  topics?: string[];
  keywords?: string[];
  requirements: {
    wordCount?: string;
    includeImages?: boolean;
    includeHeadings?: boolean;
    includeCTA?: boolean;
    seoOptimized?: boolean;
    uniquenessThreshold?: number;
  };
  aiProvider?: 'openai' | 'gemini' | 'auto';
  targetCount?: number;
}

export interface GenerationTask {
  id: string;
  batchId?: string;
  topic?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: GeneratedContent;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  // Additional properties
  crawledContent?: any;
  settings?: any;
  priority?: number;
  batchJobId?: string;
  taskId?: string;
  createdAt?: Date;
  // Content properties for direct access
  title?: string;
  body?: string;
  excerpt?: string;
  metadata?: ContentMetadata;
}

// Research Types
export interface ResearchJob {
  id: string;
  query: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results: ScrapedContent[] & {
    crawledContent?: any[];
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  summary: string;
  keywords: string[];
  scrapedAt: Date;
  qualityScore: number;
  // Additional properties
  sourceUrl?: string;
  crawledContent?: any;
}

export interface GalleryImage {
  id: string | number;
  source_key: string;
  relative_path: string;
  folder_name: string;
  category: string;
  alt_text: string;
  description?: string;
  thumbnail_url: string;
  full_url: string;
  download_url: string;
  priority: number;
  tags?: string[];
  wordpress_ready?: boolean;
} 