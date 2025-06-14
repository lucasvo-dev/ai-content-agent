import OpenAI from 'openai';
import { ContentGenerationRequest, Content, ContentType } from '@/models/Content';
import { BrandVoiceConfig } from '@/models/Project';
import { ValidationError, AIServiceError } from '@/utils/errors';
import { ContentService } from './ContentService';
import { v4 as uuidv4 } from 'uuid';

export interface AIGenerationResult {
  content: Content;
  qualityScore: number;
  suggestions: string[];
  estimatedTime: number;
  tokensUsed: number;
}

export interface ContentAnalysis {
  readabilityScore: number;
  seoScore: number;
  engagementScore: number;
  brandVoiceAlignment: number;
  suggestions: string[];
}

export class AIContentService {
  private openai: OpenAI;
  private contentService: ContentService;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.contentService = new ContentService();
  }

  /**
   * Generate content using AI
   */
  async generateContent(
    userId: string,
    request: ContentGenerationRequest
  ): Promise<AIGenerationResult> {
    const startTime = Date.now();

    try {
      // Validate request
      this.validateGenerationRequest(request);

      // Generate content based on type
      let generatedContent: string;
      let tokensUsed: number;

      switch (request.type) {
        case 'blog_post':
          ({ content: generatedContent, tokensUsed } = await this.generateBlogPost(request));
          break;
        case 'social_media':
          ({ content: generatedContent, tokensUsed } = await this.generateSocialMediaPost(request));
          break;
        case 'email':
          ({ content: generatedContent, tokensUsed } = await this.generateEmailContent(request));
          break;
        case 'ad_copy':
          ({ content: generatedContent, tokensUsed } = await this.generateAdCopy(request));
          break;
        default:
          throw new ValidationError(`Unsupported content type: ${request.type}`);
      }

      // Parse generated content
      const parsedContent = this.parseGeneratedContent(generatedContent, request.type);

      // Create content in database
      const content = await this.contentService.createContent(userId, {
        projectId: request.projectId,
        title: parsedContent.title,
        body: parsedContent.body,
        excerpt: parsedContent.excerpt,
        type: request.type,
        status: 'draft',
        metadata: {
          ...parsedContent.metadata,
          brandVoice: request.brandVoice,
          targetAudience: request.targetAudience,
          keywords: request.keywords,
          aiGenerated: true,
          generatedAt: new Date(),
          tokensUsed
        },
        aiGenerated: true,
        aiModel: 'gpt-4-turbo-preview',
        aiPromptVersion: '1.0'
      });

      // Analyze content quality
      const qualityScore = await this.analyzeContentQuality(content, request);

      // Generate suggestions
      const suggestions = await this.generateSuggestions(content, request);

      const estimatedTime = Date.now() - startTime;

      return {
        content,
        qualityScore,
        suggestions,
        estimatedTime,
        tokensUsed
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AIServiceError(`Content generation failed: ${error.message}`);
    }
  }

  /**
   * Generate blog post content
   */
  private async generateBlogPost(request: ContentGenerationRequest): Promise<{
    content: string;
    tokensUsed: number;
  }> {
    const prompt = this.buildBlogPostPrompt(request);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert content writer specializing in creating engaging, SEO-optimized blog posts. Always respond with structured JSON containing title, body, excerpt, and metadata.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    const tokensUsed = response.usage?.total_tokens || 0;

    if (!content) {
      throw new AIServiceError('No content generated from OpenAI');
    }

    return { content, tokensUsed };
  }

  /**
   * Generate social media post content
   */
  private async generateSocialMediaPost(request: ContentGenerationRequest): Promise<{
    content: string;
    tokensUsed: number;
  }> {
    const prompt = this.buildSocialMediaPrompt(request);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a social media expert who creates engaging, viral-worthy posts. Always respond with structured JSON containing title, body, excerpt, and metadata.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    const tokensUsed = response.usage?.total_tokens || 0;

    if (!content) {
      throw new AIServiceError('No content generated from OpenAI');
    }

    return { content, tokensUsed };
  }

  /**
   * Generate email content
   */
  private async generateEmailContent(request: ContentGenerationRequest): Promise<{
    content: string;
    tokensUsed: number;
  }> {
    const prompt = this.buildEmailPrompt(request);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an email marketing expert who creates compelling, conversion-focused email campaigns. Always respond with structured JSON containing title, body, excerpt, and metadata.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.6,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    const tokensUsed = response.usage?.total_tokens || 0;

    if (!content) {
      throw new AIServiceError('No content generated from OpenAI');
    }

    return { content, tokensUsed };
  }

  /**
   * Generate ad copy content
   */
  private async generateAdCopy(request: ContentGenerationRequest): Promise<{
    content: string;
    tokensUsed: number;
  }> {
    const prompt = this.buildAdCopyPrompt(request);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an advertising copywriter who creates persuasive, high-converting ad copy. Always respond with structured JSON containing title, body, excerpt, and metadata.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    const tokensUsed = response.usage?.total_tokens || 0;

    if (!content) {
      throw new AIServiceError('No content generated from OpenAI');
    }

    return { content, tokensUsed };
  }

  /**
   * Build blog post prompt
   */
  private buildBlogPostPrompt(request: ContentGenerationRequest): string {
    const { topic, brandVoice, targetAudience, keywords, requirements, context } = request;

    return `
Create a comprehensive blog post with the following specifications:

TOPIC: ${topic}

BRAND VOICE:
- Tone: ${brandVoice?.tone || 'professional'}
- Style: ${brandVoice?.style || 'conversational'}
- Vocabulary: ${brandVoice?.vocabulary || 'accessible'}
- Length: ${brandVoice?.length || 'comprehensive'}

TARGET AUDIENCE: ${targetAudience}

KEYWORDS TO INCLUDE: ${keywords?.join(', ') || 'N/A'}

REQUIREMENTS:
- Word count: ${requirements?.wordCount || '1000-1500 words'}
- Include headings: ${requirements?.includeHeadings ? 'Yes' : 'No'}
- Include CTA: ${requirements?.includeCTA ? 'Yes' : 'No'}
- SEO optimized: ${requirements?.seoOptimized ? 'Yes' : 'No'}

CONTEXT: ${context || 'General blog post for the target audience'}

Please respond with a JSON object containing:
{
  "title": "Engaging blog post title",
  "body": "Full blog post content with proper formatting",
  "excerpt": "Brief summary (150-200 characters)",
  "metadata": {
    "seoTitle": "SEO-optimized title",
    "seoDescription": "Meta description",
    "keywords": ["keyword1", "keyword2"],
    "wordCount": 1500,
    "readingTime": 6,
    "headings": ["H2 heading 1", "H2 heading 2"]
  }
}
    `;
  }

  /**
   * Build social media prompt
   */
  private buildSocialMediaPrompt(request: ContentGenerationRequest): string {
    const { topic, brandVoice, targetAudience, keywords, context } = request;

    return `
Create an engaging social media post with the following specifications:

TOPIC: ${topic}

BRAND VOICE:
- Tone: ${brandVoice?.tone || 'friendly'}
- Style: ${brandVoice?.style || 'conversational'}

TARGET AUDIENCE: ${targetAudience}

KEYWORDS: ${keywords?.join(', ') || 'N/A'}

CONTEXT: ${context || 'General social media post'}

Please respond with a JSON object containing:
{
  "title": "Hook or main message",
  "body": "Full social media post content (under 280 characters for Twitter compatibility)",
  "excerpt": "Brief version for preview",
  "metadata": {
    "hashtags": ["#hashtag1", "#hashtag2"],
    "platform": "multi-platform",
    "characterCount": 250,
    "engagementHooks": ["question", "call-to-action"]
  }
}
    `;
  }

  /**
   * Build email prompt
   */
  private buildEmailPrompt(request: ContentGenerationRequest): string {
    const { topic, brandVoice, targetAudience, keywords, context } = request;

    return `
Create a compelling email campaign with the following specifications:

TOPIC: ${topic}

BRAND VOICE:
- Tone: ${brandVoice?.tone || 'professional'}
- Style: ${brandVoice?.style || 'conversational'}

TARGET AUDIENCE: ${targetAudience}

KEYWORDS: ${keywords?.join(', ') || 'N/A'}

CONTEXT: ${context || 'Email marketing campaign'}

Please respond with a JSON object containing:
{
  "title": "Compelling subject line",
  "body": "Full email content with proper structure",
  "excerpt": "Preview text",
  "metadata": {
    "subjectLine": "Email subject line",
    "previewText": "Preview text for email clients",
    "emailType": "promotional",
    "cta": "Primary call-to-action",
    "personalization": ["firstName", "company"]
  }
}
    `;
  }

  /**
   * Build ad copy prompt
   */
  private buildAdCopyPrompt(request: ContentGenerationRequest): string {
    const { topic, brandVoice, targetAudience, keywords, context } = request;

    return `
Create persuasive ad copy with the following specifications:

TOPIC: ${topic}

BRAND VOICE:
- Tone: ${brandVoice?.tone || 'persuasive'}
- Style: ${brandVoice?.style || 'direct'}

TARGET AUDIENCE: ${targetAudience}

KEYWORDS: ${keywords?.join(', ') || 'N/A'}

CONTEXT: ${context || 'Digital advertising campaign'}

Please respond with a JSON object containing:
{
  "title": "Attention-grabbing headline",
  "body": "Persuasive ad copy with clear value proposition",
  "excerpt": "Short version for display ads",
  "metadata": {
    "headline": "Primary headline",
    "subheadline": "Supporting headline",
    "cta": "Call-to-action button text",
    "adType": "display",
    "valueProposition": "Main benefit"
  }
}
    `;
  }

  /**
   * Parse generated content from OpenAI response
   */
  private parseGeneratedContent(content: string, type: ContentType): {
    title: string;
    body: string;
    excerpt?: string;
    metadata: any;
  } {
    try {
      const parsed = JSON.parse(content);
      
      return {
        title: parsed.title || 'Generated Content',
        body: parsed.body || content,
        excerpt: parsed.excerpt,
        metadata: parsed.metadata || {}
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        title: `Generated ${type.replace('_', ' ')} Content`,
        body: content,
        metadata: {}
      };
    }
  }

  /**
   * Analyze content quality
   */
  private async analyzeContentQuality(content: Content, request: ContentGenerationRequest): Promise<number> {
    // Simple quality scoring based on content characteristics
    let score = 0;

    // Length score (0-25 points)
    const wordCount = content.body.split(' ').length;
    if (wordCount >= 500) score += 25;
    else if (wordCount >= 300) score += 20;
    else if (wordCount >= 150) score += 15;
    else score += 10;

    // Keyword inclusion (0-25 points)
    if (request.keywords && request.keywords.length > 0) {
      const keywordMatches = request.keywords.filter(keyword =>
        content.body.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      score += (keywordMatches / request.keywords.length) * 25;
    } else {
      score += 20; // Default if no keywords specified
    }

    // Structure score (0-25 points)
    const hasHeadings = /#{1,6}\s/.test(content.body) || /<h[1-6]/.test(content.body);
    const hasParagraphs = content.body.split('\n\n').length > 1;
    if (hasHeadings && hasParagraphs) score += 25;
    else if (hasParagraphs) score += 20;
    else score += 15;

    // Engagement score (0-25 points)
    const hasQuestions = /\?/.test(content.body);
    const hasCTA = /click|learn|discover|get|try|start/i.test(content.body);
    if (hasQuestions && hasCTA) score += 25;
    else if (hasCTA) score += 20;
    else score += 15;

    return Math.min(score, 100);
  }

  /**
   * Generate content improvement suggestions
   */
  private async generateSuggestions(content: Content, request: ContentGenerationRequest): Promise<string[]> {
    const suggestions: string[] = [];

    // Check word count
    const wordCount = content.body.split(' ').length;
    if (wordCount < 300) {
      suggestions.push('Consider expanding the content for better depth and SEO value');
    }

    // Check keyword usage
    if (request.keywords && request.keywords.length > 0) {
      const missingKeywords = request.keywords.filter(keyword =>
        !content.body.toLowerCase().includes(keyword.toLowerCase())
      );
      if (missingKeywords.length > 0) {
        suggestions.push(`Consider including these keywords: ${missingKeywords.join(', ')}`);
      }
    }

    // Check structure
    if (!/#{1,6}\s/.test(content.body) && !/<h[1-6]/.test(content.body)) {
      suggestions.push('Add headings to improve content structure and readability');
    }

    // Check call-to-action
    if (!/click|learn|discover|get|try|start/i.test(content.body)) {
      suggestions.push('Include a clear call-to-action to improve engagement');
    }

    return suggestions;
  }

  /**
   * Validate generation request
   */
  private validateGenerationRequest(request: ContentGenerationRequest): void {
    if (!request.projectId) {
      throw new ValidationError('Project ID is required');
    }

    if (!request.topic?.trim()) {
      throw new ValidationError('Topic is required');
    }

    if (!request.type) {
      throw new ValidationError('Content type is required');
    }

    const validTypes: ContentType[] = ['blog_post', 'social_media', 'email', 'ad_copy'];
    if (!validTypes.includes(request.type)) {
      throw new ValidationError(`Invalid content type. Must be one of: ${validTypes.join(', ')}`);
    }

    if (request.topic.length > 200) {
      throw new ValidationError('Topic must be less than 200 characters');
    }
  }

  /**
   * Analyze existing content
   */
  async analyzeContent(contentId: string, userId: string): Promise<ContentAnalysis> {
    const content = await this.contentService.getContentById(contentId, userId);

    const analysis: ContentAnalysis = {
      readabilityScore: this.calculateReadabilityScore(content.body),
      seoScore: this.calculateSEOScore(content),
      engagementScore: this.calculateEngagementScore(content.body),
      brandVoiceAlignment: this.calculateBrandVoiceAlignment(content),
      suggestions: []
    };

    // Generate improvement suggestions
    analysis.suggestions = this.generateImprovementSuggestions(content, analysis);

    return analysis;
  }

  /**
   * Calculate readability score
   */
  private calculateReadabilityScore(text: string): number {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = this.countSyllables(text);

    // Simplified Flesch Reading Ease formula
    const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
    
    // Convert to 0-100 scale
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate SEO score
   */
  private calculateSEOScore(content: Content): number {
    let score = 0;

    // Title length (0-20 points)
    if (content.title.length >= 30 && content.title.length <= 60) {
      score += 20;
    } else if (content.title.length >= 20 && content.title.length <= 80) {
      score += 15;
    } else {
      score += 10;
    }

    // Meta description (0-20 points)
    const metaDesc = content.metadata?.seoDescription;
    if (metaDesc && metaDesc.length >= 120 && metaDesc.length <= 160) {
      score += 20;
    } else if (metaDesc && metaDesc.length >= 100 && metaDesc.length <= 180) {
      score += 15;
    } else {
      score += 5;
    }

    // Content length (0-20 points)
    const wordCount = content.body.split(/\s+/).length;
    if (wordCount >= 1000) {
      score += 20;
    } else if (wordCount >= 500) {
      score += 15;
    } else if (wordCount >= 300) {
      score += 10;
    } else {
      score += 5;
    }

    // Headings structure (0-20 points)
    const hasH1 = /<h1|^#\s/.test(content.body);
    const hasH2 = /<h2|^##\s/.test(content.body);
    if (hasH1 && hasH2) {
      score += 20;
    } else if (hasH2) {
      score += 15;
    } else {
      score += 5;
    }

    // Keywords (0-20 points)
    const keywords = content.metadata?.keywords || [];
    if (keywords.length >= 3) {
      score += 20;
    } else if (keywords.length >= 1) {
      score += 15;
    } else {
      score += 5;
    }

    return score;
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(text: string): number {
    let score = 0;

    // Questions (0-25 points)
    const questionCount = (text.match(/\?/g) || []).length;
    score += Math.min(25, questionCount * 5);

    // Call-to-action words (0-25 points)
    const ctaWords = ['click', 'learn', 'discover', 'get', 'try', 'start', 'join', 'subscribe'];
    const ctaCount = ctaWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    score += Math.min(25, ctaCount * 5);

    // Emotional words (0-25 points)
    const emotionalWords = ['amazing', 'incredible', 'fantastic', 'love', 'hate', 'excited', 'worried'];
    const emotionalCount = emotionalWords.filter(word =>
      text.toLowerCase().includes(word)
    ).length;
    score += Math.min(25, emotionalCount * 3);

    // Personal pronouns (0-25 points)
    const personalPronouns = ['you', 'your', 'we', 'our', 'I', 'my'];
    const pronounCount = personalPronouns.filter(pronoun =>
      text.toLowerCase().includes(pronoun.toLowerCase())
    ).length;
    score += Math.min(25, pronounCount * 2);

    return score;
  }

  /**
   * Calculate brand voice alignment
   */
  private calculateBrandVoiceAlignment(content: Content): number {
    // This would typically use ML models to analyze brand voice
    // For now, return a placeholder score
    return 85;
  }

  /**
   * Count syllables in text (simplified)
   */
  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let syllableCount = 0;

    words.forEach(word => {
      const vowels = word.match(/[aeiouy]+/g);
      syllableCount += vowels ? vowels.length : 1;
    });

    return syllableCount;
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovementSuggestions(content: Content, analysis: ContentAnalysis): string[] {
    const suggestions: string[] = [];

    if (analysis.readabilityScore < 60) {
      suggestions.push('Improve readability by using shorter sentences and simpler words');
    }

    if (analysis.seoScore < 70) {
      suggestions.push('Optimize for SEO by improving title length, meta description, and keyword usage');
    }

    if (analysis.engagementScore < 60) {
      suggestions.push('Increase engagement by adding questions, call-to-actions, and emotional language');
    }

    if (analysis.brandVoiceAlignment < 80) {
      suggestions.push('Adjust tone and style to better align with brand voice guidelines');
    }

    return suggestions;
  }
} 