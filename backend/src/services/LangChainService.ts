import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { VectorDBService, ContentEmbedding, SimilaritySearchResult } from './VectorDBService';
import { WebScrapingService } from './WebScrapingService';
import { HybridAIService } from './HybridAIService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ResearchQuery {
  topic: string;
  contentType: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
  targetAudience: string;
  keywords: string[];
  competitorUrls?: string[];
  depth: 'shallow' | 'medium' | 'deep';
  language: 'vi' | 'en' | 'bilingual';
}

export interface ResearchResult {
  id: string;
  query: ResearchQuery;
  sourceContent: Array<{
    url: string;
    title: string;
    content: string;
    relevanceScore: number;
    keyInsights: string[];
    wordCount: number;
    scrapedAt: string;
  }>;
  semanticAnalysis: {
    contentGaps: string[];
    uniqueAngles: string[];
    competitorStrengths: string[];
    opportunityAreas: string[];
    trendingKeywords: string[];
  };
  contentSuggestions: {
    titles: string[];
    outlines: string[];
    keyPoints: string[];
    callToActions: string[];
    seoKeywords: string[];
  };
  qualityScore: number;
  createdAt: string;
}

export interface ContentGenerationPipeline {
  id: string;
  topic: string;
  researchResult: ResearchResult;
  generatedContent: {
    title: string;
    body: string;
    excerpt: string;
    seoTitle: string;
    seoDescription: string;
    keywords: string[];
  };
  qualityMetrics: {
    uniquenessScore: number;
    readabilityScore: number;
    seoScore: number;
    engagementScore: number;
    factualAccuracy: number;
  };
  improvements: string[];
  status: 'draft' | 'review' | 'approved' | 'published';
}

export interface AutomationSettings {
  contentType: 'blog_post' | 'social_media' | 'email';
  frequency: 'daily' | 'weekly' | 'monthly';
  targetAudience: string;
  brandVoice: {
    tone: 'professional' | 'casual' | 'friendly' | 'authoritative';
    style: 'formal' | 'conversational' | 'technical' | 'creative';
  };
  contentCategories: string[];
  qualityThreshold: number;
  autoApprove: boolean;
  publishSchedule: {
    wordpress?: {
      enabled: boolean;
      optimalTimes: string[];
      categories: string[];
    };
    facebook?: {
      enabled: boolean;
      optimalTimes: string[];
      targetAudience: string;
    };
  };
}

export class LangChainService {
  private vectorDBService: VectorDBService;
  private webScrapingService: WebScrapingService;
  private hybridAIService: HybridAIService;
  private chatModel: ChatOpenAI;
  private initialized: boolean = false;

  constructor() {
    this.vectorDBService = new VectorDBService();
    this.webScrapingService = new WebScrapingService();
    this.hybridAIService = new HybridAIService();
    
    this.chatModel = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    logger.info('🧠 LangChainService initialized với advanced AI pipeline');
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    try {
      await this.vectorDBService.initialize();
      this.initialized = true;
      logger.info('✅ LangChainService fully initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize LangChainService:', error);
      throw error;
    }
  }

  /**
   * Comprehensive content research with AI analysis
   */
  async conductDeepResearch(query: ResearchQuery): Promise<ResearchResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('🔍 Starting deep content research', {
      topic: query.topic,
      contentType: query.contentType,
      depth: query.depth
    });

