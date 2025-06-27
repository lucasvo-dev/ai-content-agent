import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { 
  ContentGenerationRequest, 
  GeneratedContent, 
  BrandVoice,
  ContentAnalysisResult,
  ImprovementSuggestion 
} from '../types/content.js';

export type AIProvider = 'openai' | 'gemini' | 'hybrid';

interface ProviderStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalCost: number;
  averageResponseTime: number;
  lastUsed: Date | null;
}

export class HybridAIService {
  private openai: OpenAI | null = null;
  private gemini: any = null;
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
          const alternativeProvider = selectedProvider === 'openai' ? 'gemini' : 'openai';
          
          if (this.isProviderAvailable(alternativeProvider)) {
            console.log(`🔄 Retrying with alternative provider: ${alternativeProvider}`);
            retryAttempted = true;
            
            try {
              if (alternativeProvider === 'openai') {
                result = await this.generateWithOpenAI(request);
              } else {
                result = await this.generateWithGemini(request);
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
    
    // Auto selection: Prefer Gemini for reliability and speed
    // Only use OpenAI for very complex content requiring premium quality
    const complexity = this.assessComplexity(request);
    const urgency = this.assessUrgency(request);
    
    // Prefer Gemini for most cases (fast, reliable, free)
    if (this.isProviderAvailable('gemini')) {
      // Only use OpenAI for very high complexity content
      if (complexity > 0.8 && urgency < 0.5 && this.isProviderAvailable('openai')) {
        console.log('🔵 Auto-selected OpenAI for high complexity content');
        return 'openai';
      }
      console.log('🟢 Auto-selected Gemini for fast, reliable generation');
      return 'gemini';
    }
    
    // Fallback to OpenAI if Gemini unavailable
    if (this.isProviderAvailable('openai')) {
      console.log('🔵 Auto-selected OpenAI (Gemini unavailable)');
      return 'openai';
    }
    
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

    // Requirements complexity
    if (request.requirements?.seoOptimized) score += 0.1;
    if (request.requirements?.includeHeadings) score += 0.1;
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
      model: 'gpt-4-turbo-preview', // Or a model of your choice
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    });
    
    const textContent = response.choices[0].message.content || '';
    const wordCount = this.countWords(textContent);
    
    // The new prompt returns raw HTML/text, not JSON, so we just use the content directly.
    return {
      id: `openai-${Date.now()}`,
      title: request.topic, // We can improve title generation later
      body: textContent,
      excerpt: this.generateExcerpt(textContent),
      type: request.type,
      metadata: {
        provider: 'openai',
        aiModel: response.model,
        cost: this.calculateOpenAICost(response.usage?.total_tokens || 0),
        generatedAt: new Date().toISOString(),
        wordCount: wordCount,
        seoScore: this.calculateSEOScore(textContent, request.keywords),
        readabilityScore: this.calculateReadabilityScore(textContent),
        engagementScore: this.calculateEngagementScore(textContent),
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
    const wordCount = this.countWords(textContent);

    return {
      id: `gemini-${Date.now()}`,
      title: request.topic, // We can improve title generation later
      body: textContent,
      excerpt: this.generateExcerpt(textContent),
      type: request.type,
      metadata: {
        provider: 'gemini',
        aiModel: 'gemini-1.5-flash',
        cost: 0, // Gemini Flash is currently free
        generatedAt: new Date().toISOString(),
        wordCount: wordCount,
        seoScore: this.calculateSEOScore(textContent, request.keywords),
        readabilityScore: this.calculateReadabilityScore(textContent),
        engagementScore: this.calculateEngagementScore(textContent),
        promptVersion: '2.0',
        tokensUsed: 0, // Placeholder
        safetyRatings: response.candidates?.[0]?.safetyRatings || [],
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
      return `You are an expert content writer specializing in WordPress blog content. Your task is to transform the 'SOURCE ARTICLE' into high-quality WordPress-ready content.

### CRITICAL RULES (Follow Strictly):
1.  **OUTPUT FORMAT**: The ENTIRE output must be valid HTML ready for WordPress editor. Use proper HTML tags. DO NOT include <html>, <head>, <body> tags.
2.  **HTML STRUCTURE**: Use <h2> for main titles, <h3> for subsections, <p> for paragraphs, <strong> for bolding, and <ul>/<li> for lists.
3.  **STRUCTURAL MIRRORING**: You MUST mirror the structure of the source article.
4.  **LENGTH REQUIREMENT**: The final article MUST contain at least 1000 words. Expand on the source material with valuable insights, examples, and details.
5.  **IMAGE PLACEMENT (CRITICAL)**: Strategically place the placeholder \`[INSERT_IMAGE]\` 3 to 5 times where an image would be most effective. Place it AFTER a paragraph.
6.  **LANGUAGE**: Write exclusively in ${language === 'vietnamese' ? 'VIETNAMESE' : 'ENGLISH'}.
7.  **CONTENT FIDELITY & REWRITING**: Base the content EXCLUSIVELY on the 'SOURCE ARTICLE' but rewrite every sentence.
8.  **BRAND INTEGRATION**: If you find competitor brands, replace them with "${brandName}".
9.  **AUDIENCE/TONE**: Write for "${targetAudience}" with a ${tone} tone.
10. **KEYWORD INTEGRATION**: Weave these keywords naturally into the article: "${keywords?.join(', ')}".
11. **SPECIAL INSTRUCTIONS**: ${specialInstructions || 'None.'}

### SOURCE ARTICLE TO TRANSFORM:
---
**Original Title:** ${topic}
**Complete Source Content:**
${context}
---

### OUTPUT REQUIREMENTS:
Provide ONLY the final HTML content. Do not add any meta-commentary.`;
    }

    if (type === 'social_media') {
      return `You are an expert social media manager. Your task is to transform the 'SOURCE ARTICLE' into a highly engaging Facebook post.

### CRITICAL RULES (Follow Strictly):
1.  **HOOK**: Start with a compelling question or a bold statement.
2.  **READABILITY**: Use short paragraphs and relevant emojis (2-4).
3.  **VALUE & CTA**: Summarize the key point and end with a Call-To-Action.
4.  **HASHTAGS**: Include 3-5 relevant hashtags.
5.  **LANGUAGE**: Write exclusively in ${language === 'vietnamese' ? 'VIETNAMESE' : 'ENGLISH'}.
6.  **TONE**: Write for "${targetAudience}" with a ${tone} tone.
7.  **BRAND REPLACEMENT**: Replace competitor brands with "${brandName}".
8.  **KEYWORD INTEGRATION**: Naturally integrate these keywords: "${keywords?.join(', ')}".
9. **SPECIAL INSTRUCTIONS**: ${specialInstructions || 'None.'}

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
    // GPT-4 Turbo pricing: $0.01 per 1K tokens (input) + $0.03 per 1K tokens (output)
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;
    return (inputTokens / 1000 * 0.01) + (outputTokens / 1000 * 0.03);
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
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        capabilities: ['text-generation', 'content-optimization', 'advanced-reasoning'],
        costPerToken: 0.02, // Average cost
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
    
    return models;
  }

  async analyzeContent(contentId: string): Promise<ContentAnalysisResult> {
    return {
      contentId,
      qualityScore: 85,
      seoScore: 78,
      readabilityScore: 82,
      engagementScore: 76,
      suggestions: [
        {
          type: 'seo',
          priority: 'medium',
          description: 'Consider adding more relevant keywords',
          impact: 'Could improve search ranking'
        }
      ],
      analyzedAt: new Date().toISOString()
    };
  }

  async generateImprovements(contentId: string, feedback: string): Promise<ImprovementSuggestion[]> {
    return [
      {
        type: 'structure',
        priority: 'high',
        description: 'Add more specific examples',
        impact: 'Increase reader engagement'
      }
    ];
  }

  async getUsageStats(): Promise<any> {
    const openaiStats = this.stats.get('openai');
    const geminiStats = this.stats.get('gemini');
    
    const totalRequests = (openaiStats?.totalRequests || 0) + (geminiStats?.totalRequests || 0);
    const totalSuccessful = (openaiStats?.successfulRequests || 0) + (geminiStats?.successfulRequests || 0);
    const totalCost = (openaiStats?.totalCost || 0) + (geminiStats?.totalCost || 0);
    
    const openaiResponseTime = openaiStats?.averageResponseTime || 0;
    const geminiResponseTime = geminiStats?.averageResponseTime || 0;
    const weightedAvgResponseTime = totalRequests > 0 
      ? ((openaiStats?.totalRequests || 0) * openaiResponseTime + (geminiStats?.totalRequests || 0) * geminiResponseTime) / totalRequests
      : 0;

    return {
      totalRequests,
      openaiRequests: openaiStats?.totalRequests || 0,
      geminiRequests: geminiStats?.totalRequests || 0,
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
        }
      },
      period: 'session-based',
      recommendations: this.generateUsageRecommendations(openaiStats, geminiStats)
    };
  }

  private generateUsageRecommendations(openaiStats?: ProviderStats, geminiStats?: ProviderStats): string[] {
    const recommendations: string[] = [];
    
    if (!openaiStats && !geminiStats) {
      recommendations.push("No usage data available yet. Start generating content to see recommendations.");
      return recommendations;
    }
    
    const totalCost = (openaiStats?.totalCost || 0) + (geminiStats?.totalCost || 0);
    const openaiRequests = openaiStats?.totalRequests || 0;
    const geminiRequests = geminiStats?.totalRequests || 0;
    
    // Cost optimization recommendations
    if (totalCost > 5) {
      recommendations.push("Consider using Gemini for simpler content to reduce costs.");
    }
    
    if (openaiRequests > geminiRequests * 3) {
      recommendations.push("You're using OpenAI frequently. Try Gemini for social media and simple content.");
    }
    
    // Performance recommendations
    if (openaiStats && openaiStats.averageResponseTime > 10000) {
      recommendations.push("OpenAI response times are high. Consider using Gemini for faster generation.");
    }
    
    if (geminiStats && geminiStats.successfulRequests / geminiStats.totalRequests < 0.8) {
      recommendations.push("Gemini success rate is low. Consider using OpenAI for better reliability.");
    }
    
    // Usage pattern recommendations
    if (openaiRequests + geminiRequests > 50) {
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