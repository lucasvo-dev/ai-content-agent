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
  selectionReason?: 'manual_selection' | 'intelligent_selection' | 'error_fallback';
  originalError?: string;
}

export interface GeneratedContent {
  id: string;
  title: string;
  body: string;
  excerpt: string;
  type: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
  metadata: ContentMetadata;
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