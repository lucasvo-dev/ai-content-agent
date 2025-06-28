import { BrandVoiceConfig } from './index.js';

export interface ContentGenerationRequest {
  type: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
  topic: string;
  targetAudience: string;
  keywords: string[];
  brandVoice: BrandVoiceConfig;
  preferredProvider?: 'openai' | 'gemini' | 'claude' | 'auto';
  sourceUrl?: string;
  language?: 'vi' | 'en';
  contentLength?: 'short' | 'medium' | 'long';
  projectId?: string;
  metadata?: Record<string, any>;
}

export interface BrandVoice {
  tone: string;
  style: string; 
  vocabulary: string;
  length: string;
  brandName?: string;
}

export interface ContentAnalysisResult {
  strengths: string[];
  weaknesses: string[];
  seoScore: number;
  readabilityScore: number;
  suggestions: ImprovementSuggestion[];
}

export interface ImprovementSuggestion {
  type: 'seo' | 'readability' | 'engagement' | 'structure';
  priority: 'high' | 'medium' | 'low';
  description: string;
  implementation: string;
} 