    try {
      // 1. Multi-source content scraping
      const sourceContent = await this.scrapeMultipleSources(query);
      
      // 2. Semantic analysis using vector database
      const semanticAnalysis = await this.performSemanticAnalysis(query, sourceContent);
      
      // 3. AI-powered content suggestions
      const contentSuggestions = await this.generateContentSuggestions(query, sourceContent, semanticAnalysis);
      
      // 4. Calculate overall quality score
      const qualityScore = this.calculateResearchQualityScore(sourceContent, semanticAnalysis);

      const result: ResearchResult = {
        id: uuidv4(),
        query,
        sourceContent,
        semanticAnalysis,
        contentSuggestions,
        qualityScore,
        createdAt: new Date().toISOString()
      };

      // Store research results in vector database for future reference
      await this.storeResearchResult(result);

      logger.info('✅ Deep research completed', {
        sourceCount: sourceContent.length,
        qualityScore,
        uniqueAngles: semanticAnalysis.uniqueAngles.length
      });

      return result;
    } catch (error) {
      logger.error('❌ Deep research failed:', error);
      throw error;
    }
  }

  /**
   * Generate high-quality content using RAG pipeline
   */
  async generateContentWithRAG(
    query: ResearchQuery,
    researchResult?: ResearchResult
  ): Promise<ContentGenerationPipeline> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('🎨 Starting RAG-powered content generation', {
      topic: query.topic,
      hasResearch: !!researchResult
    });

    try {
      // 1. Use existing research or conduct new research
      const research = researchResult || await this.conductDeepResearch(query);
      
      // 2. Retrieve similar high-quality content from vector database
      const similarContent = await this.vectorDBService.searchSimilarContent(
        `${query.topic} ${query.keywords.join(' ')}`,
        10,
        { contentType: query.contentType, minQualityScore: 80 }
      );

      // 3. Build context for AI generation
      const context = this.buildRAGContext(research, similarContent);
      
      // 4. Generate content using AI pipeline
      const generatedContent = await this.generateContentWithContext(query, context);
      
      // 5. Quality analysis and improvements
      const qualityMetrics = await this.analyzeContentQuality(generatedContent, research);
      const improvements = this.suggestImprovements(generatedContent, qualityMetrics, research);

      const pipeline: ContentGenerationPipeline = {
        id: uuidv4(),
        topic: query.topic,
        researchResult: research,
        generatedContent,
        qualityMetrics,
        improvements,
        status: qualityMetrics.uniquenessScore > 70 ? 'review' : 'draft'
      };

      // Store generated content in vector database
      await this.storeGeneratedContent(pipeline);

      logger.info('✅ RAG content generation completed', {
        uniquenessScore: qualityMetrics.uniquenessScore,
        qualityScore: qualityMetrics.seoScore,
        status: pipeline.status
      });

      return pipeline;
    } catch (error) {
      logger.error('❌ RAG content generation failed:', error);
      throw error;
    }
  }

  /**
   * Automated content planning and generation
   */
  async generateAutomatedContent(settings: AutomationSettings): Promise<ContentGenerationPipeline[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('🤖 Starting automated content generation', {
      contentType: settings.contentType,
      frequency: settings.frequency,
      categories: settings.contentCategories.length
    });

    try {
      const results: ContentGenerationPipeline[] = [];

      // Generate content for each category
      for (const category of settings.contentCategories) {
        // 1. Find content gaps and opportunities
        const opportunities = await this.vectorDBService.findContentGaps(category, []);
        
        // 2. Generate research queries based on gaps
        const queries = this.generateResearchQueries(category, opportunities, settings);
        
        // 3. Generate content for each query
        for (const query of queries) {
          try {
            const pipeline = await this.generateContentWithRAG(query);
            
            // Auto-approve if quality meets threshold
            if (pipeline.qualityMetrics.uniquenessScore >= settings.qualityThreshold && settings.autoApprove) {
              pipeline.status = 'approved';
            }
            
            results.push(pipeline);
          } catch (error) {
            logger.warn(`Failed to generate content for query: ${query.topic}`, error);
          }
        }
      }

      logger.info('✅ Automated content generation completed', {
        totalGenerated: results.length,
        approved: results.filter(r => r.status === 'approved').length
      });

      return results;
    } catch (error) {
      logger.error('❌ Automated content generation failed:', error);
      throw error;
    }
  }

  /**
   * Scrape multiple sources for research
   */
  private async scrapeMultipleSources(query: ResearchQuery): Promise<ResearchResult['sourceContent']> {
    const sources: ResearchResult['sourceContent'] = [];
    
    // Scrape competitor URLs if provided
    if (query.competitorUrls && query.competitorUrls.length > 0) {
      for (const url of query.competitorUrls) {
        try {
                    // const scraped = await this.webScrapingService.scrapeUrl(url);
            // const insights = await this.extractKeyInsights(scraped.content, query.keywords);
          
          // sources.push({
          //   url,
          //   title: scraped.title,
          //   content: scraped.content,
          //   relevanceScore: this.calculateRelevanceScore(scraped.content, query.keywords),
          //   keyInsights: insights,
          //   wordCount: scraped.metadata.wordCount,
          //   scrapedAt: scraped.scrapedAt
          // });
        } catch (error) {
          logger.warn(`Failed to scrape ${url}:`, error);
        }
      }
    }

    // Search for related content in vector database
    const relatedContent = await this.vectorDBService.searchSimilarContent(
      `${query.topic} ${query.keywords.join(' ')}`,
      query.depth === 'deep' ? 15 : query.depth === 'medium' ? 10 : 5
    );

    // Add high-quality related content as sources
    relatedContent.forEach(content => {
      if (content.content.metadata.qualityScore && content.content.metadata.qualityScore > 70) {
        sources.push({
          url: content.content.url || '',
          title: content.content.title,
          content: content.content.content,
          relevanceScore: content.similarity * 100,
          keyInsights: [],
          wordCount: content.content.metadata.wordCount,
          scrapedAt: content.content.metadata.createdAt
        });
      }
    });

    return sources;
  }

  /**
   * Perform semantic analysis on research content
   */
  private async performSemanticAnalysis(
    query: ResearchQuery,
    sourceContent: ResearchResult['sourceContent']
  ): Promise<ResearchResult['semanticAnalysis']> {
    // Use LangChain to analyze content patterns
    const analysisPrompt = PromptTemplate.fromTemplate(`
      Analyze the following research content for topic: {topic}
      
      Content sources:
      {content}
      
      Target keywords: {keywords}
      
      Provide analysis in the following format:
      Content Gaps: [list gaps not covered]
      Unique Angles: [list unique perspectives to explore]
      Competitor Strengths: [list what competitors do well]
      Opportunity Areas: [list areas for improvement]
      Trending Keywords: [list emerging keywords]
    `);

    const analysisChain = RunnableSequence.from([
      analysisPrompt,
      this.chatModel,
      new StringOutputParser()
    ]);

    const contentSummary = sourceContent
      .slice(0, 5)
      .map(s => `${s.title}: ${s.content.substring(0, 300)}`)
      .join('\n\n');

    const analysis = await analysisChain.invoke({
      topic: query.topic,
      content: contentSummary,
      keywords: query.keywords.join(', ')
    });

    return this.parseSemanticAnalysis(analysis);
  }

  /**
   * Generate content suggestions using AI
   */
  private async generateContentSuggestions(
    query: ResearchQuery,
    sourceContent: ResearchResult['sourceContent'],
    semanticAnalysis: ResearchResult['semanticAnalysis']
  ): Promise<ResearchResult['contentSuggestions']> {
    const suggestionsPrompt = PromptTemplate.fromTemplate(`
      Based on the research analysis, generate content suggestions for:
      
      Topic: {topic}
      Content Type: {contentType}
      Target Audience: {targetAudience}
      Language: {language}
      
      Content Gaps: {contentGaps}
      Unique Angles: {uniqueAngles}
      Opportunity Areas: {opportunityAreas}
      
      Generate:
      Titles: [5 compelling titles]
      Outlines: [3 detailed outlines]
      Key Points: [10 key points to cover]
      Call to Actions: [5 effective CTAs]
      SEO Keywords: [15 relevant keywords]
    `);

    const suggestionsChain = RunnableSequence.from([
      suggestionsPrompt,
      this.chatModel,
      new StringOutputParser()
    ]);

    const suggestions = await suggestionsChain.invoke({
      topic: query.topic,
      contentType: query.contentType,
      targetAudience: query.targetAudience,
      language: query.language,
      contentGaps: semanticAnalysis.contentGaps.join(', '),
      uniqueAngles: semanticAnalysis.uniqueAngles.join(', '),
      opportunityAreas: semanticAnalysis.opportunityAreas.join(', ')
    });

    return this.parseContentSuggestions(suggestions);
  }

  /**
   * Build RAG context from research and similar content
   */
  private buildRAGContext(
    research: ResearchResult,
    similarContent: SimilaritySearchResult[]
  ): string {
    const context = `
Research Context:
${research.sourceContent.map(s => `- ${s.title}: ${s.keyInsights.join(', ')}`).join('\n')}

Content Gaps to Address:
${research.semanticAnalysis.contentGaps.join('\n')}

Unique Angles to Explore:
${research.semanticAnalysis.uniqueAngles.join('\n')}

High-Quality Examples:
${similarContent.slice(0, 3).map(c => 
  `- ${c.content.title}: ${c.content.content.substring(0, 200)}...`
).join('\n')}

SEO Keywords to Include:
${research.contentSuggestions.seoKeywords.join(', ')}
    `;

    return context;
  }

  /**
   * Generate content with AI using context
   */
  private async generateContentWithContext(
    query: ResearchQuery,
    context: string
  ): Promise<ContentGenerationPipeline['generatedContent']> {
    const contentPrompt = PromptTemplate.fromTemplate(`
      Using the following research context, generate high-quality {contentType} content:
      
      Topic: {topic}
      Target Audience: {targetAudience}
      Keywords: {keywords}
      Language: {language}
      
      Research Context:
      {context}
      
      Generate:
      1. Compelling Title
      2. Full Content Body (minimum 1500 words for blog_post, 200 words for social_media)
      3. Engaging Excerpt (150 words)
      4. SEO-Optimized Title
      5. Meta Description
      6. Relevant Keywords List
      
      Requirements:
      - Original and unique content
      - Natural keyword integration
      - Engaging and valuable for target audience
      - Proper structure with headings and subheadings
      - Call-to-action included
    `);

    const contentChain = RunnableSequence.from([
      contentPrompt,
      this.chatModel,
      new StringOutputParser()
    ]);

    const content = await contentChain.invoke({
      contentType: query.contentType,
      topic: query.topic,
      targetAudience: query.targetAudience,
      keywords: query.keywords.join(', '),
      language: query.language,
      context
    });

    return this.parseGeneratedContent(content);
  }

  /**
   * Store research result in vector database
   */
  private async storeResearchResult(result: ResearchResult): Promise<void> {
    const embedding: ContentEmbedding = {
      id: result.id,
      content: `Research: ${result.query.topic} - ${result.semanticAnalysis.contentGaps.join(', ')}`,
      title: `Research: ${result.query.topic}`,
      metadata: {
        wordCount: result.sourceContent.reduce((acc, s) => acc + s.wordCount, 0),
        contentType: 'research',
        topic: result.query.topic,
        keywords: result.query.keywords,
        createdAt: result.createdAt,
        qualityScore: result.qualityScore,
        aiProvider: 'langchain',
        category: 'research'
      }
    };

    await this.vectorDBService.storeContent(embedding);
  }

  /**
   * Store generated content in vector database
   */
  private async storeGeneratedContent(pipeline: ContentGenerationPipeline): Promise<void> {
    const embedding: ContentEmbedding = {
      id: pipeline.id,
      content: pipeline.generatedContent.body,
      title: pipeline.generatedContent.title,
      metadata: {
        wordCount: pipeline.generatedContent.body.length,
        contentType: pipeline.researchResult.query.contentType,
        topic: pipeline.topic,
        keywords: pipeline.generatedContent.keywords,
        createdAt: new Date().toISOString(),
        qualityScore: pipeline.qualityMetrics.uniquenessScore,
        aiProvider: 'langchain-rag',
        category: 'generated'
      }
    };

    await this.vectorDBService.storeContent(embedding);
  }

  // Helper methods for parsing AI responses
  private parseSemanticAnalysis(analysis: string): ResearchResult['semanticAnalysis'] {
    return {
      contentGaps: this.extractListFromText(analysis, 'Content Gaps:'),
      uniqueAngles: this.extractListFromText(analysis, 'Unique Angles:'),
      competitorStrengths: this.extractListFromText(analysis, 'Competitor Strengths:'),
      opportunityAreas: this.extractListFromText(analysis, 'Opportunity Areas:'),
      trendingKeywords: this.extractListFromText(analysis, 'Trending Keywords:')
    };
  }

  private parseContentSuggestions(suggestions: string): ResearchResult['contentSuggestions'] {
    return {
      titles: this.extractListFromText(suggestions, 'Titles:'),
      outlines: this.extractListFromText(suggestions, 'Outlines:'),
      keyPoints: this.extractListFromText(suggestions, 'Key Points:'),
      callToActions: this.extractListFromText(suggestions, 'Call to Actions:'),
      seoKeywords: this.extractListFromText(suggestions, 'SEO Keywords:')
    };
  }

  private parseGeneratedContent(content: string): ContentGenerationPipeline['generatedContent'] {
    const sections = content.split('\n\n');
    
    return {
      title: sections[0] || 'Generated Title',
      body: sections.slice(1, -4).join('\n\n') || 'Generated content body',
      excerpt: sections[sections.length - 4] || 'Generated excerpt',
      seoTitle: sections[sections.length - 3] || 'SEO Title',
      seoDescription: sections[sections.length - 2] || 'SEO Description',
      keywords: sections[sections.length - 1]?.split(',') || []
    };
  }

  private extractListFromText(text: string, marker: string): string[] {
    const lines = text.split('\n');
    const startIndex = lines.findIndex(line => line.includes(marker));
    
    if (startIndex === -1) return [];
    
    const items: string[] = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.includes(':')) break;
      items.push(line.replace(/^[-*•]\s*/, ''));
    }
    
    return items;
  }

  // Additional helper methods
  private async extractKeyInsights(content: string, keywords: string[]): Promise<string[]> {
    return keywords.filter(keyword => content.toLowerCase().includes(keyword.toLowerCase()));
  }

  private calculateRelevanceScore(content: string, keywords: string[]): number {
    const keywordMatches = keywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );
    return (keywordMatches.length / keywords.length) * 100;
  }

  private calculateResearchQualityScore(
    sourceContent: ResearchResult['sourceContent'],
    semanticAnalysis: ResearchResult['semanticAnalysis']
  ): number {
    const sourceQuality = sourceContent.reduce((acc, s) => acc + s.relevanceScore, 0) / sourceContent.length;
    const analysisDepth = semanticAnalysis.contentGaps.length + semanticAnalysis.uniqueAngles.length;
    return Math.min(100, (sourceQuality + analysisDepth * 2) / 2);
  }

  private async analyzeContentQuality(
    content: ContentGenerationPipeline['generatedContent'],
    research: ResearchResult
  ): Promise<ContentGenerationPipeline['qualityMetrics']> {
    const uniquenessAnalysis = await this.vectorDBService.analyzeContentUniqueness(
      content.body,
      content.title,
      {
        wordCount: content.body.length,
        contentType: research.query.contentType,
        topic: research.query.topic,
        keywords: content.keywords,
        createdAt: new Date().toISOString()
      }
    );

    return {
      uniquenessScore: uniquenessAnalysis.uniquenessScore,
      readabilityScore: this.calculateReadabilityScore(content.body),
      seoScore: this.calculateSEOScore(content, research.query.keywords),
      engagementScore: this.calculateEngagementScore(content),
      factualAccuracy: 90 // Would need fact-checking service
    };
  }

  private calculateReadabilityScore(content: string): number {
    const sentences = content.split('.').length;
    const words = content.split(' ').length;
    const avgWordsPerSentence = words / sentences;
    
    // Simple readability scoring (Flesch Reading Ease approximation)
    return Math.max(0, Math.min(100, 100 - avgWordsPerSentence * 2));
  }

  private calculateSEOScore(
    content: ContentGenerationPipeline['generatedContent'],
    targetKeywords: string[]
  ): number {
    let score = 0;
    const titleHasKeyword = targetKeywords.some(k => 
      content.title.toLowerCase().includes(k.toLowerCase())
    );
    if (titleHasKeyword) score += 30;

    const bodyKeywordDensity = targetKeywords.reduce((acc, keyword) => {
      const matches = (content.body.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      return acc + matches;
    }, 0);
    
    const density = bodyKeywordDensity / content.body.split(' ').length;
    if (density > 0.005 && density < 0.02) score += 40; // 0.5% to 2% density

    if (content.seoDescription.length > 150 && content.seoDescription.length < 160) score += 30;

    return Math.min(100, score);
  }

  private calculateEngagementScore(content: ContentGenerationPipeline['generatedContent']): number {
    let score = 0;
    
    // Check for questions
    const questionCount = (content.body.match(/\?/g) || []).length;
    score += Math.min(20, questionCount * 5);
    
    // Check for lists
    const listCount = (content.body.match(/^\s*[-*•]/gm) || []).length;
    score += Math.min(20, listCount * 2);
    
    // Check for call-to-action
    const ctaWords = ['click', 'download', 'subscribe', 'learn more', 'contact', 'buy'];
    const hasCTA = ctaWords.some(word => content.body.toLowerCase().includes(word));
    if (hasCTA) score += 30;
    
    // Check for emotional words
    const emotionalWords = ['amazing', 'incredible', 'powerful', 'essential', 'proven'];
    const emotionalCount = emotionalWords.filter(word => 
      content.body.toLowerCase().includes(word)
    ).length;
    score += Math.min(30, emotionalCount * 6);
    
    return Math.min(100, score);
  }

  private suggestImprovements(
    content: ContentGenerationPipeline['generatedContent'],
    metrics: ContentGenerationPipeline['qualityMetrics'],
    research: ResearchResult
  ): string[] {
    const improvements: string[] = [];
    
    if (metrics.uniquenessScore < 70) {
      improvements.push('Increase content uniqueness by exploring different angles or adding original insights');
    }
    
    if (metrics.readabilityScore < 70) {
      improvements.push('Improve readability by using shorter sentences and simpler vocabulary');
    }
    
    if (metrics.seoScore < 80) {
      improvements.push('Optimize SEO by better keyword placement and meta descriptions');
    }
    
    if (metrics.engagementScore < 75) {
      improvements.push('Enhance engagement with more questions, lists, and call-to-actions');
    }
    
    return improvements;
  }

  private generateResearchQueries(
    category: string,
    opportunities: any,
    settings: AutomationSettings
  ): ResearchQuery[] {
    // Generate 2-3 queries per category based on opportunities
    const baseQueries = [
      `Latest trends in ${category}`,
      `Best practices for ${category}`,
      `Common mistakes in ${category}`
    ];

    return baseQueries.map(topic => ({
      topic,
      contentType: settings.contentType,
      targetAudience: settings.targetAudience,
      keywords: [category, topic.split(' ')[0]], // Simple keyword extraction
      depth: 'medium' as const,
      language: 'en' as const // Default to English
    }));
  }
} 