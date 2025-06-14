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