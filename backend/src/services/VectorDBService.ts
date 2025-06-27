import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
// import { PineconeStore } from '@langchain/pinecone';  // Comment out for now
import { Document } from '@langchain/core/documents';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ContentEmbedding {
  id: string;
  content: string;
  title: string;
  url?: string;
  metadata: {
    wordCount: number;
    contentType: string;
    topic: string;
    keywords: string[];
    createdAt: string;
    qualityScore?: number;
    aiProvider?: string;
    category?: string;
    language?: string;
  };
  embedding?: number[];
}

export interface SimilaritySearchResult {
  content: ContentEmbedding;
  similarity: number;
  relevanceReason: string;
}

export interface ContentAnalysis {
  uniquenessScore: number;
  similarContent: SimilaritySearchResult[];
  suggestedModifications: string[];
  contentGaps: string[];
  seoOpportunities: string[];
}

export class VectorDBService {
  private pinecone: Pinecone;
  private embeddings: OpenAIEmbeddings;
  private vectorStore: PineconeStore | null = null;
  private indexName: string;
  private initialized: boolean = false;

  constructor() {
    this.indexName = process.env.PINECONE_INDEX_NAME || 'ai-content-agent';
    
    // Initialize Pinecone
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });

    // Initialize OpenAI embeddings
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
      dimensions: 1536
    });

    logger.info('🔗 VectorDBService initialized với Pinecone + OpenAI embeddings');
  }

  /**
   * Initialize connection to Pinecone index
   */
  async initialize(): Promise<void> {
    try {
      // Check if index exists, create if not
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        logger.info(`📋 Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        await this.waitForIndexReady();
      }

      // Initialize vector store
      const index = this.pinecone.index(this.indexName);
      this.vectorStore = await PineconeStore.fromExistingIndex(this.embeddings, {
        pineconeIndex: index,
        textKey: 'content',
        metadataFilter: {}
      });

      this.initialized = true;
      logger.info('✅ VectorDBService initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize VectorDBService:', error);
      throw error;
    }
  }

  /**
   * Wait for Pinecone index to be ready
   */
  private async waitForIndexReady(maxAttempts = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const indexStats = await this.pinecone.index(this.indexName).describeIndexStats();
        if (indexStats) {
          logger.info('✅ Pinecone index is ready');
          return;
        }
      } catch (error) {
        logger.info(`⏳ Waiting for index to be ready... (${i + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    throw new Error('Index failed to become ready within timeout');
  }

  /**
   * Store content embeddings in vector database
   */
  async storeContent(content: ContentEmbedding): Promise<string> {
    if (!this.initialized || !this.vectorStore) {
      await this.initialize();
    }

    try {
      const document = new Document({
        pageContent: content.content,
        metadata: {
          id: content.id,
          title: content.title,
          url: content.url || '',
          ...content.metadata
        }
      });

      const ids = await this.vectorStore!.addDocuments([document], [content.id]);
      
      logger.info(`💾 Stored content embedding: ${content.title}`, {
        id: content.id,
        wordCount: content.metadata.wordCount,
        vectorId: ids[0]
      });

      return ids[0];
    } catch (error) {
      logger.error('❌ Failed to store content embedding:', error);
      throw error;
    }
  }

  /**
   * Perform semantic similarity search
   */
  async searchSimilarContent(
    query: string, 
    limit: number = 5,
    filters?: {
      contentType?: string;
      category?: string;
      minQualityScore?: number;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<SimilaritySearchResult[]> {
    if (!this.initialized || !this.vectorStore) {
      await this.initialize();
    }

    try {
      const searchResults = await this.vectorStore!.similaritySearchWithScore(
        query,
        limit,
        filters ? this.buildMetadataFilter(filters) : undefined
      );

      const results: SimilaritySearchResult[] = searchResults.map(([doc, score]) => ({
        content: {
          id: doc.metadata.id,
          content: doc.pageContent,
          title: doc.metadata.title,
          url: doc.metadata.url,
          metadata: {
            wordCount: doc.metadata.wordCount,
            contentType: doc.metadata.contentType,
            topic: doc.metadata.topic,
            keywords: doc.metadata.keywords || [],
            createdAt: doc.metadata.createdAt,
            qualityScore: doc.metadata.qualityScore,
            aiProvider: doc.metadata.aiProvider,
            category: doc.metadata.category,
            language: doc.metadata.language
          }
        },
        similarity: score,
        relevanceReason: this.generateRelevanceReason(query, doc.pageContent, score)
      }));

      logger.info(`🔍 Found ${results.length} similar content items`, {
        query: query.substring(0, 50),
        averageSimilarity: results.reduce((acc, r) => acc + r.similarity, 0) / results.length
      });

      return results;
    } catch (error) {
      logger.error('❌ Failed to search similar content:', error);
      throw error;
    }
  }

  /**
   * Analyze content uniqueness and provide recommendations
   */
  async analyzeContentUniqueness(
    newContent: string,
    title: string,
    metadata: ContentEmbedding['metadata']
  ): Promise<ContentAnalysis> {
    try {
      // Search for similar content
      const similarContent = await this.searchSimilarContent(
        `${title} ${newContent.substring(0, 500)}`,
        10,
        { contentType: metadata.contentType }
      );

      // Calculate uniqueness score (inverse of highest similarity)
      const highestSimilarity = similarContent.length > 0 
        ? Math.max(...similarContent.map(s => s.similarity))
        : 0;
      
      const uniquenessScore = Math.max(0, (1 - highestSimilarity) * 100);

      // Generate suggestions
      const suggestions = this.generateContentSuggestions(similarContent, metadata);
      const gaps = this.identifyContentGaps(similarContent, metadata.keywords);
      const seoOpportunities = this.identifySEOOpportunities(similarContent, metadata);

      const analysis: ContentAnalysis = {
        uniquenessScore,
        similarContent: similarContent.slice(0, 5), // Top 5 most similar
        suggestedModifications: suggestions,
        contentGaps: gaps,
        seoOpportunities
      };

      logger.info(`📊 Content analysis completed`, {
        title,
        uniquenessScore,
        similarContentCount: similarContent.length,
        suggestionsCount: suggestions.length
      });

      return analysis;
    } catch (error) {
      logger.error('❌ Failed to analyze content uniqueness:', error);
      throw error;
    }
  }

  /**
   * Generate content suggestions for research
   */
  async generateResearchSuggestions(
    topic: string,
    contentType: string,
    keywords: string[]
  ): Promise<{
    relatedTopics: string[];
    contentAngles: string[];
    expertSources: SimilaritySearchResult[];
    trendingKeywords: string[];
  }> {
    try {
      // Search for related content
      const relatedContent = await this.searchSimilarContent(
        `${topic} ${keywords.join(' ')}`,
        15,
        { contentType }
      );

      // Extract insights
      const relatedTopics = this.extractRelatedTopics(relatedContent);
      const contentAngles = this.generateContentAngles(topic, relatedContent);
      const expertSources = relatedContent.filter(c => c.content.metadata.qualityScore && c.content.metadata.qualityScore > 80);
      const trendingKeywords = this.extractTrendingKeywords(relatedContent);

      logger.info(`💡 Generated research suggestions`, {
        topic,
        relatedTopicsCount: relatedTopics.length,
        contentAnglesCount: contentAngles.length,
        expertSourcesCount: expertSources.length
      });

      return {
        relatedTopics,
        contentAngles,
        expertSources,
        trendingKeywords
      };
    } catch (error) {
      logger.error('❌ Failed to generate research suggestions:', error);
      throw error;
    }
  }

  /**
   * Find content gaps in existing database
   */
  async findContentGaps(
    category: string,
    existingKeywords: string[]
  ): Promise<{
    missingTopics: string[];
    underrepresentedKeywords: string[];
    opportunityAreas: string[];
  }> {
    try {
      // Search for content in category
      const categoryContent = await this.searchSimilarContent(
        category,
        50,
        { category }
      );

      // Analyze gaps
      const allKeywords = categoryContent.flatMap(c => c.content.metadata.keywords);
      const keywordFrequency = this.calculateKeywordFrequency(allKeywords);
      
      const missingTopics = this.identifyMissingTopics(categoryContent, existingKeywords);
      const underrepresented = this.findUnderrepresentedKeywords(keywordFrequency, existingKeywords);
      const opportunities = this.identifyOpportunityAreas(categoryContent);

      logger.info(`🔍 Content gap analysis completed`, {
        category,
        categoryContentCount: categoryContent.length,
        missingTopicsCount: missingTopics.length
      });

      return {
        missingTopics,
        underrepresentedKeywords: underrepresented,
        opportunityAreas: opportunities
      };
    } catch (error) {
      logger.error('❌ Failed to find content gaps:', error);
      throw error;
    }
  }

  /**
   * Build metadata filter for Pinecone
   */
  private buildMetadataFilter(filters: any): any {
    const filter: any = {};

    if (filters.contentType) {
      filter.contentType = { $eq: filters.contentType };
    }
    if (filters.category) {
      filter.category = { $eq: filters.category };
    }
    if (filters.minQualityScore) {
      filter.qualityScore = { $gte: filters.minQualityScore };
    }
    if (filters.dateFrom || filters.dateTo) {
      filter.createdAt = {};
      if (filters.dateFrom) filter.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) filter.createdAt.$lte = filters.dateTo;
    }

    return filter;
  }

  /**
   * Generate relevance reason for search result
   */
  private generateRelevanceReason(query: string, content: string, score: number): string {
    if (score > 0.9) return 'Highly relevant - very similar content';
    if (score > 0.8) return 'Very relevant - closely related topic';
    if (score > 0.7) return 'Relevant - similar keywords and concepts';
    if (score > 0.6) return 'Moderately relevant - related themes';
    return 'Somewhat relevant - some shared concepts';
  }

  /**
   * Generate content modification suggestions
   */
  private generateContentSuggestions(
    similarContent: SimilaritySearchResult[],
    metadata: ContentEmbedding['metadata']
  ): string[] {
    const suggestions: string[] = [];

    if (similarContent.length > 0) {
      const highSimilarity = similarContent.filter(s => s.similarity > 0.8);
      
      if (highSimilarity.length > 0) {
        suggestions.push('Consider focusing on a more specific angle or niche');
        suggestions.push('Add personal experiences or case studies to increase uniqueness');
        suggestions.push('Include recent statistics or trends not covered in similar content');
      }

      const commonKeywords = this.extractCommonKeywords(similarContent);
      if (commonKeywords.length > 0) {
        suggestions.push(`Consider exploring related keywords: ${commonKeywords.slice(0, 3).join(', ')}`);
      }
    }

    return suggestions;
  }

  /**
   * Identify content gaps
   */
  private identifyContentGaps(
    similarContent: SimilaritySearchResult[],
    keywords: string[]
  ): string[] {
    const gaps: string[] = [];
    
    // Find underrepresented keywords
    const allKeywords = similarContent.flatMap(s => s.content.metadata.keywords);
    const missingKeywords = keywords.filter(k => !allKeywords.includes(k));
    
    if (missingKeywords.length > 0) {
      gaps.push(`Underexplored keywords: ${missingKeywords.join(', ')}`);
    }

    return gaps;
  }

  /**
   * Identify SEO opportunities
   */
  private identifySEOOpportunities(
    similarContent: SimilaritySearchResult[],
    metadata: ContentEmbedding['metadata']
  ): string[] {
    const opportunities: string[] = [];

    const lowQualityContent = similarContent.filter(s => 
      s.content.metadata.qualityScore && s.content.metadata.qualityScore < 70
    );

    if (lowQualityContent.length > 0) {
      opportunities.push('Opportunity to create higher quality content than existing results');
    }

    return opportunities;
  }

  /**
   * Extract related topics from similar content
   */
  private extractRelatedTopics(content: SimilaritySearchResult[]): string[] {
    const topics = new Set<string>();
    
    content.forEach(c => {
      c.content.metadata.keywords.forEach(keyword => {
        if (keyword.length > 3) topics.add(keyword);
      });
    });

    return Array.from(topics).slice(0, 10);
  }

  /**
   * Generate content angles
   */
  private generateContentAngles(topic: string, relatedContent: SimilaritySearchResult[]): string[] {
    return [
      `${topic} for beginners`,
      `Advanced ${topic} strategies`,
      `${topic} case studies`,
      `${topic} vs alternatives`,
      `Future of ${topic}`,
      `Common ${topic} mistakes`,
      `${topic} best practices`,
      `${topic} trends 2025`
    ];
  }

  /**
   * Extract trending keywords
   */
  private extractTrendingKeywords(content: SimilaritySearchResult[]): string[] {
    const keywordFreq = new Map<string, number>();
    
    content.forEach(c => {
      c.content.metadata.keywords.forEach(keyword => {
        keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
      });
    });

    return Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword]) => keyword);
  }

  /**
   * Calculate keyword frequency
   */
  private calculateKeywordFrequency(keywords: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    keywords.forEach(keyword => {
      freq.set(keyword, (freq.get(keyword) || 0) + 1);
    });
    return freq;
  }

  /**
   * Identify missing topics
   */
  private identifyMissingTopics(content: SimilaritySearchResult[], keywords: string[]): string[] {
    const existingTopics = new Set(content.map(c => c.content.metadata.topic.toLowerCase()));
    return keywords.filter(k => !existingTopics.has(k.toLowerCase()));
  }

  /**
   * Find underrepresented keywords
   */
  private findUnderrepresentedKeywords(
    frequency: Map<string, number>,
    targetKeywords: string[]
  ): string[] {
    const avgFreq = Array.from(frequency.values()).reduce((a, b) => a + b, 0) / frequency.size;
    return targetKeywords.filter(k => (frequency.get(k) || 0) < avgFreq * 0.5);
  }

  /**
   * Identify opportunity areas
   */
  private identifyOpportunityAreas(content: SimilaritySearchResult[]): string[] {
    const opportunities: string[] = [];
    
    const lowQualityCount = content.filter(c => 
      c.content.metadata.qualityScore && c.content.metadata.qualityScore < 70
    ).length;

    if (lowQualityCount > content.length * 0.3) {
      opportunities.push('High opportunity for quality content in this category');
    }

    return opportunities;
  }

  /**
   * Extract common keywords from similar content
   */
  private extractCommonKeywords(content: SimilaritySearchResult[]): string[] {
    const keywordCounts = new Map<string, number>();
    
    content.forEach(c => {
      c.content.metadata.keywords.forEach(keyword => {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      });
    });

    return Array.from(keywordCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([keyword]) => keyword);
  }

  /**
   * Delete content from vector database
   */
  async deleteContent(contentId: string): Promise<boolean> {
    if (!this.initialized || !this.vectorStore) {
      await this.initialize();
    }

    try {
      await this.pinecone.index(this.indexName).deleteOne(contentId);
      logger.info(`🗑️ Deleted content from vector database: ${contentId}`);
      return true;
    } catch (error) {
      logger.error('❌ Failed to delete content:', error);
      return false;
    }
  }

  /**
   * Get vector database statistics
   */
  async getStats(): Promise<{
    totalVectors: number;
    indexDimension: number;
    indexFullness: number;
    namespaces: string[];
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const stats = await this.pinecone.index(this.indexName).describeIndexStats();
      
      return {
        totalVectors: stats.totalRecordCount || 0,
        indexDimension: stats.dimension || 1536,
        indexFullness: (stats.indexFullness || 0) * 100,
        namespaces: Object.keys(stats.namespaces || {})
      };
    } catch (error) {
      logger.error('❌ Failed to get vector database stats:', error);
      throw error;
    }
  }
} 