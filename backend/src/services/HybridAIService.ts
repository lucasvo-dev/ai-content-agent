import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import {
  ContentGenerationRequest,
  GeneratedContent,
  ContentMetadata,
  BrandVoiceConfig,
  ContentStatus,
} from '../types/index.js';

export type AIProvider = 'openai' | 'gemini' | 'claude' | 'hybrid';

interface ProviderStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalCost: number;
  averageResponseTime: number;
  lastUsed: Date | null;
}

interface ContentAnalysisResult {
  contentId: string;
  qualityScore: number;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  keywordDensity: Record<string, number>;
  suggestions: string[];
  metadata: {
    analyzedAt: string;
    provider: string;
  };
}

interface ImprovementSuggestion {
  type: 'seo' | 'readability' | 'engagement' | 'content';
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
  impact: string;
}

export class HybridAIService {
  private openai: OpenAI | null = null;
  private gemini: any = null;
  private claude: any = null;
  private provider: AIProvider;
  private stats: Map<string, ProviderStats> = new Map();

  constructor() {
    this.provider = (process.env.AI_PROVIDER as AIProvider) || 'hybrid';
    
    console.log('🔧 HybridAIService constructor called');
    console.log('🔧 AI_PROVIDER:', process.env.AI_PROVIDER);
    console.log('🔧 OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('🔧 GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
    
    // Initialize provider stats
    this.initializeStats();
    
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: 60000, // 60 seconds timeout
          maxRetries: 3,
        });
        console.log('✅ OpenAI initialized successfully');
      } catch (error) {
        console.error('❌ OpenAI initialization failed:', error);
      }
    } else {
      console.log('⚠️ OpenAI not available - missing or invalid API key');
    }

    // Initialize Gemini
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here') {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.gemini = genAI.getGenerativeModel({ 
          model: 'gemini-1.5-flash',
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        });
        console.log('✅ Gemini initialized successfully');
      } catch (error) {
        console.error('❌ Gemini initialization failed:', error);
      }
    } else {
      console.log('⚠️ Gemini not available - missing or invalid API key');
    }

    // Initialize Claude
    if (process.env.CLAUDE_API_KEY && process.env.CLAUDE_API_KEY !== 'placeholder-claude-key') {
      try {
        this.claude = new Anthropic({
          apiKey: process.env.CLAUDE_API_KEY,
        });
        console.log('✅ Claude initialized successfully');
      } catch (error) {
        console.error('❌ Claude initialization failed:', error);
      }
    } else {
      console.log('⚠️ Claude not available - missing or invalid API key');
    }
  }

  private initializeStats(): void {
    this.stats.set('openai', {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalCost: 0,
      averageResponseTime: 0,
      lastUsed: null
    });
    
    this.stats.set('gemini', {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalCost: 0,
      averageResponseTime: 0,
      lastUsed: null
    });
  }

  private updateStats(provider: string, success: boolean, cost: number, responseTime: number): void {
    const stats = this.stats.get(provider);
    if (!stats) return;

    stats.totalRequests++;
    if (success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }
    stats.totalCost += cost;
    stats.averageResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
    stats.lastUsed = new Date();
    
    this.stats.set(provider, stats);
  }

  async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    const startTime = Date.now();
    let selectedProvider: AIProvider;
    let originalError: Error | null = null;
    let retryAttempted = false;

    try {
      // Select initial provider
      selectedProvider = this.selectProvider(request);
      console.log(`🚀 Starting content generation with provider: ${selectedProvider}`);

      let result: GeneratedContent;

      // Try primary provider
      try {
        if (selectedProvider === 'openai') {
          result = await this.generateWithOpenAI(request);
        } else if (selectedProvider === 'gemini') {
          result = await this.generateWithGemini(request);
        } else if (selectedProvider === 'claude') {
          result = await this.generateWithClaude(request);
        } else {
          throw new Error(`Unknown provider: ${selectedProvider}`);
        }

        // Success with primary provider
        const responseTime = Date.now() - startTime;
        this.updateStats(selectedProvider, true, result.metadata?.cost || 0, responseTime);

        console.log(`✅ Content generated successfully with ${selectedProvider} (${responseTime}ms)`);
        return {
          ...result,
          metadata: {
            ...result.metadata,
            selectedProvider,
            requestedProvider: request.preferredProvider || 'auto',
            selectionReason: 'primary_choice',
            responseTime
          }
        };

      } catch (primaryError) {
        originalError = primaryError as Error;
        console.error(`❌ Primary provider ${selectedProvider} failed:`, originalError.message);

        // Try alternative provider for retryable errors
        const isRetryable = this.isRetryableError(originalError);
        if (isRetryable) {
          const alternativeProvider = selectedProvider === 'openai' ? 'gemini' : selectedProvider === 'gemini' ? 'claude' : 'openai';
          
          if (this.isProviderAvailable(alternativeProvider)) {
            console.log(`🔄 Retrying with alternative provider: ${alternativeProvider}`);
            retryAttempted = true;
            
            try {
              if (alternativeProvider === 'openai') {
                result = await this.generateWithOpenAI(request);
              } else if (alternativeProvider === 'gemini') {
                result = await this.generateWithGemini(request);
              } else {
                result = await this.generateWithClaude(request);
              }

              // Success with alternative provider
              const responseTime = Date.now() - startTime;
              this.updateStats(alternativeProvider, true, result.metadata?.cost || 0, responseTime);

              console.log(`✅ Content generated successfully with fallback ${alternativeProvider} (${responseTime}ms)`);
              return {
                ...result,
                metadata: {
                  ...result.metadata,
                  selectedProvider: alternativeProvider,
                  requestedProvider: request.preferredProvider || 'auto',
                  selectionReason: 'fallback_after_error',
                  originalError: originalError.message,
                  responseTime
                }
              };
            } catch (secondaryError) {
              console.error(`❌ Alternative provider ${alternativeProvider} also failed:`, secondaryError);
              this.updateStats(alternativeProvider, false, 0, Date.now() - startTime);
              
              // Both providers failed - throw comprehensive error
              throw new Error(`All AI providers failed. Primary (${selectedProvider}): ${originalError.message}. Alternative (${alternativeProvider}): ${(secondaryError as Error).message}`);
            }
          } else {
            console.warn(`⚠️ Alternative provider not available, cannot retry`);
          }
        }

        // If not retryable or no alternative, throw original error
        throw originalError;
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update failure stats
      this.updateStats(selectedProvider!, false, 0, responseTime);
      
      console.error(`💥 Content generation completely failed after ${responseTime}ms:`, errorMessage);
      
      // NO FALLBACK CONTENT - Always throw real errors
      throw new Error(`AI content generation failed: ${errorMessage}. Please try again or check your AI provider configuration.`);
    }
  }

  private selectProvider(request: ContentGenerationRequest): AIProvider {
    // Manual selection takes priority
    if (request.preferredProvider && request.preferredProvider !== 'auto') {
      if (this.isProviderAvailable(request.preferredProvider)) {
        console.log(`🎯 Using manual selection: ${request.preferredProvider}`);
        return request.preferredProvider;
      }
      console.warn(`⚠️ Preferred provider ${request.preferredProvider} not available, falling back to auto`);
    }
    
    // Fallback priority: Claude -> OpenAI -> Gemini
    if (this.isProviderAvailable('claude')) {
      console.log(`🤖 Auto-selecting Claude (Default priority)`);
      return 'claude';
    }
    if (this.isProviderAvailable('openai')) {
        console.log(`🤖 Auto-selecting OpenAI (Default priority)`);
      return 'openai';
    }
    if (this.isProviderAvailable('gemini')) {
        console.log(`🤖 Auto-selecting Gemini (Default priority)`);
      return 'gemini';
    }

    console.log('⚠️ No providers available for auto-selection.');
    throw new Error('No AI providers available');
  }

  private assessProviderPerformance(): { preferOpenAI: boolean; preferGemini: boolean } {
    const openaiStats = this.stats.get('openai');
    const geminiStats = this.stats.get('gemini');
    
    if (!openaiStats || !geminiStats) {
      return { preferOpenAI: false, preferGemini: false };
    }
    
    // Calculate success rates
    const openaiSuccessRate = openaiStats.totalRequests > 0 
      ? openaiStats.successfulRequests / openaiStats.totalRequests 
      : 1;
    const geminiSuccessRate = geminiStats.totalRequests > 0 
      ? geminiStats.successfulRequests / geminiStats.totalRequests 
      : 1;
    
    // Prefer provider with significantly better success rate
    const successRateDiff = openaiSuccessRate - geminiSuccessRate;
    
    return {
      preferOpenAI: successRateDiff > 0.2, // OpenAI is 20% more reliable
      preferGemini: successRateDiff < -0.2  // Gemini is 20% more reliable
    };
  }

  private assessComplexity(request: ContentGenerationRequest): number {
    let score = 0;
    
    // Content type complexity
    if (request.type === 'blog_post') score += 0.4;
    if (request.type === 'email') score += 0.3;
    if (request.type === 'social_media') score += 0.1;
    if (request.type === 'ad_copy') score += 0.2;

    // Brand voice complexity
    if (request.brandVoice.vocabulary === 'industry-specific') score += 0.3;
    if (request.brandVoice.length === 'comprehensive') score += 0.2;
    if (request.brandVoice.style === 'technical') score += 0.2;

    // Requirements complexity - commented out as property doesn't exist
    // if (request.requirements?.seoOptimized) score += 0.1;
    // if (request.requirements?.includeHeadings) score += 0.1;
    if (request.context && request.context.length > 100) score += 0.1;

    return Math.min(score, 1.0);
  }

  private assessUrgency(request: ContentGenerationRequest): number {
    // For now, assume medium urgency
    // TODO: Add urgency field to ContentGenerationRequest
    return 0.5;
  }

  private assessCostSensitivity(request: ContentGenerationRequest): number {
    // For now, assume medium cost sensitivity
    // TODO: Add cost sensitivity field to ContentGenerationRequest
    return 0.5;
  }

  private async generateWithOpenAI(request: ContentGenerationRequest): Promise<GeneratedContent> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = this.buildPrompt(request);
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o', // Updated to GPT-4o for better performance and cost
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    });
    
    const textContent = response.choices[0].message.content || '';
    const { title, body } = this._parseAiResponse(textContent);
    const wordCount = this.countWords(body);
    
    // The new prompt returns raw HTML/text, not JSON, so we just use the content directly.
    return {
      id: `openai-${Date.now()}`,
      title: title,
      body: body,
      excerpt: this.generateExcerpt(body),
      type: request.type,
      status: 'draft' as ContentStatus,
      metadata: {
        provider: 'openai',
        aiModel: response.model,
        cost: this.calculateOpenAICost(response.usage?.total_tokens || 0),
        generatedAt: new Date().toISOString(),
        wordCount: wordCount,
        seoScore: this.calculateSEOScore(body, request.keywords),
        readabilityScore: this.calculateReadabilityScore(body),
        engagementScore: this.calculateEngagementScore(body),
        promptVersion: '2.0',
        tokensUsed: response.usage?.total_tokens || 0,
        safetyRatings: [],
      },
    };
  }

  private async generateWithGemini(request: ContentGenerationRequest): Promise<GeneratedContent> {
    if (!this.gemini) {
      throw new Error('Gemini client not initialized');
    }

    const prompt = this.buildPrompt(request);

    const result = await this.gemini.generateContent(prompt);
    const response = await result.response;
    const textContent = response.text();
    const { title, body } = this._parseAiResponse(textContent);
    const wordCount = this.countWords(body);

    return {
      id: `gemini-${Date.now()}`,
      title: title,
      body: body,
      excerpt: this.generateExcerpt(body),
      type: request.type,
      status: 'draft' as ContentStatus,
      metadata: {
        provider: 'gemini',
        aiModel: 'gemini-1.5-flash',
        cost: 0, // Gemini Flash is currently free
        generatedAt: new Date().toISOString(),
        wordCount: wordCount,
        seoScore: this.calculateSEOScore(body, request.keywords),
        readabilityScore: this.calculateReadabilityScore(body),
        engagementScore: this.calculateEngagementScore(body),
        promptVersion: '2.0',
        tokensUsed: 0, // Placeholder
        safetyRatings: response.candidates?.[0]?.safetyRatings || [],
      },
    };
  }

  private async generateWithClaude(request: ContentGenerationRequest): Promise<GeneratedContent> {
    if (!this.claude) {
      throw new Error('Claude client not initialized');
    }

    const prompt = this.buildPrompt(request);

    const response = await this.claude.messages.create({
      model: 'claude-3-haiku-20240307', // Cheapest and fastest Claude model for content writing
      max_tokens: 4096,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content[0].text || '';
    const { title, body } = this._parseAiResponse(textContent);
    const wordCount = this.countWords(body);

    return {
      id: `claude-${Date.now()}`,
      title: title,
      body: body,
      excerpt: this.generateExcerpt(body),
      type: request.type,
      status: 'draft' as ContentStatus,
      metadata: {
        provider: 'claude',
        aiModel: 'claude-3-haiku-20240307',
        cost: this.calculateClaudeCost(response.usage?.input_tokens || 0, response.usage?.output_tokens || 0),
        generatedAt: new Date().toISOString(),
        wordCount: wordCount,
        seoScore: this.calculateSEOScore(body, request.keywords),
        readabilityScore: this.calculateReadabilityScore(body),
        engagementScore: this.calculateEngagementScore(body),
        promptVersion: '2.0',
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        safetyRatings: [],
      },
    };
  }

  private buildPrompt(request: ContentGenerationRequest): string {
    const {
      type,
      topic,
      context,
      language = 'vietnamese',
      brandVoice,
      targetAudience,
      keywords,
      specialInstructions
    } = request;

    const brandName = brandVoice?.brandName || 'Your Brand';
    const tone = brandVoice?.tone || 'professional';

    if (type === 'blog_post') {
      return `You are an expert content writer and SEO specialist. Your task is to write a new, unique, and high-quality article based on the provided source material, suitable for a professional WordPress blog.

### CRITICAL RULES (Follow Strictly):
1.  **GENERATE THE TITLE**: Your first and most important task is to generate a compelling, SEO-friendly <h2> title for the article. This must be the very first line of your response.
2.  **ARTICLE LENGTH**: After the title, write a comprehensive, in-depth, and well-structured article. The length should be appropriate for a detailed blog post, typically between 800 and 1500 words. Do not write a short summary.
3.  **ORIGINAL CONTENT**: Do NOT copy the source article. Use it only as a reference for key information, facts, and ideas. You must write a completely new and original piece of content.
4.  **OUTPUT FORMAT**: The ENTIRE output must be valid HTML ready for a WordPress editor. Use <h3> for subheadings, <p> for paragraphs, <strong> for bolding key phrases, and <ul>/<li> for lists. Do NOT include <html>, <head>, or <body> tags.
5.  **LOGICAL STRUCTURE**: Create a new, logical, and engaging structure for the article. Do not mirror the structure of the source article.
6.  **IMAGE PLACEMENT (CRITICAL)**: Strategically place the placeholder \`[INSERT_IMAGE]\` 3 to 5 times where an image would be most effective. Place it on a new line AFTER a paragraph.
7.  **LANGUAGE**: Write exclusively in ${language === 'vietnamese' ? 'VIETNAMESE' : 'ENGLISH'}.
8.  **BRAND INTEGRATION**: If you find competitor brands mentioned, replace them with "${brandName}". Mention "${brandName}" naturally 1-2 times if relevant.
9.  **AUDIENCE & TONE**: Write for a "${targetAudience}" audience using a ${tone} tone.
10. **KEYWORD INTEGRATION**: Weave these keywords naturally into the article: "${keywords?.join(', ')}".
11. **SPECIAL INSTRUCTIONS**: ${specialInstructions || 'None.'}

### SOURCE MATERIAL FOR REFERENCE:
---
**Original Topic Suggestion:** ${topic}
**Source Content Snippet:**
${context}
---

### FINAL REMINDER:
- Your output must begin directly with the <h2> title tag. Do not add any meta-commentary.

Provide ONLY the final HTML content.`;
    }

    if (type === 'social_media') {
      return `You are an expert social media manager. Your task is to transform the 'SOURCE ARTICLE' into a highly engaging Facebook post.

### CRITICAL RULES (Follow Strictly):
1.  **POST LENGTH**: Keep the post concise, scannable, and engaging, suitable for a Facebook feed. Aim for a length of 100-250 words.
2.  **HOOK**: Start with a compelling question or a bold statement.
3.  **READABILITY**: Use short paragraphs and relevant emojis (2-4).
4.  **VALUE & CTA**: Summarize the key point and end with a Call-To-Action.
5.  **HASHTAGS**: Include 3-5 relevant hashtags.
6.  **LANGUAGE**: Write exclusively in ${language === 'vietnamese' ? 'VIETNAMESE' : 'ENGLISH'}.
7.  **TONE**: Write for "${targetAudience}" with a ${tone} tone.
8.  **BRAND REPLACEMENT**: Replace competitor brands with "${brandName}".
9.  **KEYWORD INTEGRATION**: Naturally integrate these keywords: "${keywords?.join(', ')}".
10. **SPECIAL INSTRUCTIONS**: ${specialInstructions || 'None.'}

### SOURCE ARTICLE TO TRANSFORM:
---
**Original Title:** ${topic}
**Complete Source Content:**
${context}
---

### OUTPUT REQUIREMENTS:
Provide ONLY the final text for the Facebook post. Do not add any meta-commentary.`;
    }
    
    // Fallback for unknown types
    return `Rewrite the following content: ${context}`;
  }

  private _parseAiResponse(html: string): { title: string; body: string } {
    const titleMatch = html.match(/<h2[^>]*>(.*?)<\/h2>/i);
    let title = 'Untitled';
    let body = html;

    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
      // Remove the matched h2 tag from the body to avoid duplication
      body = html.replace(/<h2[^>]*>.*?<\/h2>\s*/i, '');
    }

    return { title, body };
  }

  private parseTextContent(text: string, type: string): any {
    // Simple text parsing fallback
    const lines = text.split('\n').filter(line => line.trim());
    const title = lines[0] || `Generated ${type.replace('_', ' ')}`;
    const body = lines.slice(1).join('\n\n');
    
    return {
      title,
      body,
      excerpt: this.generateExcerpt(body),
      metadata: {
        provider: 'fallback',
        aiModel: 'template',
        cost: 0,
        generatedAt: new Date().toISOString(),
        wordCount: this.countWords(body),
        seoScore: 75,
        readabilityScore: 80,
        engagementScore: 70,
        promptVersion: '1.0',
        tokensUsed: 0
      }
    };
  }

  private parseNaturalTextContent(text: string, request: ContentGenerationRequest): any {
    console.log('🔍 Parsing natural text content from detailed prompt');
    
    // Clean the text and extract content
    let cleanText = text.trim();
    
    // Remove HTML wrapper if present (<!DOCTYPE>, <html>, <head>, <body> tags)
    if (cleanText.includes('<!DOCTYPE') || cleanText.includes('<html')) {
      // Extract content from body tag
      const bodyMatch = cleanText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        cleanText = bodyMatch[1].trim();
      } else {
        // If no body tag found, remove common wrapper tags manually
        cleanText = cleanText
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<body[^>]*>/gi, '')
          .replace(/<\/body>/gi, '')
          .trim();
      }
    }
    
    // Extract title - look for first h1 tag or first line
    let title = '';
    let body = cleanText;
    
    // Try to find h1 heading first
    const h1Match = cleanText.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) {
      title = h1Match[1].replace(/<[^>]*>/g, '').trim(); // Remove any HTML tags from title
      // Remove the title from body
      body = cleanText.replace(/<h1[^>]*>.*?<\/h1>/i, '').trim();
    } else {
      // Try markdown-style heading
      const markdownH1 = cleanText.match(/^#+\s+(.+)$/m);
      if (markdownH1) {
        title = markdownH1[1].trim();
        body = cleanText.replace(/^#+\s+.+$/m, '').trim();
      } else {
        // Fallback: use first line if it's short enough
        const lines = cleanText.split('\n');
        const firstLine = lines[0]?.replace(/<[^>]*>/g, '').trim();
        if (firstLine && firstLine.length < 100 && firstLine.length > 10) {
          title = firstLine;
          body = lines.slice(1).join('\n').trim();
        } else {
          // Generate title from request topic
          title = request.topic;
        }
      }
    }
    
    // Ensure we have clean WordPress-ready HTML content
    // Remove any remaining problematic tags but keep content structure
    body = body
      .replace(/<title[^>]*>.*?<\/title>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/^\s*<[^>]*>\s*$/gm, '') // Remove lines with only HTML tags
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up excessive line breaks
      .trim();
    
    console.log(`📝 Extracted title: "${title}"`);
    console.log(`📄 Content length: ${body.length} characters`);
    
    return {
      title: title || `Generated ${request.type.replace('_', ' ')}`,
      body: body,
      excerpt: this.generateExcerpt(body),
    };
  }

  private calculateOpenAICost(tokens: number): number {
    // GPT-4o pricing: $5/1M input tokens, $15/1M output tokens (average ~$10/1M)
    return (tokens / 1000000) * 10;
  }

  private calculateClaudeCost(inputTokens: number, outputTokens: number): number {
    // Claude 3 Haiku pricing: $0.25/1M input tokens, $1.25/1M output tokens
    const inputCost = (inputTokens / 1000000) * 0.25;
    const outputCost = (outputTokens / 1000000) * 1.25;
    return inputCost + outputCost;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private generateExcerpt(text: string, maxLength: number = 150): string {
    const cleaned = text.replace(/[#*]/g, '').trim();
    return cleaned.length > maxLength 
      ? cleaned.substring(0, maxLength).trim() + '...'
      : cleaned;
  }

  private calculateSEOScore(content: string, keywords: string[]): number {
    let score = 60;
    
    const lowerContent = content.toLowerCase();
    
    keywords.forEach(keyword => {
      if (lowerContent.includes(keyword.toLowerCase())) {
        score += 10;
      }
    });
    
    const wordCount = this.countWords(content);
    if (wordCount >= 300) score += 10;
    if (wordCount >= 1000) score += 5;
    
    if (content.includes('#')) score += 10;
    
    return Math.min(score, 100);
  }

  private calculateReadabilityScore(content: string): number {
    const words = this.countWords(content);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const syllables = this.countSyllables(content);
    
    // Avoid division by zero
    if (sentences === 0 || words === 0) return 75; // Default good score
    
    // Flesch Reading Ease formula
    const avgWordsPerSentence = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    let score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    
    // Normalize score to 0-100 range with better distribution
    score = Math.max(0, Math.min(100, score));
    
    // Adjust for content type - blog posts should be more readable
    if (score < 30) score = 30; // Minimum readability
    if (score > 90) score = 90; // Maximum readability
    
    console.log(`📊 Readability calculation:
    - Words: ${words}
    - Sentences: ${sentences}
    - Syllables: ${syllables}
    - Avg words/sentence: ${avgWordsPerSentence.toFixed(2)}
    - Avg syllables/word: ${avgSyllablesPerWord.toFixed(2)}
    - Raw score: ${(206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)).toFixed(2)}
    - Final score: ${score.toFixed(2)}`);
    
    return Math.round(score);
  }

  private calculateEngagementScore(content: string): number {
    let score = 50;
    
    const lowerContent = content.toLowerCase();
    
    if (content.includes('?')) score += 10;
    
    const ctaWords = ['discover', 'learn', 'explore', 'find out', 'get started', 'try', 'join'];
    ctaWords.forEach(word => {
      if (lowerContent.includes(word)) score += 5;
    });
    
    const emotionalWords = ['amazing', 'incredible', 'powerful', 'essential', 'important'];
    emotionalWords.forEach(word => {
      if (lowerContent.includes(word)) score += 3;
    });
    
    return Math.min(score, 100);
  }

  private countSyllables(text: string): number {
    const words: string[] = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    return words.reduce((total: number, word: string) => {
      // Remove silent 'e' at the end
      let cleanWord = word.replace(/e$/, '');
      
      // Count vowel groups
      const vowelGroups = cleanWord.match(/[aeiouy]+/g) || [];
      let syllableCount = vowelGroups.length;
      
      // Every word has at least 1 syllable
      syllableCount = Math.max(1, syllableCount);
      
      // Adjust for common patterns
      if (word.endsWith('le') && word.length > 2) syllableCount++;
      if (word.endsWith('ed') && !word.endsWith('ted') && !word.endsWith('ded')) syllableCount--;
      
      return total + Math.max(1, syllableCount);
    }, 0);
  }

  // Provider status methods
  getAvailableProviders(): { provider: string; available: boolean; cost: string }[] {
    return [
      {
        provider: 'openai',
        available: !!this.openai,
        cost: 'Pay per use (~$0.01-0.03/1K tokens)'
      },
      {
        provider: 'gemini',
        available: !!this.gemini,
        cost: 'Free (1,500 requests/day)'
      },
      {
        provider: 'claude',
        available: !!this.claude,
        cost: 'Low cost ($0.25-1.25/1M tokens)'
      }
    ];
  }

  getCurrentProvider(): AIProvider {
    return this.provider;
  }

  async getAvailableModels(): Promise<any[]> {
    const models = [];
    
    // Add OpenAI models if available
    if (this.openai) {
      models.push({
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        capabilities: ['text-generation', 'content-optimization', 'advanced-reasoning', 'multimodal'],
        costPerToken: 0.01, // GPT-4o is more cost-effective
        maxTokens: 4096,
        recommended: this.provider === 'openai',
        status: 'available'
      });
    }
    
    // Add Gemini models if available
    if (this.gemini) {
      models.push({
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        capabilities: ['text-generation', 'content-optimization', 'fast-generation'],
        costPerToken: 0,
        maxTokens: 1000000,
        recommended: this.provider === 'gemini',
        status: 'available'
      });
    }
    
         // Add Claude models if available
     if (this.claude) {
       models.push({
         id: 'claude-3-haiku-20240307',
         name: 'Claude 3 Haiku',
         provider: 'claude',
         capabilities: ['text-generation', 'content-optimization', 'advanced-reasoning', 'fast-generation'],
         costPerToken: 0.0015, // Average cost per 1K tokens
         maxTokens: 200000,
         recommended: this.provider === 'claude',
         status: 'available'
       });
     }
    
    return models;
  }

  async analyzeContent(contentId: string): Promise<ContentAnalysisResult> {
    return {
      contentId,
      qualityScore: 85,
      seoScore: 78,
      readabilityScore: 82,
      engagementScore: 76,
      keywordDensity: {},
      suggestions: [
        'Consider adding more relevant keywords for better SEO',
        'Break up long paragraphs for better readability',
        'Add a stronger call-to-action at the end'
      ],
      metadata: {
        analyzedAt: new Date().toISOString(),
        provider: 'openai'
      }
    };
  }

  async generateImprovements(contentId: string, feedback: string): Promise<ImprovementSuggestion[]> {
    return [
      {
        type: 'content',
        priority: 'high',
        suggestion: 'Add more specific examples',
        impact: 'Increase reader engagement'
      }
    ];
  }

  async getUsageStats(): Promise<any> {
    const openaiStats = this.stats.get('openai');
    const geminiStats = this.stats.get('gemini');
    const claudeStats = this.stats.get('claude');
    
    const totalRequests = (openaiStats?.totalRequests || 0) + (geminiStats?.totalRequests || 0) + (claudeStats?.totalRequests || 0);
    const totalSuccessful = (openaiStats?.successfulRequests || 0) + (geminiStats?.successfulRequests || 0) + (claudeStats?.successfulRequests || 0);
    const totalCost = (openaiStats?.totalCost || 0) + (geminiStats?.totalCost || 0) + (claudeStats?.totalCost || 0);
    
    const openaiResponseTime = openaiStats?.averageResponseTime || 0;
    const geminiResponseTime = geminiStats?.averageResponseTime || 0;
    const claudeResponseTime = claudeStats?.averageResponseTime || 0;
    const weightedAvgResponseTime = totalRequests > 0 
      ? ((openaiStats?.totalRequests || 0) * openaiResponseTime + (geminiStats?.totalRequests || 0) * geminiResponseTime + (claudeStats?.totalRequests || 0) * claudeResponseTime) / totalRequests
      : 0;

    return {
      totalRequests,
      openaiRequests: openaiStats?.totalRequests || 0,
      geminiRequests: geminiStats?.totalRequests || 0,
      claudeRequests: claudeStats?.totalRequests || 0,
      totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
      averageResponseTime: Math.round(weightedAvgResponseTime),
      successRate: totalRequests > 0 ? Math.round((totalSuccessful / totalRequests) * 100) : 100,
      currentProvider: this.provider,
      availableProviders: this.getAvailableProviders(),
      providerStats: {
        openai: {
          requests: openaiStats?.totalRequests || 0,
          successRate: openaiStats && openaiStats.totalRequests > 0 
            ? Math.round((openaiStats.successfulRequests / openaiStats.totalRequests) * 100) 
            : 100,
          avgResponseTime: Math.round(openaiStats?.averageResponseTime || 0),
          totalCost: Math.round((openaiStats?.totalCost || 0) * 10000) / 10000,
          lastUsed: openaiStats?.lastUsed?.toISOString() || null
        },
        gemini: {
          requests: geminiStats?.totalRequests || 0,
          successRate: geminiStats && geminiStats.totalRequests > 0 
            ? Math.round((geminiStats.successfulRequests / geminiStats.totalRequests) * 100) 
            : 100,
          avgResponseTime: Math.round(geminiStats?.averageResponseTime || 0),
          totalCost: 0, // Always free
          lastUsed: geminiStats?.lastUsed?.toISOString() || null
        },
        claude: {
          requests: claudeStats?.totalRequests || 0,
          successRate: claudeStats && claudeStats.totalRequests > 0 
            ? Math.round((claudeStats.successfulRequests / claudeStats.totalRequests) * 100) 
            : 100,
          avgResponseTime: Math.round(claudeStats?.averageResponseTime || 0),
          totalCost: 0, // Always free
          lastUsed: claudeStats?.lastUsed?.toISOString() || null
        }
      },
      period: 'session-based',
      recommendations: this.generateUsageRecommendations(openaiStats, geminiStats, claudeStats)
    };
  }

  private generateUsageRecommendations(openaiStats?: ProviderStats, geminiStats?: ProviderStats, claudeStats?: ProviderStats): string[] {
    const recommendations: string[] = [];
    
    if (!openaiStats && !geminiStats && !claudeStats) {
      recommendations.push("No usage data available yet. Start generating content to see recommendations.");
      return recommendations;
    }
    
    const totalCost = (openaiStats?.totalCost || 0) + (geminiStats?.totalCost || 0) + (claudeStats?.totalCost || 0);
    const openaiRequests = openaiStats?.totalRequests || 0;
    const geminiRequests = geminiStats?.totalRequests || 0;
    const claudeRequests = claudeStats?.totalRequests || 0;
    
    // Cost optimization recommendations
    if (totalCost > 5) {
      recommendations.push("Consider using Gemini for simpler content to reduce costs.");
    }
    
    if (openaiRequests > geminiRequests * 3) {
      recommendations.push("You're using OpenAI frequently. Try Gemini for social media and simple content.");
    }
    
    if (openaiRequests > claudeRequests * 3) {
      recommendations.push("You're using Claude frequently. Try OpenAI for more complex content.");
    }
    
    // Performance recommendations
    if (openaiStats && openaiStats.averageResponseTime > 10000) {
      recommendations.push("OpenAI response times are high. Consider using Gemini for faster generation.");
    }
    
    if (geminiStats && geminiStats.successfulRequests / geminiStats.totalRequests < 0.8) {
      recommendations.push("Gemini success rate is low. Consider using OpenAI for better reliability.");
    }
    
    if (claudeStats && claudeStats.successfulRequests / claudeStats.totalRequests < 0.8) {
      recommendations.push("Claude success rate is low. Consider using OpenAI for better reliability.");
    }
    
    // Usage pattern recommendations
    if (openaiRequests + geminiRequests + claudeRequests > 50) {
      recommendations.push("High usage detected. Consider implementing content caching to reduce API calls.");
    }
    
    if (recommendations.length === 0) {
      recommendations.push("Your usage patterns look optimal. Keep up the good work!");
    }
    
    return recommendations;
  }

  private isProviderAvailable(provider: string): boolean {
    if (provider === 'openai' && this.openai) return true;
    if (provider === 'gemini' && this.gemini) return true;
    if (provider === 'claude' && this.claude) return true;
    return false;
  }

  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'timeout',
      'rate limit',
      'service unavailable',
      'connection',
      'network',
      '503',
      '502',
      '500',
      '429'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }
} 