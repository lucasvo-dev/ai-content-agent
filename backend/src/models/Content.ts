import { BrandVoiceConfig } from './Project';

export interface Content {
  id: string;
  projectId: string;
  title: string;
  body: string;
  excerpt?: string;
  type: ContentType;
  status: ContentStatus;
  metadata: ContentMetadata;
  aiGenerated: boolean;
  aiModel?: string;
  aiPromptVersion?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ContentType = 'blog_post' | 'social_media' | 'email' | 'ad_copy';
export type ContentStatus = 'draft' | 'approved' | 'published' | 'archived';

export interface ContentMetadata {
  seoTitle?: string;
  seoDescription?: string;
  keywords: string[];
  targetAudience?: string;
  brandVoice?: BrandVoiceConfig;
  wordCount: number;
  readingTime: number;
  seoScore?: number;
  qualityScore?: number;
  featuredImage?: MediaFile;
  customFields?: Record<string, any>;
}

export interface MediaFile {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  alt?: string;
  caption?: string;
}

export interface CreateContentRequest {
  projectId: string;
  title: string;
  body: string;
  excerpt?: string;
  type?: ContentType;
  status?: ContentStatus;
  metadata?: Partial<ContentMetadata>;
  aiGenerated?: boolean;
  aiModel?: string;
  aiPromptVersion?: string;
}

export interface UpdateContentRequest {
  title?: string;
  body?: string;
  excerpt?: string;
  type?: ContentType;
  status?: ContentStatus;
  metadata?: Partial<ContentMetadata>;
}

export interface ContentGenerationRequest {
  projectId: string;
  type: ContentType;
  topic: string;
  brandVoice?: BrandVoiceConfig;
  targetAudience?: string;
  keywords?: string[];
  requirements?: ContentRequirements;
  context?: string;
}

export interface ContentRequirements {
  wordCount?: string; // e.g., "1500-2000"
  includeHeadings?: boolean;
  includeCTA?: boolean;
  seoOptimized?: boolean;
  tone?: string;
  style?: string;
}

export interface GeneratedContent {
  title: string;
  body: string;
  excerpt: string;
  metadata: ContentMetadata;
  suggestions?: string[];
}

export interface ContentVersion {
  id: string;
  contentId: string;
  versionNumber: number;
  title: string;
  body: string;
  excerpt?: string;
  metadata: ContentMetadata;
  createdBy: string;
  createdAt: Date;
  changes?: string;
}

// Database entity interfaces
export interface ContentEntity {
  id: string;
  project_id: string;
  title: string;
  body: string;
  excerpt?: string;
  type: ContentType;
  status: ContentStatus;
  metadata: ContentMetadata;
  ai_generated: boolean;
  ai_model?: string;
  ai_prompt_version?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ContentVersionEntity {
  id: string;
  content_id: string;
  version_number: number;
  title: string;
  body: string;
  excerpt?: string;
  metadata: ContentMetadata;
  created_by: string;
  created_at: Date;
  changes?: string;
}

// Utility functions
export const sanitizeContent = (content: ContentEntity): Content => ({
  id: content.id,
  projectId: content.project_id,
  title: content.title,
  body: content.body,
  excerpt: content.excerpt || undefined,
  type: content.type as ContentType,
  status: content.status as ContentStatus,
  metadata: content.metadata as ContentMetadata,
  aiGenerated: content.ai_generated,
  aiModel: content.ai_model,
  aiPromptVersion: content.ai_prompt_version,
  createdBy: content.created_by,
  createdAt: content.created_at,
  updatedAt: content.updated_at,
});

export const calculateReadingTime = (text: string): number => {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

export const calculateWordCount = (text: string): number => {
  return text.split(/\s+/).filter(word => word.length > 0).length;
};

export const generateExcerpt = (body: string, maxLength: number = 160): string => {
  const plainText = body.replace(/<[^>]*>/g, ''); // Remove HTML tags
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  const truncated = plainText.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  return lastSpaceIndex > 0 
    ? truncated.substring(0, lastSpaceIndex) + '...'
    : truncated + '...';
}; 