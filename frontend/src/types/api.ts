// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// AI Content Generation Types
export interface BrandVoice {
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative';
  style: 'formal' | 'conversational' | 'technical' | 'creative';
  vocabulary: 'simple' | 'advanced' | 'industry-specific';
  length: 'concise' | 'detailed' | 'comprehensive';
}

export interface ContentGenerationRequest {
  type: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
  topic: string;
  brandVoice: BrandVoice;
  targetAudience: string;
  keywords: string[];
  requirements?: {
    wordCount?: string;
    includeHeadings?: boolean;
    includeCTA?: boolean;
    seoOptimized?: boolean;
  };
  context?: string;
  preferredProvider?: 'openai' | 'gemini' | 'auto';
}

export interface GeneratedContent {
  id: string;
  title: string;
  body: string;
  excerpt?: string;
  type: string;
  metadata: {
    wordCount: number;
    seoScore: number;
    readabilityScore: number;
    engagementScore?: number;
    generatedAt: string;
    aiModel?: string;
    promptVersion?: string;
    provider?: string;
    cost?: number;
    tokensUsed?: number;
    selectedProvider?: string;
    requestedProvider?: string;
    selectionReason?: string;
    originalError?: string;
  };
}

// AI Models
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  costPerToken: number;
  maxTokens: number;
  recommended: boolean;
  status: string;
  description?: string;
}

// Content Templates
export interface ContentTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  provider: string;
  model: string;
  structure?: {
    sections: string[];
    requiredElements: string[];
  };
  brandVoice?: BrandVoice;
}

// AI Stats
export interface AIStats {
  usage: {
    totalGenerations: number;
    totalTokens: number;
    averageQualityScore: number;
    costThisMonth: number;
  };
  performance: {
    averageGenerationTime: number;
    successRate: number;
    topContentType: string;
  };
}

// Health Check
export interface HealthStatus {
  success: boolean;
  message: string;
  timestamp: string;
  version?: string;
  environment?: string;
  aiService?: {
    status: string;
    currentProvider: string;
    availableProviders: Array<{
      provider: string;
      available: boolean;
      cost: string;
    }>;
    features: string[];
    strategy?: string;
    limits?: {
      requestsPerMinute: number;
      requestsPerDay: number;
    };
  };
} 

// Link-Based Content System Types
export interface CreateBatchJobRequest {
  projectId: string;
  urls: string[];
  generateSettings?: {
    contentType: 'blog_post' | 'social_media' | 'email';
    brandVoice: BrandVoice;
    targetAudience: string;
    preferredProvider?: 'openai' | 'gemini' | 'auto';
  };
}

export interface BatchJob {
  id: string;
  projectId: string;
  status: 'pending' | 'crawling' | 'generating' | 'completed' | 'failed';
  totalUrls: number;
  processedUrls: number;
  failedUrls: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  stats?: {
    totalItems: number;
    crawledItems: number;
    generatedItems: number;
    failedItems: number;
    approvedItems: number;
    averageQuality: number;
  };
}

export interface BatchJobStatus {
  job: BatchJob;
  items: ContentWorkflowItem[];
  errors: Array<{
    url: string;
    error: string;
    phase: 'crawling' | 'generation';
  }>;
}

export interface ContentWorkflowItem {
  id: string;
  batchJobId: string;
  url: string;
  status: 'pending' | 'crawling' | 'crawled' | 'generating' | 'generated' | 'approved' | 'failed';
  crawledContent?: {
    title: string;
    content: string;
    excerpt: string;
    author?: string;
    publishDate?: string;
    tags?: string[];
    images?: string[];
    qualityScore: number;
    wordCount: number;
    language: string;
  };
  generatedContent?: GeneratedContent;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

// WordPress Sites Management Types
export interface WordPressSiteConfig {
  name: string;
  siteUrl: string;
  username: string;
  applicationPassword: string;
  description?: string;
  defaultSettings?: {
    defaultStatus: 'draft' | 'publish' | 'private';
    defaultCategory?: string;
    defaultTags?: string[];
    autoPublish?: boolean;
  };
}

export interface WordPressSite {
  id: string;
  userId: string;
  name: string;
  siteUrl: string;
  username: string;
  description?: string;
  status: 'active' | 'inactive' | 'error';
  lastTested?: string;
  lastPublished?: string;
  isActive: boolean;
  siteInfo?: {
    title: string;
    description: string;
    url: string;
    adminEmail: string;
    timezone: string;
    language: string;
    version: string;
    categories: Array<{
      id: number;
      name: string;
      slug: string;
    }>;
    tags: Array<{
      id: number;
      name: string;
      slug: string;
    }>;
  };
  defaultSettings?: {
    defaultStatus: 'draft' | 'publish' | 'private';
    defaultCategory?: string;
    defaultTags?: string[];
    autoPublish?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TestConnectionRequest {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  siteInfo?: {
    title: string;
    description: string;
    url: string;
    version: string;
    categories: Array<{
      id: number;
      name: string;
      slug: string;
    }>;
    tags: Array<{
      id: number;
      name: string;
      slug: string;
    }>;
  };
  error?: string;
}

// URL Scraping Test Types
export interface ScrapingResult {
  success: boolean;
  url: string;
  content?: {
    title: string;
    content: string;
    excerpt: string;
    author?: string;
    publishDate?: string;
    tags?: string[];
    images?: string[];
    qualityScore: number;
    wordCount: number;
    language: string;
  };
  error?: string;
  strategy: string;
  processingTime: number;
}

// Workflow UI Types
export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  canEdit: boolean;
  component: React.ComponentType<any>;
} 