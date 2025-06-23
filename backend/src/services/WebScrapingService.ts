import axios from 'axios';
import { chromium, Browser, Page } from 'playwright';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { logger } from '../utils/logger';
import type { ScrapingOptions, ScrapingResult } from '../types';

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
      // Set timeout
      page.setDefaultTimeout(options.timeout || 30000);
      
      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: options.timeout || 30000
      });

      // Wait for content to load
      if (options.waitFor) {
        await page.waitForSelector(options.waitFor, { timeout: 5000 }).catch(() => {
          logger.warn(`Wait selector ${options.waitFor} not found, continuing...`);
        });
      }

      // Extract content
      const extractedData = await page.evaluate(() => {
        // Remove unwanted elements
          const unwantedSelectors = [
            'script', 'style', 'nav', 'header', 'footer', 
          '.advertisement', '.ads', '.popup', '.modal',
          '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
          ];
        
          unwantedSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => el.remove());
          });

        // Extract title
        const title = document.querySelector('h1')?.textContent?.trim() || 
                     document.title || 
                     'No title found';

        // Extract main content using multiple selectors
          const contentSelectors = [
          'article', 'main', '[role="main"]', '.content', '.post-content',
          '.entry-content', '.article-content', '.post-body', '.content-body'
          ];
          
        let content = '';
          for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const clone = element.cloneNode(true) as Element;
            // Remove nested unwanted elements
            unwantedSelectors.forEach(unwanted => {
              clone.querySelectorAll(unwanted).forEach(el => el.remove());
            });
            content = clone.textContent?.trim() || '';
            if (content.length > 100) break;
            }
          }
          
        // Fallback to body content
        if (!content) {
          const paragraphs = Array.from(document.querySelectorAll('p'))
            .map(p => p.textContent?.trim())
            .filter(text => text && text.length > 20)
            .join('\n\n');
          content = paragraphs || document.body.textContent?.trim() || '';
        }

        // Extract metadata
        const getMetaContent = (name: string) => {
          const selectors = [
            `meta[name="${name}"]`,
            `meta[property="og:${name}"]`,
            `meta[property="${name}"]`
          ];
          for (const selector of selectors) {
            const meta = document.querySelector(selector) as HTMLMetaElement;
            if (meta?.content) return meta.content;
          }
          return '';
        };

        const description = getMetaContent('description') || 
                           document.querySelector('p')?.textContent?.substring(0, 160) || '';

        // Extract images - Smart filtering approach
        const images = Array.from(document.querySelectorAll('img'))
          .map(img => {
            const imgElement = img as HTMLImageElement;
            let src = imgElement.src || imgElement.getAttribute('data-src') || imgElement.getAttribute('data-lazy-src');
            
            // Handle relative URLs
            if (src && !src.startsWith('http')) {
              if (src.startsWith('//')) {
                src = window.location.protocol + src;
              } else if (src.startsWith('/')) {
                src = window.location.origin + src;
              } else {
                src = window.location.origin + '/' + src;
              }
            }
            
            return src;
          })
          .filter(src => src && src.length > 0)
          .filter(src => {
            const srcLower = src.toLowerCase();
            
            // Remove team photos specifically for this site
            if (srcLower.includes('doi-ngu') || srcLower.includes('guu-studio-doi-ngu')) {
              return false;
            }
            
            // Remove obvious non-content images
            const unwanted = ['icon', 'logo', 'pixel', 'tracking', '1x1', 'avatar'];
            if (unwanted.some(pattern => srcLower.includes(pattern))) {
              return false;
            }
            
            // Keep if reasonable length
            return src.length > 50;
          })
          .slice(0, 8);

        // Enhanced language detection - Content-first approach
        const detectLanguage = () => {
          // First, detect Vietnamese content by analyzing text
          const sampleText = (title + ' ' + content).toLowerCase();
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
          const domain = window.location.hostname.toLowerCase();
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
          
          // Default fallback
          return 'en';
        };
        
        return {
          title,
          content,
          metadata: {
            description,
            author: getMetaContent('author') || '',
            publishDate: getMetaContent('published_time') || getMetaContent('article:published_time') || '',
            images,
          domain: window.location.hostname,
            language: detectLanguage()
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
      if (!this.browser) {
        await this.initializeBrowser();
      }
      return this.browser !== null;
    } catch (error) {
      logger.error('WebScrapingService health check failed:', error);
      return false;
    }
  }
} 