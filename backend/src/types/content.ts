export interface BrandVoice {
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative';
  style: 'formal' | 'conversational' | 'technical' | 'creative';
  vocabulary: 'simple' | 'advanced' | 'industry-specific';
  length: 'concise' | 'detailed' | 'comprehensive';
}

export interface ContentRequirements {
  wordCount?: string;
  includeHeadings?: boolean;
  includeCTA?: boolean;
  seoOptimized?: boolean;
}

export interface ContentGenerationRequest {
  type: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
  topic: string;
  targetAudience: string;
  keywords: string[];
  brandVoice: BrandVoice;
  requirements?: ContentRequirements;
  context?: string;
  preferredProvider?: 'openai' | 'gemini' | 'auto';
}

export interface ContentMetadata {
  wordCount: number;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  generatedAt: string;
  aiModel: string;
  promptVersion: string;
  provider: string;
  cost: number;
  tokensUsed: number;
  selectedProvider?: string;
  requestedProvider?: string;
  selectionReason?: 'manual_selection' | 'intelligent_selection' | 'error_fallback' | 'primary_choice' | 'fallback_after_error';
  originalError?: string;
  keywords?: string[];
  seoTitle?: string;
  seoDescription?: string;
  featuredImage?: string;
  readingTime?: number;
  targetAudience?: string;
  brandVoice?: BrandVoice;
  uniquenessScore?: number;
  qualityScore?: number;
  aiProvider?: string;
  batchJobId?: string;
  featuredImageSuggestion?: string;
  finishReason?: string;
  safetyRatings?: any;
  responseTime?: number;
  taskId?: string;
  promptType?: string;
}

export interface GeneratedContent {
  id?: string;
  title: string;
  body: string;
  excerpt?: string;
  type?: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
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
  status?: string;
  sourceReference?: {
    url: string;
    title: string;
    usedAsReference: boolean;
    rewriteStyle: 'similar' | 'improved' | 'different_angle' | 'expanded';
  };
}

export interface ImprovementSuggestion {
  type: 'seo' | 'engagement' | 'readability' | 'structure';
  priority: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
}

export interface ContentAnalysisResult {
  contentId: string;
  qualityScore: number;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  suggestions: ImprovementSuggestion[];
  analyzedAt: string;
} 