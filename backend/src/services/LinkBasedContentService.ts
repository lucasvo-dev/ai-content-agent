import { v4 as uuidv4 } from 'uuid';
import { WebScrapingService } from './WebScrapingService';
import { HybridAIService } from './HybridAIService';
import { EnhancedContentService } from './EnhancedContentService';
import { logger } from '../utils/logger';
import { ContentType, ContentStatus } from '../types/index';
import type { 
  BatchJob, 
  ContentWorkflowItem, 
  GeneratedContent,
  BrandVoiceConfig,
  ScrapingResult
} from '../types';
import { ContentGenerationRequest } from '../types/index.js';

export interface CreateBatchJobRequest {
  projectId: string;
  urls: string[];
  settings: {
    contentType: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
    brandVoice: BrandVoiceConfig;
    targetAudience: string;
    preferredProvider?: 'openai' | 'gemini' | 'auto';
    imageSettings?: {
      includeImages: boolean;
      imageSelection: 'auto-category' | 'specific-folder' | 'manual';
      imageCategory?: string;
      specificFolder?: string;
      maxImages: number;
      ensureConsistency: boolean;
    };
  };
}

export interface BatchJobStatus {
  job: BatchJob;
  items: ContentWorkflowItem[];
  summary: {
    total: number;
    pending: number;
    crawling: number;
    crawled: number;
    generating: number;
    generated: number;
    approved: number;
    failed: number;
  };
}

/**
 * Link-Based Content Generation Service
 * Manages the complete workflow from URL scraping to content generation
 */
export class LinkBasedContentService {
  private webScrapingService: WebScrapingService;
  private aiService: HybridAIService;
  private enhancedContentService: EnhancedContentService;
  private batchJobs: Map<string, BatchJob> = new Map();
  private workflowItems: Map<string, ContentWorkflowItem[]> = new Map();

  constructor() {
    this.webScrapingService = new WebScrapingService();
    this.aiService = new HybridAIService();
    this.enhancedContentService = new EnhancedContentService();
  }

