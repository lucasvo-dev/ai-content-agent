import axios from 'axios';
import { chromium, Browser, Page } from 'playwright';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { logger } from '../utils/logger';
import type { ScrapingOptions, ScrapingResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Enhanced Web Scraping Service with Playwright and Readability
 * Supports multiple extraction strategies for robust content scraping
 */
export class WebScrapingService {
  private browser: Browser | null = null;
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
  ];

  constructor() {
    this.initializeBrowser();
  }

  private async initializeBrowser(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      logger.info('Playwright browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Playwright browser:', error);
    }
  }

  /**
   * Main method to scrape multiple URLs
   */
  async scrapeUrls(urls: string[], options: ScrapingOptions = {}): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    
    for (const url of urls) {
      try {
        const result = await this.scrapeUrl(url, options);
        results.push(result);
        
        // Add delay between requests
        await this.delay(1000);
      } catch (error) {
        logger.error(`Failed to scrape URL ${url}:`, error);
    
        // Add failed result
        results.push({
      url,
          title: 'Failed to scrape',
          content: 'Content extraction failed',
      metadata: {
            description: '',
            author: '',
            publishDate: '',
            images: [],
        wordCount: 0,
            language: 'unknown'
      },
      qualityScore: 0,
          scrapedAt: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Scrape a single URL with multiple strategies
   */
  private async scrapeUrl(url: string, options: ScrapingOptions = {}): Promise<ScrapingResult> {
    logger.info(`Starting to scrape URL: ${url}`);
    
    // Strategy 1: Try Playwright (for JavaScript-heavy sites)
    try {
      const playwrightResult = await this.scrapeWithPlaywright(url, options);
      if (playwrightResult && this.isValidContent(playwrightResult.content)) {
        logger.info(`Successfully scraped ${url} with Playwright`);
        return playwrightResult;
      }
    } catch (error) {
      logger.warn(`Playwright scraping failed for ${url}:`, error);
    }

    // Strategy 2: Try Axios (for static content)
    try {
      const axiosResult = await this.scrapeWithAxios(url, options);
      if (axiosResult && this.isValidContent(axiosResult.content)) {
        logger.info(`Successfully scraped ${url} with Axios`);
        return axiosResult;
      }
    } catch (error) {
      logger.warn(`Axios scraping failed for ${url}:`, error);
    }

    // Strategy 3: Fallback with basic content
    logger.warn(`All scraping strategies failed for ${url}, using fallback`);
    return this.createFallbackResult(url);
  }

  /**
   * Scrape using Playwright for JavaScript-enabled content
   */
  private async scrapeWithPlaywright(url: string, options: ScrapingOptions): Promise<ScrapingResult> {
    if (!this.browser) {
      await this.initializeBrowser();
    }
    
    if (!this.browser) {
      throw new Error('Browser not available');
    }

    const context = await this.browser.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    try {
      // Inject Readability.js script into the page
      const readabilityScriptPath = path.join(process.cwd(), 'node_modules', '@mozilla', 'readability', 'Readability.js');
      if (fs.existsSync(readabilityScriptPath)) {
        await page.addScriptTag({ path: readabilityScriptPath });
      } else {
        logger.warn('Readability.js script not found, scraping may be less effective.');
      }

      // Set timeout to 60 seconds
      page.setDefaultTimeout(options.timeout || 60000);
      
      // Navigate to URL with optimized settings
      await page.goto(url, {
        waitUntil: 'networkidle', // Wait for network to be idle, better for SPA
        timeout: options.timeout || 60000
      });

      // Additional wait for client-side rendering
      await page.waitForTimeout(3000);

      // Check for anti-bot pages
      const pageTitle = await page.title();
      if (pageTitle.toLowerCase().includes('one moment') || pageTitle.toLowerCase().includes('checking your browser')) {
        logger.warn(`Anti-bot page detected for ${url}. Waiting longer...`);
        await page.waitForTimeout(7000); // Wait longer for challenge to resolve
      }

      // Extract content using Readability.js inside the browser context
      const extractedData = await page.evaluate(() => {
        // Clone the document to avoid side-effects from Readability
        const documentClone = document.cloneNode(true) as Document;
        
        // Use Readability
        // Note: Readability is not available in the browser context by default.
        // This will be fixed in the next step by injecting the script.
        // @ts-ignore
        const reader = new Readability(documentClone);
        const article = reader.parse();

        // Fallback if Readability fails
        const title = article?.title || document.title;
        const content = article?.textContent || document.body.textContent || '';
        const excerpt = article?.excerpt || content.substring(0, 150);
        
        // Basic metadata extraction
        const getMetaContent = (name: string) => {
          const meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
          return meta ? meta.content : '';
        };

        const images = Array.from(document.querySelectorAll('article img, main img, .post-content img'))
          .map(img => (img as HTMLImageElement).src)
          .filter(src => src && src.length > 50)
          .slice(0, 10);

        return {
          title,
          content,
          excerpt,
          metadata: {
            description: getMetaContent('description') || excerpt,
            author: getMetaContent('author') || article?.byline || '',
            publishDate: getMetaContent('article:published_time') || '',
            images,
            language: document.documentElement.lang || 'en',
            domain: window.location.hostname
          }
        };
      });

      const wordCount = this.countWords(extractedData.content);
      const qualityScore = this.calculateQualityScore(extractedData.title, extractedData.content, {
        domain: extractedData.metadata.domain,
        wordCount,
        readTime: Math.ceil(wordCount / 200),
        language: extractedData.metadata.language,
        images: extractedData.metadata.images
      });
      
      return {
        url,
        title: extractedData.title,
        content: extractedData.content,
        metadata: {
          ...extractedData.metadata,
          wordCount,
        },
        qualityScore,
        scrapedAt: new Date().toISOString()
      };

    } finally {
      await context.close();
    }
  }

  /**
   * Scrape using Axios for static content
   */
  private async scrapeWithAxios(url: string, options: ScrapingOptions): Promise<ScrapingResult> {
    const response = await axios.get(url, {
      timeout: options.timeout || 10000,
      headers: {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }
    });

    const dom = new JSDOM(response.data, { url });
    const document = dom.window.document;

    // Use Readability for content extraction
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      throw new Error('Failed to parse content with Readability');
    }

    // Enhanced image extraction for Axios method - Balanced approach
    const images = (() => {
      // Get all images first
      const allImages = Array.from(document.querySelectorAll('img'))
        .map(img => {
          let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
          
          // Handle relative URLs
          if (src && !src.startsWith('http')) {
            const baseUrl = new URL(url);
            if (src.startsWith('//')) {
              src = baseUrl.protocol + src;
            } else if (src.startsWith('/')) {
              src = baseUrl.origin + src;
            } else {
              src = baseUrl.origin + '/' + src;
            }
          }
          
          return src;
        })
        .filter(src => src && src.length > 0);

      // Filter with balanced approach - remove obvious non-content images
      const filteredImages = allImages.filter(src => {
        const srcLower = src.toLowerCase();
        
        // Remove obvious non-content images
        const definitelyUnwanted = [
          'icon', 'logo', 'avatar', 'pixel', 'tracking', '1x1',
          'ads', 'banner', 'button', 'arrow', 'social-share',
          'facebook', 'twitter', 'instagram', 'youtube',
          'header', 'footer', 'nav', 'menu'
        ];
        
        // Check for definitely unwanted patterns
        if (definitelyUnwanted.some(pattern => srcLower.includes(pattern))) {
          return false;
        }
        
        // Remove team photos specifically (but keep wedding content)
        if (srcLower.includes('doi-ngu') || srcLower.includes('guu-studio-doi-ngu')) {
          return false;
        }
        
        // Keep if URL is reasonable length (likely real content)
        return src.length > 50;
      });

      // If we have reasonable number of images, take them
      if (filteredImages.length <= 8) {
        return filteredImages;
      }
      
      // If too many, try to prioritize content area images
      const contentImages = filteredImages.filter(src => {
        const srcLower = src.toLowerCase();
        
        // Prefer images that are likely content (not team/staff photos)
        return !srcLower.includes('team') && 
               !srcLower.includes('staff') && 
               !srcLower.includes('author') &&
               !srcLower.includes('profile');
      });
      
      // Return content images if available, otherwise take first 5 filtered
      return contentImages.length > 0 ? contentImages.slice(0, 8) : filteredImages.slice(0, 5);
    })();

    // Enhanced language detection for Axios method - Content-first approach
    const detectLanguage = () => {
      // First, detect Vietnamese content by analyzing text
      const sampleText = (article.title + ' ' + article.textContent).toLowerCase();
      const vietnameseWords = ['việt', 'nam', 'của', 'và', 'cho', 'với', 'trong', 'một', 'có', 'là', 'được', 'để', 'này', 'đó', 'những', 'các', 'không', 'từ', 'tại', 'về', 'theo', 'như', 'sẽ', 'đã', 'đang', 'khi', 'nếu', 'thì', 'còn', 'cũng', 'đều', 'chỉ', 'giữa', 'sau', 'trước', 'ngoài', 'bên', 'dưới', 'trên', 'giờ', 'ngày', 'tháng', 'năm', 'đám', 'cưới', 'lễ', 'nghi', 'truyền', 'thống'];
      const vietnameseCount = vietnameseWords.filter(word => sampleText.includes(word)).length;
      
      // Also check for Vietnamese diacritics
      const vietnameseDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g;
      const diacriticMatches = (sampleText.match(vietnameseDiacritics) || []).length;
      
      // Strong Vietnamese indicators
      if (vietnameseCount >= 5 || diacriticMatches >= 10) {
        return 'vi';
      }
      
      // Check domain for Vietnamese sites
      const domain = new URL(url).hostname.toLowerCase();
      if (domain.includes('.vn') || domain.includes('vietnam')) {
        return 'vi';
      }
      
      // Check HTML lang attribute as secondary
      const htmlLang = document.documentElement.lang;
      if (htmlLang && !htmlLang.startsWith('en')) return htmlLang;
      
      // Check meta language
      const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') ||
                      document.querySelector('meta[name="language"]')?.getAttribute('content');
      if (metaLang && !metaLang.startsWith('en')) return metaLang;
      
      return 'en';
    };

    const detectedLanguage = detectLanguage();
    const wordCount = this.countWords(article.textContent);
    const qualityScore = this.calculateQualityScore(article.title, article.textContent, {
      domain: new URL(url).hostname,
      wordCount,
      readTime: Math.ceil(wordCount / 200),
      language: detectedLanguage,
      images
    });

    return {
      url,
      title: article.title,
      content: article.textContent,
      metadata: {
        description: article.excerpt || '',
        author: article.byline || '',
        publishDate: '',
        images,
        wordCount,
        language: detectedLanguage
      },
      qualityScore,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Create fallback result when all strategies fail
   */
  private createFallbackResult(url: string): ScrapingResult {
    return {
      url,
      title: `Content from ${new URL(url).hostname}`,
      content: `Content could not be extracted from ${url}. This may be due to the site's structure or anti-scraping measures.`,
      metadata: {
        description: 'Content extraction failed',
        author: '',
        publishDate: '',
        images: [],
        wordCount: 0,
        language: 'unknown'
      },
      qualityScore: 10,
      scrapedAt: new Date().toISOString()
    };
  }

  /**
   * Validate if content is meaningful
   */
  private isValidContent(content: string): boolean {
    return content && content.trim().length > 50;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate content quality score
   */
  private calculateQualityScore(title: string, content: string, metadata: any): number {
    let score = 0;

    // Title quality (0-20 points)
    if (title && title.length > 10) score += 20;
    else if (title && title.length > 5) score += 10;

    // Content length (0-40 points)
    const wordCount = metadata.wordCount || 0;
    if (wordCount > 1000) score += 40;
    else if (wordCount > 500) score += 30;
    else if (wordCount > 200) score += 20;
    else if (wordCount > 50) score += 10;

    // Content structure (0-20 points)
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 5) score += 20;
    else if (paragraphs.length > 2) score += 15;
    else if (paragraphs.length > 0) score += 10;

    // Domain reputation (0-10 points)
    const domain = metadata.domain || '';
    if (domain.includes('.edu') || domain.includes('.gov')) score += 10;
    else if (domain.includes('.org')) score += 8;
    else if (domain.includes('.com')) score += 5;

    // Language detection (0-10 points)
    if (metadata.language === 'en' || metadata.language === 'vi') score += 10;
    else if (metadata.language && metadata.language !== 'unknown') score += 5;

    return Math.min(score, 100);
  }

  /**
   * Get random user agent
   */
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Playwright browser closed');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.browser) {
        return true;
      }
      await this.initializeBrowser();
      return this.browser !== null;
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get scraping job status (for API compatibility)
   */
  async getScrapingJobStatus(jobId: string): Promise<any> {
    // This is a simple implementation for API compatibility
    // In a real implementation, you'd track job statuses
    return {
      id: jobId,
      status: 'completed',
      progress: 100,
      results: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        logger.info('WebScrapingService cleanup completed');
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
} 