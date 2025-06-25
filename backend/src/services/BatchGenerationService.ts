// Ensure environment variables are loaded
import dotenv from 'dotenv';
dotenv.config();

import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { HybridAIService } from './HybridAIService.js';
import {
  BatchGenerationJob,
  BatchGenerationSettings,
  GenerationTask,
  GeneratedContent,
  ResearchJob,
  ScrapedContent,
  ContentType,
  ContentStatus
} from '../types/index.js';

interface BatchJobData {
  batchJobId: string;
  researchJobId: string;
  settings: BatchGenerationSettings;
  tasks: GenerationTask[];
}

interface GenerationTaskData {
  taskId: string;
  batchJobId: string;
  crawledContent: ScrapedContent[];
  settings: BatchGenerationSettings;
  priority: number;
}

export class BatchGenerationService {
  private redis: Redis;
  private batchQueue: Queue;
  private aiService: HybridAIService;
  private isInitialized = false;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Fix BullMQ warning
    });

    this.batchQueue = new Queue('batch-generation', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.aiService = new HybridAIService();
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    new Worker(
      'batch-generation',
      async (job) => {
        const { type } = job.data;
        
        switch (type) {
          case 'batch-generate':
            return await this.processBatchGeneration(job.data);
          case 'generate-content':
            return await this.processContentGeneration(job.data);
          default:
            throw new Error(`Unknown job type: ${type}`);
        }
      },
      {
        connection: this.redis,
        concurrency: 5, // Process 5 content generations concurrently
      }
    );

    console.log('BatchGenerationService initialized successfully');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async generateBatch(
    researchJobId: string,
    settings: BatchGenerationSettings
  ): Promise<string> {
    await this.initialize();

    const batchJobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get research results
    const researchResults = await this.getResearchResults(researchJobId);
    
    if (!researchResults || researchResults.length === 0) {
      throw new Error('No research results found for batch generation');
    }

    // Create generation tasks
    const tasks = this.createGenerationTasks(researchResults, settings, batchJobId);

    // Create batch job record
    const batchJob: BatchGenerationJob = {
      id: batchJobId,
      researchJobId,
      settings: {
        targetCount: settings.targetCount || 10,
        brandVoice: settings.brandVoice,
        targetAudience: settings.targetAudience,
        contentType: settings.contentType || 'blog_post',
        requirements: {
          wordCount: settings.requirements?.wordCount || '1000-1500',
          includeHeadings: settings.requirements?.includeHeadings ?? true,
          seoOptimized: settings.requirements?.seoOptimized ?? true,
          uniquenessThreshold: settings.requirements?.uniquenessThreshold || 0.8,
          ...settings.requirements,
        },
        aiProvider: settings.aiProvider || 'auto',
      },
      status: 'pending',
      progress: {
        total: tasks.length,
        completed: 0,
        failed: 0,
        processing: 0,
        percentage: 0,
        currentStage: 'Initializing batch generation',
        estimatedTimeRemaining: `${Math.ceil(tasks.length * 2)} minutes`,
      },
      results: [],
      createdAt: new Date(),
    };

    // Store batch job data
    await this.redis.setex(
      `batch_job:${batchJobId}`,
      7200, // 2 hours TTL
      JSON.stringify(batchJob)
    );

    // Queue the batch generation job
    await this.batchQueue.add('batch-generate', {
      type: 'batch-generate',
      batchJobId,
      researchJobId,
      settings: batchJob.settings,
      tasks,
    });

    return batchJobId;
  }

  async getBatchJobStatus(batchJobId: string): Promise<BatchGenerationJob | null> {
    const jobData = await this.redis.get(`batch_job:${batchJobId}`);
    if (!jobData) return null;

    return JSON.parse(jobData);
  }

  async getBatchJobResults(batchJobId: string): Promise<GeneratedContent[]> {
    const job = await this.getBatchJobStatus(batchJobId);
    if (!job) {
      throw new Error('Batch job not found');
    }

    // Extract GeneratedContent from each task's result property
    return job.results
      .map(task => task.result)
      .filter((result): result is GeneratedContent => !!result);
  }

  private async processBatchGeneration(jobData: BatchJobData): Promise<void> {
    const { batchJobId, tasks } = jobData;

    try {
      // Update job status to processing
      await this.updateBatchJobStatus(batchJobId, 'processing', {
        currentStage: 'Starting content generation',
      });

      // Queue individual content generation tasks
      for (const task of tasks) {
        await this.batchQueue.add('generate-content', {
          type: 'generate-content',
          taskId: task.id,
          batchJobId,
          crawledContent: task.crawledContent,
          settings: task.settings,
          priority: task.priority,
        }, {
          priority: task.priority,
          delay: task.priority * 1000, // Stagger based on priority
        });
      }

      console.log(`Queued ${tasks.length} content generation tasks for batch ${batchJobId}`);
    } catch (error) {
      await this.updateBatchJobStatus(batchJobId, 'failed', {
        currentStage: 'Failed to initialize batch generation',
      });
      throw error;
    }
  }

  private async processContentGeneration(taskData: GenerationTaskData): Promise<GeneratedContent> {
    const { taskId, batchJobId, crawledContent, settings } = taskData;

    try {
      // Update progress
      await this.updateBatchJobProgress(batchJobId, 'processing', taskId);

      // Build context-aware prompt
      const contextPrompt = await this.buildContextAwarePrompt(
        crawledContent,
        settings.brandVoice,
        settings.targetAudience
      );

      // Generate content using AI service
      const generatedContent = await this.aiService.generateContent({
        type: settings.contentType as 'blog_post' | 'social_media' | 'email' | 'ad_copy',
        topic: this.extractMainTopic(crawledContent),
        brandVoice: settings.brandVoice,
        targetAudience: settings.targetAudience,
        keywords: this.extractKeywords(crawledContent),
        requirements: {
          wordCount: settings.requirements.wordCount,
          includeHeadings: settings.requirements.includeHeadings,
          seoOptimized: settings.requirements.seoOptimized,
        },
        preferredProvider: settings.aiProvider,
      });

      // Validate content uniqueness
      const uniquenessScore = await this.validateUniqueness(
        generatedContent.body,
        crawledContent
      );

      if (uniquenessScore < settings.requirements.uniquenessThreshold) {
        throw new Error(`Generated content not unique enough: ${uniquenessScore}`);
      }

      // Enhance with metadata
      const enhancedContent: GeneratedContent = {
        id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: settings.contentType as ContentType,
        title: generatedContent.title,
        body: generatedContent.body,
        excerpt: generatedContent.excerpt || generatedContent.body.substring(0, 200) + '...',
        status: ContentStatus.DRAFT,
        generatedAt: new Date(),
        metadata: {
          batchJobId,
          taskId,
          uniquenessScore,
          sourceUrls: crawledContent.map(c => c.sourceUrl),
          generatedAt: new Date().toISOString(),
          aiProvider: settings.aiProvider,
          wordCount: this.countWords(generatedContent.body),
          readingTime: this.calculateReadingTime(generatedContent.body),
          qualityScore: generatedContent.metadata?.qualityScore || 0,
          seoTitle: generatedContent.metadata?.seoTitle || '',
          seoDescription: generatedContent.metadata?.seoDescription || '',
          keywords: generatedContent.metadata?.keywords || [],
          featuredImageSuggestion: generatedContent.metadata?.featuredImageSuggestion || '',
          seoScore: generatedContent.metadata?.seoScore || 0,
          ...generatedContent.metadata,
        },
      };

      // Update progress as completed
      await this.updateBatchJobProgress(batchJobId, 'completed', taskId, enhancedContent);

      return enhancedContent;
    } catch (error) {
      // Update progress as failed
      await this.updateBatchJobProgress(batchJobId, 'failed', taskId, null, error.message);
      throw error;
    }
  }

  private async getResearchResults(researchJobId: string): Promise<ScrapedContent[]> {
    // Get research job results from Redis
    const researchData = await this.redis.get(`research_job:${researchJobId}`);
    if (!researchData) {
      throw new Error('Research job not found');
    }

    const researchJob: ResearchJob = JSON.parse(researchData);
    
    if (researchJob.status !== 'completed') {
      throw new Error('Research job not completed yet');
    }

    // Extract crawled content from results
    const crawledContent: ScrapedContent[] = [];
    
    if (researchJob.results?.crawledContent) {
      crawledContent.push(...researchJob.results.crawledContent);
    }

    return crawledContent;
  }

  private createGenerationTasks(
    crawledContent: ScrapedContent[],
    settings: BatchGenerationSettings,
    batchJobId: string
  ): GenerationTask[] {
    const tasks: GenerationTask[] = [];
    const targetCount = settings.targetCount || 10;

    // Group crawled content by themes or distribute evenly
    const contentGroups = this.groupContentForGeneration(crawledContent, targetCount);

    for (let i = 0; i < targetCount; i++) {
      const taskId = `task_${batchJobId}_${i + 1}`;
      const contentGroup = contentGroups[i % contentGroups.length];

      tasks.push({
        id: taskId,
        batchJobId,
        crawledContent: contentGroup,
        settings,
        priority: i + 1, // Higher number = lower priority
        status: 'pending',
        createdAt: new Date(),
      });
    }

    return tasks;
  }

  private groupContentForGeneration(
    crawledContent: ScrapedContent[],
    targetCount: number
  ): ScrapedContent[][] {
    if (crawledContent.length === 0) {
      throw new Error('No crawled content available for generation');
    }

    const groups: ScrapedContent[][] = [];
    const contentPerGroup = Math.max(1, Math.floor(crawledContent.length / targetCount));

    for (let i = 0; i < targetCount; i++) {
      const startIndex = i * contentPerGroup;
      const endIndex = Math.min(startIndex + contentPerGroup, crawledContent.length);
      
      // Ensure each group has at least one piece of content
      const group = crawledContent.slice(startIndex, endIndex);
      if (group.length === 0 && crawledContent.length > 0) {
        // If we run out of content, reuse from the beginning
        group.push(crawledContent[i % crawledContent.length]);
      }
      
      groups.push(group);
    }

    return groups;
  }

  private async buildContextAwarePrompt(
    crawledContent: ScrapedContent[],
    brandVoice: any,
    targetAudience: string
  ): Promise<string> {
    // Extract key themes and insights
    const themes = this.extractThemes(crawledContent);
    const bestPractices = this.extractBestPractices(crawledContent);
    const keyInsights = this.extractKeyInsights(crawledContent);

    return `
Based on the following research insights, create original, high-quality content:

RESEARCH INSIGHTS:
${keyInsights.slice(0, 5).map((insight, i) => `${i + 1}. ${insight}`).join('\n')}

KEY THEMES:
${themes.slice(0, 3).join(', ')}

BEST PRACTICES IDENTIFIED:
${bestPractices.slice(0, 5).map((practice, i) => `- ${practice}`).join('\n')}

TARGET AUDIENCE: ${targetAudience}

BRAND VOICE:
- Tone: ${brandVoice.tone}
- Style: ${brandVoice.style}
- Vocabulary: ${brandVoice.vocabulary}

REQUIREMENTS:
- Create 100% ORIGINAL content (do NOT copy from sources)
- Incorporate insights and best practices naturally
- Use engaging, conversational writing style
- Include actionable advice and examples
- Optimize for SEO with natural keyword usage
- Structure with clear headings and sections
    `;
  }

  private extractThemes(crawledContent: ScrapedContent[]): string[] {
    // Simple theme extraction based on common words
    const allText = crawledContent.map(c => c.content).join(' ');
    const words = allText.toLowerCase().split(/\s+/);
    const wordFreq: { [key: string]: number } = {};

    words.forEach(word => {
      if (word.length > 4 && !this.isStopWord(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractBestPractices(crawledContent: ScrapedContent[]): string[] {
    const practices: string[] = [];
    
    crawledContent.forEach(content => {
      // Look for sentences that contain best practice indicators
      const sentences = content.content.split(/[.!?]+/);
      sentences.forEach(sentence => {
        const lowerSentence = sentence.toLowerCase();
        if (
          lowerSentence.includes('best practice') ||
          lowerSentence.includes('should') ||
          lowerSentence.includes('recommended') ||
          lowerSentence.includes('important to') ||
          lowerSentence.includes('key to')
        ) {
          practices.push(sentence.trim());
        }
      });
    });

    return practices.slice(0, 10);
  }

  private extractKeyInsights(crawledContent: ScrapedContent[]): string[] {
    const insights: string[] = [];
    
    crawledContent.forEach(content => {
      // Extract first few sentences as key insights
      const sentences = content.content.split(/[.!?]+/).slice(0, 3);
      insights.push(...sentences.map(s => s.trim()).filter(s => s.length > 50));
    });

    return insights.slice(0, 10);
  }

  private extractMainTopic(crawledContent: ScrapedContent[]): string {
    // Use the most common title words as the main topic
    const titles = crawledContent.map(c => c.title).filter(t => t);
    if (titles.length === 0) return 'Content Topic';

    const words = titles.join(' ').toLowerCase().split(/\s+/);
    const wordFreq: { [key: string]: number } = {};

    words.forEach(word => {
      if (word.length > 3 && !this.isStopWord(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    const topWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word);

    return topWords.join(' ') || 'Content Topic';
  }

  private extractKeywords(crawledContent: ScrapedContent[]): string[] {
    const themes = this.extractThemes(crawledContent);
    return themes.slice(0, 5);
  }

  private async validateUniqueness(
    generatedContent: string,
    sourceContent: ScrapedContent[]
  ): Promise<number> {
    // Simple uniqueness check based on content similarity
    const generatedWords = new Set(
      generatedContent.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    let totalOverlap = 0;
    let totalSourceWords = 0;

    sourceContent.forEach(source => {
      const sourceWords = new Set(
        source.content.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      );
      
      const overlap = new Set([...generatedWords].filter(x => sourceWords.has(x)));
      totalOverlap += overlap.size;
      totalSourceWords += sourceWords.size;
    });

    if (totalSourceWords === 0) return 1.0;

    const uniquenessScore = 1 - (totalOverlap / totalSourceWords);
    return Math.max(0, Math.min(1, uniquenessScore));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'that', 'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.countWords(text);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  private async updateBatchJobStatus(
    batchJobId: string,
    status: BatchGenerationJob['status'],
    progressUpdate?: Partial<BatchGenerationJob['progress']>
  ): Promise<void> {
    const jobData = await this.redis.get(`batch_job:${batchJobId}`);
    if (!jobData) return;

    const job: BatchGenerationJob = JSON.parse(jobData);
    job.status = status;
    
    if (progressUpdate) {
      job.progress = { ...job.progress, ...progressUpdate };
    }
    
    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    await this.redis.setex(
      `batch_job:${batchJobId}`,
      7200, // 2 hours TTL
      JSON.stringify(job)
    );
  }

  private async updateBatchJobProgress(
    batchJobId: string,
    taskStatus: 'processing' | 'completed' | 'failed',
    taskId: string,
    result?: GeneratedContent,
    error?: string
  ): Promise<void> {
    const job = await this.getBatchJobStatus(batchJobId);
    if (!job) return;

    const taskIndex = job.results.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = job.results[taskIndex];

    switch (taskStatus) {
      case 'processing':
        job.progress.processing = (job.progress.processing || 0) + 1;
        task.status = 'processing';
        task.startedAt = new Date();
        break;
      case 'completed':
        job.progress.completed++;
        if (job.progress.processing) job.progress.processing--;
        task.status = 'completed';
        task.completedAt = new Date();
      if (result) {
          // Assign the generated content to the task's result
          task.result = result;
      }
        break;
      case 'failed':
        job.progress.failed++;
        if (job.progress.processing) job.progress.processing--;
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = error;
        break;
    }

    // Update percentage and status
    job.progress.percentage = Math.round(
      ((job.progress.completed + job.progress.failed) / job.progress.total) * 100
    );

    // Update estimated time remaining
    const remaining = job.progress.total - job.progress.completed - job.progress.failed;
    job.progress.estimatedTimeRemaining = remaining > 0 ? `${remaining * 2} minutes` : '';

    // Update overall job status
    if (job.progress.completed + job.progress.failed >= job.progress.total) {
      job.status = job.progress.failed === 0 ? 'completed' : 'completed_with_errors';
      job.progress.currentStage = job.status === 'completed' 
        ? 'All content generated successfully' 
        : `Completed with ${job.progress.failed} errors`;
      job.completedAt = new Date();
    }

    await this.redis.setex(
      `batch_job:${batchJobId}`,
      7200, // 2 hours TTL
      JSON.stringify(job)
    );
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
} 