  /**
   * Create a new batch job for link-based content generation
   */
  async createBatchJob(request: CreateBatchJobRequest): Promise<BatchJob> {
    const jobId = uuidv4();
    
    const job: BatchJob = {
      id: jobId,
      projectId: request.projectId,
      status: 'pending',
      progress: {
        total: request.urls.length,
        crawled: 0,
        generated: 0,
        failed: 0
      },
      settings: request.settings,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create workflow items for each URL
    const items: ContentWorkflowItem[] = request.urls.map(url => ({
      id: uuidv4(),
      sourceUrl: url,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    this.batchJobs.set(jobId, job);
    this.workflowItems.set(jobId, items);

    logger.info(`Created batch job ${jobId} with ${request.urls.length} URLs`);
    return job;
  }

  /**
   * Get batch job status with items
   */
  async getBatchJobStatus(jobId: string): Promise<BatchJobStatus | null> {
    const job = this.batchJobs.get(jobId);
    const items = this.workflowItems.get(jobId);

    if (!job || !items) {
      return null;
    }

    const summary = this.calculateSummary(items);
    
    return {
      job: {
        ...job,
        progress: {
          total: items.length,
          crawled: summary.crawled,
          generated: summary.generated,
          failed: summary.failed
        },
        updatedAt: new Date()
      },
      items,
      summary
    };
  }

  /**
   * Start crawling URLs in a batch job
   */
  async startCrawling(jobId: string): Promise<void> {
    const job = this.batchJobs.get(jobId);
    const items = this.workflowItems.get(jobId);

    if (!job || !items) {
      throw new Error('Batch job not found');
    }

    job.status = 'processing';
    job.updatedAt = new Date();

    logger.info(`Starting crawling for batch job ${jobId}`);

    // Process URLs in parallel (with concurrency limit)
    const concurrency = 3;
    const batches = this.chunk(items, concurrency);

    for (const batch of batches) {
      await Promise.all(
        batch.map(item => this.crawlSingleItem(item))
      );
      
      // Add delay between batches
      await this.delay(2000);
    }

    // Update job status
    const allCrawled = items.every(item => 
      item.status === 'crawled' || item.status === 'failed'
    );
    
    if (allCrawled) {
      job.status = 'completed';
      logger.info(`Batch job ${jobId} crawling completed`);
    }

    job.updatedAt = new Date();
  }

  /**
   * Crawl a single URL item
   */
  private async crawlSingleItem(item: ContentWorkflowItem): Promise<void> {
    try {
      item.status = 'crawling';
      item.updatedAt = new Date();

      logger.info(`Crawling URL: ${item.sourceUrl}`);

      const results = await this.webScrapingService.scrapeUrls([item.sourceUrl]);
      const result = results[0];

      if (result && result.qualityScore > 0) {
        item.scrapedContent = result;
        item.status = 'crawled';
        logger.info(`Successfully crawled ${item.sourceUrl}, quality: ${result.qualityScore}`);
      } else {
        item.status = 'failed';
        item.errorMessage = 'Failed to extract content';
        logger.warn(`Failed to crawl ${item.sourceUrl}`);
      }

    } catch (error) {
      item.status = 'failed';
      item.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error crawling ${item.sourceUrl}:`, error);
    }

    item.updatedAt = new Date();
  }

  /**
   * Generate AI content for all crawled items in batch
   */
  async generateContent(jobId: string): Promise<void> {
    const job = this.batchJobs.get(jobId);
    const items = this.workflowItems.get(jobId);

    if (!job || !items) {
      throw new Error('Batch job not found');
    }

    logger.info(`Starting content generation for batch job ${jobId}`);

    // Filter items that are ready for generation
    const readyItems = items.filter(item => 
      item.status === 'crawled' && item.scrapedContent
    );

    if (readyItems.length === 0) {
      throw new Error('No items ready for content generation');
    }

    // Process content generation for each item
    for (const item of readyItems) {
      await this.generateSingleContent(item, job.settings);
      
      // Add delay between generations
      await this.delay(1000);
    }

    // Update job progress
    const summary = this.calculateSummary(items);
    job.progress.generated = summary.generated;
    job.updatedAt = new Date();

    logger.info(`Content generation completed for batch job ${jobId}`);
  }

  /**
   * Generate content for a single item
   */
  private async generateSingleContent(
    item: ContentWorkflowItem, 
    settings: any
  ): Promise<void> {
    try {
      item.status = 'generating';
      item.updatedAt = new Date();

      if (!item.scrapedContent) {
        throw new Error('No scraped content available');
      }

      logger.info(`Generating content with images for item ${item.id}`);

      // Prepare enhanced content generation request (same as generateEnhancedContent)
      const generationRequest: ContentGenerationRequest = {
        type: (settings.contentType as ContentType) || ContentType.BLOG_POST,
        topic: settings.topic || item.scrapedContent.title,
        targetAudience: settings.targetAudience || 'General audience',
        keywords: settings.keywords ? settings.keywords.split(',').map((k: string) => k.trim()) : [],
        brandVoice: {
          tone: settings.brandVoice?.tone || 'professional',
          style: settings.brandVoice?.style || 'conversational',
          vocabulary: settings.brandVoice?.vocabulary || 'industry-specific',
          length: settings.brandVoice?.length || 'detailed',
          brandName: settings.brandName || 'Your Brand'
        },
        context: `Original content from ${item.sourceUrl}:
Title: ${item.scrapedContent.title}
Content: ${item.scrapedContent.content.substring(0, 1000)}...

Please create new content based on this source material.`,
        preferredProvider: settings.preferredProvider || 'auto',
        language: settings.language || 'vietnamese',
        imageSettings: settings.imageSettings || {
          includeImages: true,
          imageSelection: 'auto-category',
          imageCategory: 'wedding',
          maxImages: 3,
          ensureConsistency: true
        },
        specialInstructions: 'This is a regeneration request - please ensure the content is different from previous versions.'
      };

      // Use EnhancedContentService to generate content with images (DRY principle)
      const result = await this.enhancedContentService.generateContentWithImages(generationRequest);

      item.generatedContent = {
        ...result,
        status: ContentStatus.DRAFT,
        sourceReference: {
          url: item.sourceUrl,
          title: item.scrapedContent.title,
          usedAsReference: true,
          rewriteStyle: 'improved'
        }
      };

      item.status = 'generated';
      logger.info(`Successfully generated content with images for item ${item.id}, ${result.metadata?.wordCount || 0} words`);

    } catch (error) {
      item.status = 'failed';
      item.errorMessage = error instanceof Error ? error.message : 'Generation failed';
      logger.error(`Error generating content for item ${item.id}:`, error);
    }

    item.updatedAt = new Date();
  }

  /**
   * Approve a content item
   */
  async approveContentItem(jobId: string, itemId: string): Promise<void> {
    const items = this.workflowItems.get(jobId);
    if (!items) {
      throw new Error('Batch job not found');
    }

    const item = items.find(i => i.id === itemId);
    if (!item) {
      throw new Error('Content item not found');
    }

    if (item.status !== 'generated') {
      throw new Error('Content item is not ready for approval');
    }

    item.status = 'approved';
    item.updatedAt = new Date();

    logger.info(`Approved content item ${itemId} in batch job ${jobId}`);
  }

  /**
   * Regenerate content for a specific item
   */
  async regenerateContent(jobId: string, itemId: string): Promise<void> {
    const job = this.batchJobs.get(jobId);
    const items = this.workflowItems.get(jobId);

    if (!job || !items) {
      throw new Error('Batch job not found');
    }

    const item = items.find(i => i.id === itemId);
    if (!item) {
      throw new Error('Content item not found');
    }

    if (!item.scrapedContent) {
      throw new Error('No scraped content available for regeneration');
    }

    await this.generateSingleContent(item, job.settings);
  }

  /**
   * Get approved content items ready for publishing
   */
  async getApprovedContent(jobId: string): Promise<ContentWorkflowItem[]> {
    const items = this.workflowItems.get(jobId);
    if (!items) {
      return [];
    }

    return items.filter(item => item.status === 'approved');
  }

  /**
   * Calculate summary statistics for items
   */
  private calculateSummary(items: ContentWorkflowItem[]) {
    const summary = {
      total: items.length,
      pending: 0,
      crawling: 0,
      crawled: 0,
      generating: 0,
      generated: 0,
      approved: 0,
      failed: 0
    };

    items.forEach(item => {
      summary[item.status]++;
    });

    return summary;
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.webScrapingService.close();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const webScrapingHealth = await this.webScrapingService.healthCheck();
      return webScrapingHealth;
    } catch (error) {
      logger.error('LinkBasedContentService health check failed:', error);
      return false;
    }
  }

  /**
   * Generate AI content for all crawled items with enhanced settings
   */
  async generateBatchContentWithSettings(jobId: string, settings: any): Promise<void> {
    const job = this.batchJobs.get(jobId);
    const items = this.workflowItems.get(jobId);

    if (!job || !items) {
      throw new Error('Batch job not found');
    }

    const crawledItems = items.filter(item => item.status === 'crawled' && item.scrapedContent);
    
    if (crawledItems.length === 0) {
      throw new Error('No crawled content available for generation');
    }

    logger.info(`Starting enhanced content generation for batch job ${jobId} with ${crawledItems.length} items`);

    // Extract reference content from crawled items
    const referenceContent = crawledItems.map(item => ({
      url: item.sourceUrl,
      title: item.scrapedContent!.title,
      content: item.scrapedContent!.content,
      wordCount: item.scrapedContent!.wordCount,
      qualityScore: item.scrapedContent!.qualityScore,
      metadata: item.scrapedContent!.metadata
    }));

    // Process items in parallel (with concurrency limit)
    const concurrency = 2; // Lower concurrency for AI generation
    const batches = this.chunk(crawledItems, concurrency);

    for (const batch of batches) {
      await Promise.all(
        batch.map(item => this.generateEnhancedContent(item, settings, referenceContent))
      );
      
      // Add delay between batches to respect API limits
      await this.delay(3000);
    }

    // Update job status
    const allProcessed = crawledItems.every(item => 
      item.status === 'generated' || item.status === 'failed'
    );
    
    if (allProcessed) {
      job.status = 'completed';
      logger.info(`Batch job ${jobId} enhanced content generation completed`);
    }

    job.updatedAt = new Date();
  }

  /**
   * Generate enhanced content for a single item using reference content
   */
  private async generateEnhancedContent(
    item: ContentWorkflowItem, 
    settings: any,
    referenceContent: any[]
  ): Promise<void> {
    try {
      item.status = 'generating';
      item.updatedAt = new Date();

      if (!item.scrapedContent) {
        throw new Error('No scraped content available');
      }

      logger.info(`Generating enhanced content for: ${item.sourceUrl}`);

      // Prepare enhanced generation request
      const generationRequest: ContentGenerationRequest = {
        type: (settings.contentType as ContentType) || ContentType.BLOG_POST,
        topic: settings.topic || item.scrapedContent.title,
        targetAudience: settings.targetAudience || 'General audience',
        keywords: settings.keywords ? settings.keywords.split(',').map((k: string) => k.trim()) : [],
        brandVoice: {
          tone: settings.brandVoice?.tone || 'professional',
          style: settings.brandVoice?.style || 'conversational',
          vocabulary: settings.brandVoice?.vocabulary || 'industry-specific',
          length: settings.brandVoice?.length || 'detailed'
        },
        context: this.buildEnhancedContext(settings, item.scrapedContent, referenceContent),
        preferredProvider: settings.preferredProvider || 'auto'
      };

      const generatedContent = await this.aiService.generateContent(generationRequest as any);

      item.generatedContent = {
        ...generatedContent,
        status: ContentStatus.DRAFT,
        sourceReference: {
          url: item.sourceUrl,
          title: item.scrapedContent.title,
          usedAsReference: settings.useReferenceContent ?? true,
          rewriteStyle: settings.rewriteStyle || 'similar'
        }
      };
      
      item.status = 'generated';
      logger.info(`Generated enhanced content for ${item.sourceUrl}, ${generatedContent.metadata?.wordCount || 0} words`);

    } catch (error) {
      item.status = 'failed';
      item.errorMessage = error instanceof Error ? error.message : 'Content generation failed';
      logger.error(`Error generating enhanced content for ${item.sourceUrl}:`, error);
    }

    item.updatedAt = new Date();
  }

  /**
   * Build enhanced context for content generation with reference content
   */
  private buildEnhancedContext(
    settings: any, 
    currentContent: ScrapingResult, 
    referenceContent: any[]
  ): string {
    let context = settings.context || '';

    if (settings.useReferenceContent && referenceContent.length > 0) {
      const rewriteInstructions = {
        similar: 'Create content similar in structure and style to the reference content',
        improved: 'Create an improved version that enhances the original content with better structure, more details, and clearer explanations',
        different_angle: 'Create content that covers the same topic from a different perspective or angle',
        expanded: 'Create expanded content that goes deeper into the topic with additional sections and comprehensive coverage'
      };

      const instruction = rewriteInstructions[settings.rewriteStyle as keyof typeof rewriteInstructions] || rewriteInstructions.similar;

      context += `\n\nREFERENCE CONTENT ANALYSIS:
${instruction}.

CURRENT ARTICLE REFERENCE:
Title: ${currentContent.title}
Content Summary: ${currentContent.content.substring(0, 500)}...
Quality Score: ${currentContent.qualityScore}/100
Word Count: ${currentContent.wordCount}

ADDITIONAL REFERENCE ARTICLES (${referenceContent.length - 1} articles):
${referenceContent
  .filter(ref => ref.url !== currentContent.metadata?.url)
  .slice(0, 2) // Limit to 2 additional references
  .map(ref => `- ${ref.title} (${ref.wordCount} words, Quality: ${ref.qualityScore}/100)`)
  .join('\n')}

GENERATION INSTRUCTIONS:
- Use the reference content as inspiration but create original content
- Maintain consistency with the specified brand voice and style
- Ensure the content is relevant to the target audience
- Include the specified requirements (headings, CTA, SEO optimization)
- Word count target: ${settings.requirements?.wordCount || 'flexible based on content depth'}`;
    }

    return context;
  }
} 