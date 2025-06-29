// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
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
  wordCount?: number;
  requirements?: {
    includeHeadings?: boolean;
    includeCTA?: boolean;
    seoOptimized?: boolean;
  };
  context?: string;
  preferredProvider?: 'openai' | 'gemini' | 'claude' | 'auto';
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
    featuredImage?: string;
    featuredImageAlt?: string;
    featuredImageCaption?: string;
    galleryImages?: Array<{
      url: string;
      alt_text: string;
      caption?: string;
      is_featured?: boolean;
    }>;
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

export interface ContentSettings {
  contentType: "wordpress_blog" | "facebook_post";
  language: "english" | "vietnamese";
  tone: "professional" | "casual" | "friendly" | "authoritative";
  targetAudience: string;
  brandName?: string;
  keywords?: string;
  preferredProvider?: "auto" | "openai" | "gemini" | "claude";
  specialRequest?: string;
}

export interface ImageSettings {
  // ... existing code ...
} 