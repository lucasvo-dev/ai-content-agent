import axios from 'axios';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

interface ResearchOptions {
  searchDepth?: number;
  includeMetrics?: boolean;
  language?: string;
  region?: string;
  searchEngines?: ('google' | 'bing')[];
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  position: number;
  searchVolume?: number;
  competition?: number;
  cpc?: number;
}

interface KeywordMetrics {
  searchVolume: number;
  competition: number;
  difficulty: number;
  cpc?: number;
  trend?: number[];
}

interface ResearchResult {
  keyword: string;
  searchResults: SearchResult[];
  metrics: KeywordMetrics;
  topUrls: string[];
  analysisScore: number;
}

interface ResearchJob {
  id: string;
  type: 'keywords';
  keywords: string[];
  options: ResearchOptions;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  results: ResearchResult[];
  createdAt: Date;
  completedAt?: Date;
}

export class SEOResearchService {
  private researchQueue: Queue;
  private redis: Redis;
  private googleApiKey: string;
  private googleSearchEngineId: string;
  private bingApiKey: string;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Fix BullMQ warning
    });

    this.researchQueue = new Queue('seo-research', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    });

    // API Keys from environment
    this.googleApiKey = process.env.GOOGLE_SEARCH_API_KEY || '';
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
    this.bingApiKey = process.env.BING_SEARCH_API_KEY || '';

    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    new Worker(
      'seo-research',
      async (job) => {
        const { keywords, options, jobId } = job.data;
        return await this.processKeywordResearch(jobId, keywords, options);
      },
      {
        connection: this.redis,
        concurrency: 2, // Process 2 keywords concurrently
      }
    );
  }

  async researchKeywords(
    keywords: string[],
    options: ResearchOptions = {}
  ): Promise<string> {
    const jobId = `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create research job record
    const researchJob: ResearchJob = {
      id: jobId,
      type: 'keywords',
      keywords,
      options: {
        searchDepth: 10,
        includeMetrics: true,
        language: 'en',
        region: 'US',
        searchEngines: ['google', 'bing'],
        ...options,
      },
      status: 'pending',
      progress: {
        total: keywords.length,
        completed: 0,
        failed: 0,
      },
      results: [],
      createdAt: new Date(),
    };

    // Store job data
    await this.redis.setex(
      `research_job:${jobId}`,
      3600, // 1 hour TTL
      JSON.stringify(researchJob)
    );

    // Queue the research job
    await this.researchQueue.add('keyword-research', {
      jobId,
      keywords,
      options: researchJob.options,
    });

    return jobId;
  }

  async getResearchJobStatus(jobId: string): Promise<ResearchJob | null> {
    const jobData = await this.redis.get(`research_job:${jobId}`);
    if (!jobData) return null;

    return JSON.parse(jobData);
  }

  private async processKeywordResearch(
    jobId: string,
    keywords: string[],
    options: ResearchOptions
  ): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [];
    
    // Update job status
    await this.updateJobStatus(jobId, 'processing');

    for (const keyword of keywords) {
      try {
        console.log(`Researching keyword: ${keyword}`);
        
        // Search Google for this keyword
        const googleResults = await this.searchGoogle(keyword, {
          num: options.searchDepth || 10,
          language: options.language || 'en',
          region: options.region || 'US',
        });

        // Search Bing for comparison (if enabled)
        let bingResults: SearchResult[] = [];
        if (options.searchEngines?.includes('bing') && this.bingApiKey) {
          bingResults = await this.searchBing(keyword, {
            count: options.searchDepth || 10,
            language: options.language || 'en',
            region: options.region || 'US',
          });
        }

        // Combine and deduplicate results
        const combinedResults = this.combineSearchResults(googleResults, bingResults);
        
        // Get keyword metrics
        const metrics = await this.getKeywordMetrics(keyword);
        
        // Analyze results
        const topUrls = combinedResults.slice(0, 10).map(result => result.url);
        const analysisScore = this.calculateAnalysisScore(combinedResults, metrics);

        const researchResult: ResearchResult = {
          keyword,
          searchResults: combinedResults,
          metrics,
          topUrls,
          analysisScore,
        };

        results.push(researchResult);
        await this.updateJobProgress(jobId, 1, 0);

        // Add delay between keyword searches to respect rate limits
        await this.delay(2000);
      } catch (error) {
        console.error(`Failed to research keyword ${keyword}:`, error);
        await this.updateJobProgress(jobId, 0, 1);
      }
    }

    // Update final job status
    await this.updateJobStatus(jobId, 'completed', results);
    
    return results;
  }

  private async searchGoogle(
    keyword: string,
    options: { num: number; language: string; region: string }
  ): Promise<SearchResult[]> {
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      console.warn('Google Search API credentials not configured');
      return [];
    }

    try {
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.googleApiKey,
          cx: this.googleSearchEngineId,
          q: keyword,
          num: options.num,
          gl: options.region.toLowerCase(),
          hl: options.language,
        },
        timeout: 10000,
      });

      const items = response.data.items || [];
      
      return items.map((item: any, index: number): SearchResult => ({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
        domain: this.extractDomain(item.link || ''),
        position: index + 1,
        searchVolume: 0, // Will be populated by keyword metrics
        competition: 0,
        cpc: 0,
      }));
    } catch (error) {
      console.error('Google Search API error:', error);
      return [];
    }
  }

  private async searchBing(
    keyword: string,
    options: { count: number; language: string; region: string }
  ): Promise<SearchResult[]> {
    if (!this.bingApiKey) {
      console.warn('Bing Search API credentials not configured');
      return [];
    }

    try {
      const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
        headers: {
          'Ocp-Apim-Subscription-Key': this.bingApiKey,
        },
        params: {
          q: keyword,
          count: options.count,
          mkt: `${options.language}-${options.region}`,
          textDecorations: false,
          textFormat: 'Raw',
        },
        timeout: 10000,
      });

      const webPages = response.data.webPages?.value || [];
      
      return webPages.map((item: any, index: number): SearchResult => ({
        title: item.name || '',
        url: item.url || '',
        snippet: item.snippet || '',
        domain: this.extractDomain(item.url || ''),
        position: index + 1,
        searchVolume: 0,
        competition: 0,
        cpc: 0,
      }));
    } catch (error) {
      console.error('Bing Search API error:', error);
      return [];
    }
  }

  private combineSearchResults(
    googleResults: SearchResult[],
    bingResults: SearchResult[]
  ): SearchResult[] {
    const combined = [...googleResults];
    const existingUrls = new Set(googleResults.map(r => r.url));

    // Add unique Bing results
    for (const bingResult of bingResults) {
      if (!existingUrls.has(bingResult.url)) {
        combined.push({
          ...bingResult,
          position: combined.length + 1,
        });
        existingUrls.add(bingResult.url);
      }
    }

    return combined.slice(0, 15); // Return top 15 unique results
  }

  private async getKeywordMetrics(keyword: string): Promise<KeywordMetrics> {
    // This is a simplified implementation
    // In production, you would integrate with tools like:
    // - Google Keyword Planner API
    // - SEMrush API
    // - Ahrefs API
    // - Moz API

    // For now, we'll provide estimated metrics based on keyword characteristics
    const metrics = this.estimateKeywordMetrics(keyword);
    
    return metrics;
  }

  private estimateKeywordMetrics(keyword: string): KeywordMetrics {
    const words = keyword.split(' ');
    const length = words.length;
    
    // Estimate search volume based on keyword characteristics
    let searchVolume = 1000;
    if (length === 1) searchVolume = 10000; // Single words tend to have high volume
    else if (length === 2) searchVolume = 5000; // Two words moderate volume
    else if (length >= 3) searchVolume = 2000; // Long tail keywords lower volume

    // Estimate competition (0-1 scale)
    let competition = 0.5;
    if (words.some(word => ['buy', 'best', 'review', 'price'].includes(word.toLowerCase()))) {
      competition = 0.8; // Commercial keywords high competition
    } else if (words.some(word => ['how', 'what', 'why', 'guide'].includes(word.toLowerCase()))) {
      competition = 0.3; // Informational keywords lower competition
    }

    // Estimate difficulty (0-100 scale)
    const difficulty = Math.round(competition * 70 + Math.random() * 30);

    // Estimate CPC
    const cpc = competition * 2.5 + Math.random() * 1.5;

    return {
      searchVolume: Math.round(searchVolume * (0.5 + Math.random())),
      competition: Math.round(competition * 100) / 100,
      difficulty,
      cpc: Math.round(cpc * 100) / 100,
    };
  }

  private calculateAnalysisScore(
    results: SearchResult[],
    metrics: KeywordMetrics
  ): number {
    let score = 0;

    // Results quality score (0-40 points)
    const avgSnippetLength = results.reduce((sum, r) => sum + r.snippet.length, 0) / results.length;
    if (avgSnippetLength > 100) score += 40;
    else if (avgSnippetLength > 50) score += 25;
    else score += 10;

    // Domain diversity score (0-30 points)
    const uniqueDomains = new Set(results.map(r => r.domain)).size;
    if (uniqueDomains >= 8) score += 30;
    else if (uniqueDomains >= 5) score += 20;
    else score += 10;

    // Search volume score (0-30 points)
    if (metrics.searchVolume > 5000) score += 30;
    else if (metrics.searchVolume > 1000) score += 20;
    else if (metrics.searchVolume > 100) score += 10;

    return Math.min(score, 100);
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: ResearchJob['status'],
    results?: ResearchResult[]
  ): Promise<void> {
    const jobData = await this.redis.get(`research_job:${jobId}`);
    if (!jobData) return;

    const job: ResearchJob = JSON.parse(jobData);
    job.status = status;
    
    if (results) {
      job.results = results;
    }
    
    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    await this.redis.setex(
      `research_job:${jobId}`,
      3600,
      JSON.stringify(job)
    );
  }

  private async updateJobProgress(
    jobId: string,
    completed: number,
    failed: number
  ): Promise<void> {
    const jobData = await this.redis.get(`research_job:${jobId}`);
    if (!jobData) return;

    const job: ResearchJob = JSON.parse(jobData);
    job.progress.completed += completed;
    job.progress.failed += failed;

    await this.redis.setex(
      `research_job:${jobId}`,
      3600,
      JSON.stringify(job)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup(): Promise<void> {
    await this.researchQueue.close();
    this.redis.disconnect();
  }
}

export default SEOResearchService; 