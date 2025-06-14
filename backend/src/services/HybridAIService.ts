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
    console.log('🚀 HybridAIService: Starting content generation');
    console.log('Request details:', {
      type: request.type,
      topic: request.topic,
      preferredProvider: request.preferredProvider || 'auto',
      brandVoice: request.brandVoice
    });

    try {
      // Select provider based on request and strategy
      const selectedProvider = this.selectProvider(request);
      console.log(`🎯 Selected provider: ${selectedProvider}`);

      let result: GeneratedContent;
      let providerUsed = selectedProvider;

      if (selectedProvider === 'openai' && this.openai) {
        console.log('🤖 Using OpenAI for generation');
        result = await this.generateWithOpenAI(request);
      } else if (selectedProvider === 'gemini' && this.gemini) {
        console.log('🧠 Using Gemini for generation');
        result = await this.generateWithGemini(request);
      } else {
        console.log('📝 Using fallback template generation');
        result = await this.generateFallbackContent(request);
        providerUsed = 'fallback';
      }

      // Add provider selection info to metadata
      result.metadata = {
        ...result.metadata,
        selectedProvider,
        requestedProvider: request.preferredProvider || 'auto',
        selectionReason: request.preferredProvider && request.preferredProvider !== 'auto' 
          ? 'manual_selection' 
          : 'intelligent_selection',
        responseTime: Date.now() - startTime
      };

      // Update stats
      const responseTime = Date.now() - startTime;
      this.updateStats(providerUsed, true, result.metadata.cost || 0, responseTime);

      console.log('✅ Content generation completed successfully');
      console.log(`⏱️ Response time: ${responseTime}ms`);
      return result;

    } catch (error) {
      console.error('❌ Content generation failed:', error);
      
      // Update stats for failure
      const responseTime = Date.now() - startTime;
      const attemptedProvider = this.selectProvider(request);
      this.updateStats(attemptedProvider, false, 0, responseTime);
      
      // Try fallback if primary generation fails
      console.log('🔄 Attempting fallback generation');
      const fallbackResult = await this.generateFallbackContent(request);
      
      fallbackResult.metadata = {
        ...fallbackResult.metadata,
        selectedProvider: 'fallback',
        requestedProvider: request.preferredProvider || 'auto',
        selectionReason: 'error_fallback',
        originalError: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
      
      return fallbackResult;
    }
  }

  private selectProvider(request: ContentGenerationRequest): AIProvider {
    // Manual selection takes priority
    if (request.preferredProvider && request.preferredProvider !== 'auto') {
      console.log(`🎯 Manual provider selection: ${request.preferredProvider}`);
      
      // Validate provider availability and return immediately if valid
      if (request.preferredProvider === 'openai' && this.openai) {
        console.log('✅ Manual OpenAI selection - provider available');
        return 'openai';
      }
      if (request.preferredProvider === 'gemini' && this.gemini) {
        console.log('✅ Manual Gemini selection - provider available');
        return 'gemini';
      }
      
      // Fallback if preferred provider not available
      console.log(`⚠️ Preferred provider ${request.preferredProvider} not available, falling back to intelligent selection`);
    }

    // Existing intelligent selection logic only if no manual selection or manual selection failed
    if (this.provider === 'openai' && this.openai) return 'openai';
    if (this.provider === 'gemini' && this.gemini) return 'gemini';

    // Hybrid strategy - intelligent selection with performance consideration
    const factors = {
      complexity: this.assessComplexity(request),
      urgency: this.assessUrgency(request),
      cost: this.assessCostSensitivity(request),
      performance: this.assessProviderPerformance(),
    };

    console.log('Selection factors:', factors);

    // Use OpenAI for complex, high-value content or when Gemini performance is poor
    if (factors.complexity > 0.7 || 
        (factors.urgency < 0.5 && factors.cost < 0.5) ||
        factors.performance.preferOpenAI) {
      return this.openai ? 'openai' : (this.gemini ? 'gemini' : 'openai');
    }

    // Use Gemini for simpler, cost-sensitive content
    return this.gemini ? 'gemini' : (this.openai ? 'openai' : 'gemini');
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
    console.log('🔵 Using OpenAI GPT-4 Turbo...');

    const prompt = this.buildPrompt(request);
    
    try {
      const completion = await this.openai!.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content creator specializing in high-quality, engaging content that converts. Always return valid JSON with the specified structure. Focus on creating valuable, actionable content that resonates with the target audience.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000, // Reduced for faster response
        response_format: { type: 'json_object' },
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No content generated from OpenAI');
      }

      let parsedContent;
      try {
        parsedContent = JSON.parse(responseContent);
      } catch (parseError) {
        console.warn('❌ OpenAI JSON parsing failed, using text fallback');
        parsedContent = this.parseTextContent(responseContent, request.type);
      }
      
      return {
        id: `openai-${Date.now()}`,
        title: parsedContent.title,
        body: parsedContent.body,
        excerpt: parsedContent.excerpt || this.generateExcerpt(parsedContent.body),
        type: request.type,
        metadata: {
          provider: 'openai',
          aiModel: 'gpt-4-turbo-preview',
          cost: this.calculateOpenAICost(completion.usage?.total_tokens || 0),
          generatedAt: new Date().toISOString(),
          wordCount: this.countWords(parsedContent.body),
          seoScore: this.calculateSEOScore(parsedContent.body, request.keywords),
          readabilityScore: this.calculateReadabilityScore(parsedContent.body),
          engagementScore: this.calculateEngagementScore(parsedContent.body),
          promptVersion: '1.0',
          tokensUsed: completion.usage?.total_tokens || 0,
          finishReason: completion.choices[0]?.finish_reason
        }
      };
    } catch (error) {
      console.error('❌ OpenAI generation failed:', error);
      throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateWithGemini(request: ContentGenerationRequest): Promise<GeneratedContent> {
    console.log('🟢 Using Google Gemini Flash...');

    const prompt = this.buildPrompt(request);
    
    try {
      const result = await this.gemini.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('🔍 Gemini raw response:', text.substring(0, 200) + '...');

      // Try to parse as JSON, fallback to text processing
      let parsedContent;
      try {
        // Remove markdown code blocks if present
        let cleanText = text.replace(/```json\s*/g, '').replace(/\s*```/g, '').trim();
        console.log('🧹 Cleaned text:', cleanText.substring(0, 200) + '...');
        
        // Find JSON object
        const jsonStart = cleanText.indexOf('{');
        const jsonEnd = cleanText.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const jsonString = cleanText.substring(jsonStart, jsonEnd + 1);
          console.log('📋 Extracted JSON:', jsonString.substring(0, 100) + '...');
          
          parsedContent = JSON.parse(jsonString);
          console.log('✅ Successfully parsed JSON:', { 
            title: parsedContent.title?.substring(0, 50), 
            bodyLength: parsedContent.body?.length 
          });
        } else {
          throw new Error('No valid JSON structure found');
        }
      } catch (parseError) {
        console.warn('❌ Gemini JSON parsing failed:', parseError instanceof Error ? parseError.message : 'Unknown error');
        console.log('🔄 Using text parsing fallback');
        parsedContent = this.parseTextContent(text, request.type);
      }

      // Validate parsed content
      if (!parsedContent.title || !parsedContent.body) {
        console.warn('⚠️ Incomplete content from Gemini, using fallback');
        parsedContent = this.parseTextContent(text, request.type);
      }

      return {
        id: `gemini-${Date.now()}`,
        title: parsedContent.title,
        body: parsedContent.body,
        excerpt: parsedContent.excerpt || this.generateExcerpt(parsedContent.body),
        type: request.type,
        metadata: {
          provider: 'gemini',
          aiModel: 'gemini-1.5-flash',
          cost: 0, // Free!
          generatedAt: new Date().toISOString(),
          wordCount: this.countWords(parsedContent.body),
          seoScore: this.calculateSEOScore(parsedContent.body, request.keywords),
          readabilityScore: this.calculateReadabilityScore(parsedContent.body),
          engagementScore: this.calculateEngagementScore(parsedContent.body),
          promptVersion: '1.0',
          tokensUsed: 0,
          safetyRatings: result.response.candidates?.[0]?.safetyRatings || []
        }
      };
    } catch (error) {
      console.error('❌ Gemini generation failed:', error);
      throw new Error(`Gemini generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(request: ContentGenerationRequest): string {
    const wordCountText = request.requirements?.wordCount || '500-800 words';
    
    return `Write a ${request.type.replace('_', ' ')} about "${request.topic}" for ${request.targetAudience}.

Style: ${request.brandVoice.tone}, ${request.brandVoice.style}, ${request.brandVoice.vocabulary} vocabulary
Length: ${wordCountText}
Keywords: ${request.keywords.join(', ')}
${request.requirements?.includeHeadings ? 'Include headings. ' : ''}${request.requirements?.includeCTA ? 'Include call-to-action. ' : ''}

WRITING RULES:
- Short sentences (15 words max)
- Simple words
- Active voice
- Short paragraphs (3-4 sentences)
- Easy to read

${request.context ? `Context: ${request.context}` : ''}

Return ONLY valid JSON:
{
  "title": "Title here",
  "body": "Content with \\n\\n for paragraphs. No HTML tags. Short sentences. Simple words.",
  "excerpt": "Brief summary (150 chars max)"
}`;
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

  private generateFallbackContent(request: ContentGenerationRequest): GeneratedContent {
    const title = `${request.topic}: A Comprehensive Guide for ${request.targetAudience}`;
    const body = `# ${title}

This content is currently being generated. Our AI system is working to create high-quality, engaging content that matches your brand voice and requirements.

## Key Topics to Cover:
${request.keywords.map(keyword => `- ${keyword}`).join('\n')}

## Target Audience:
${request.targetAudience}

## Brand Voice:
- Tone: ${request.brandVoice.tone}
- Style: ${request.brandVoice.style}
- Vocabulary: ${request.brandVoice.vocabulary}

${request.requirements?.includeCTA ? '\n## Call to Action\nReady to learn more? Contact us today!' : ''}`;

    return {
      id: `fallback-${Date.now()}`,
      title,
      body,
      excerpt: `A comprehensive guide about ${request.topic} tailored for ${request.targetAudience}.`,
      type: request.type,
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
} 