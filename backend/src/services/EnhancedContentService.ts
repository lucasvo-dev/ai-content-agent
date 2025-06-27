import { HybridAIService } from './HybridAIService';
import { PhotoGalleryService, GalleryImage, PhotoGalleryImage } from './PhotoGalleryService';
import { logger } from '../utils/logger';
import { 
  ContentType as IndexContentType,
  ContentGenerationRequest as IndexContentGenerationRequest,
  GeneratedContent as IndexGeneratedContent,
  ContentMetadata as IndexContentMetadata,
  BrandVoiceConfig,
  ContentStatus
} from '../types/index';

// Interface specific for enhanced content with images
export interface EnhancedContentRequest {
  type: 'blog_post' | 'social_media';
  topic: string;
  context?: string;
  targetAudience: string;
  keywords: string[];
  brandVoice: {
    tone: string;
    style: string;
    vocabulary: string;
    length: string;
    brandName?: string;
  };
  preferredProvider?: 'auto' | 'openai' | 'gemini';
  imageSettings?: {
    includeImages: boolean;
    imageSelection?: 'category' | 'folder';
    imageCategory?: string;
    specificFolder?: string;
    maxImages?: number | 'auto';
    ensureConsistency?: boolean;
  };
  language?: 'vietnamese' | 'english';
  specialInstructions?: string;
}

// Enhanced content metadata with image properties
export interface EnhancedContentMetadata extends IndexContentMetadata {
  featuredImageAlt?: string;
  featuredImageCaption?: string;
  galleryImages?: Array<{
    url: string;
    alt_text: string;
    caption?: string;
    wp_media_id?: number;
  }>;
}

// Enhanced generated content with image metadata
export interface EnhancedGeneratedContent extends Omit<IndexGeneratedContent, 'metadata' | 'status'> {
  metadata: EnhancedContentMetadata;
  status?: ContentStatus;
}

export class EnhancedContentService {
  private aiService: HybridAIService;
  private photoGalleryService: PhotoGalleryService;

  constructor() {
    this.aiService = new HybridAIService();
    this.photoGalleryService = new PhotoGalleryService();
  }

  /**
   * Generate content with automatic image integration from Photo Gallery
   */
  async generateContentWithImages(request: EnhancedContentRequest): Promise<any> {
    try {
      logger.info('🎨 Generating enhanced content with images...');
      
      // 1. Generate base content first
      const baseContent = await this.aiService.generateContent(request);
      
      // 2. Get relevant images if requested
      if (request.imageSettings?.includeImages) {
        logger.info('📸 Fetching images from Photo Gallery...');
        
        let images: PhotoGalleryImage[] = [];
        
        // Try to get real images from Photo Gallery
        if (request.imageSettings.imageSelection === 'folder' && request.imageSettings.specificFolder) {
          // Get images from specific folder
          logger.info(`📁 Fetching from folder: ${request.imageSettings.specificFolder}`);
          const result = await this.photoGalleryService.getFeaturedImages({
            limit: this.getImageLimit(request.imageSettings.maxImages),
            metadata: true
          });
          
          // Filter by folder if we get results
          images = result.images.filter(img => 
            img.folder_path.includes(request.imageSettings.specificFolder!)
          );
        } else {
          // Get images by topic/category
          images = await this.photoGalleryService.getImagesForTopic(
            request.topic,
            request.type === 'blog_post' ? 'blog' : 'social',
            this.getImageLimit(request.imageSettings.maxImages)
          );
        }
        
        // If no real images found, continue without images (real images only per user request)
        if (images.length === 0) {
          logger.warn('⚠️ No real images found, continuing without images (real images only)');
        }
        
        logger.info(`✅ Found ${images.length} images for content`);
        
        // 3. Enhance content with images
        if (images.length > 0 && request.type === 'blog_post') {
          baseContent.body = await this.insertImagesIntoContent(
            baseContent.body,
            images,
            request.imageSettings.maxImages === 'auto'
          );
          
          // Set featured image
          baseContent.metadata = {
            ...baseContent.metadata,
            featuredImage: images[0].full_image_url,
            galleryImages: images.map(img => ({
              url: img.full_image_url,
              thumbnailUrl: img.thumbnail_url,
              alt: img.metadata?.alt_text || `Image for ${request.topic}`,
              caption: img.metadata?.description || '',
              width: img.metadata?.width,
              height: img.metadata?.height
            }))
          };
        }
        
        // For social media, just add the first image
        if (images.length > 0 && request.type === 'social_media') {
          baseContent.metadata = {
            ...baseContent.metadata,
            featuredImage: images[0].full_image_url
          };
        }
      }
      
      return baseContent;
    } catch (error) {
      logger.error('Failed to generate content with images:', error);
      // Fall back to content without images
      return await this.aiService.generateContent(request);
    }
  }

  /**
   * Insert images into blog content at logical points
   */
  private async insertImagesIntoContent(
    content: string,
    images: PhotoGalleryImage[],
    autoMode: boolean = false
  ): Promise<string> {
    // 0. If content already contains [INSERT_IMAGE] placeholders, replace them directly in order
    if (content.includes('[INSERT_IMAGE]')) {
      let enhancedContent = content;
      images.forEach((image, index) => {
        const figureHtml = `\n<figure class=\"wp-block-image size-large\">\n  <img src=\"${image.full_image_url}\" alt=\"${image.metadata?.alt_text || `Image ${index + 1}`}\" class=\"wp-image-${Date.now() + index}\" />\n  ${image.metadata?.description ? `<figcaption class=\"wp-element-caption\">${image.metadata?.description}</figcaption>` : ''}\n</figure>\n`;
        enhancedContent = enhancedContent.replace('[INSERT_IMAGE]', figureHtml);
      });
      return enhancedContent;
    }

    if (autoMode) {
      // In auto mode, let AI decide where to place images
      logger.info('🤖 Using AI to determine image placement...');
      
      // Add placeholders for AI to replace
      const imageUrls = images.map(img => img.full_image_url);
      const placeholders = imageUrls.map((_, index) => `[INSERT_IMAGE_${index + 1}]`).join('\n');
      
      // Ask AI to insert placeholders at appropriate locations
      const enhancedPrompt = `
        Please insert these image placeholders at appropriate locations in the content:
        ${placeholders}
        
        Guidelines:
        - Place images after relevant paragraphs
        - Don't place images too close together
        - First image should be after introduction
        - Include proper HTML figure tags with captions
        
        Content to enhance:
        ${content}
      `;
      
      // This would need AI processing - for now, use simple placement
      return this.insertImagesAtCalculatedPoints(content, images);
    } else {
      // Use calculated insertion points
      return this.insertImagesAtCalculatedPoints(content, images);
    }
  }

  /**
   * Insert images at calculated points in content
   */
  private insertImagesAtCalculatedPoints(
    content: string,
    images: PhotoGalleryImage[]
  ): string {
    // Split content into paragraphs
    const paragraphs = content.split('</p>');
    
    if (paragraphs.length < 3 || images.length === 0) {
      return content;
    }
    
    let enhancedContent = '';
    const insertPoints = this.calculateImageInsertPoints(paragraphs.length, images.length);
    
    paragraphs.forEach((paragraph, index) => {
      enhancedContent += paragraph;
      
      if (index < paragraphs.length - 1) {
        enhancedContent += '</p>';
      }
      
      // Insert image at calculated points
      const imageIndex = insertPoints.indexOf(index);
      if (imageIndex !== -1 && images[imageIndex]) {
        const image = images[imageIndex];
        const altText = image.metadata?.alt_text || `Image ${imageIndex + 1}`;
        const caption = image.metadata?.description || '';
        
        enhancedContent += `
<figure class="wp-block-image size-large">
  <img src="${image.full_image_url}" alt="${altText}" class="wp-image-${Date.now() + imageIndex}" />
  ${caption ? `<figcaption class="wp-element-caption">${caption}</figcaption>` : ''}
</figure>
        `;
      }
    });
    
    return enhancedContent;
  }

  /**
   * Calculate optimal points to insert images in content
   */
  private calculateImageInsertPoints(
    paragraphCount: number,
    imageCount: number
  ): number[] {
    if (imageCount === 0 || paragraphCount < 3) return [];
    
    const points: number[] = [];
    const step = Math.floor(paragraphCount / (imageCount + 1));
    
    for (let i = 0; i < imageCount; i++) {
      const point = step * (i + 1) - 1;
      if (point < paragraphCount - 1) {
        points.push(point);
      }
    }
    
    return points;
  }

  /**
   * Get image limit as number
   */
  private getImageLimit(maxImages?: number | 'auto'): number {
    if (maxImages === 'auto') return 5; // Default for auto mode
    return maxImages || 3; // Default to 3 images
  }

  /**
   * Convert type to match different service expectations
   */
  private convertToHybridServiceType(type: IndexContentType | string): string {
    if (type === IndexContentType.BLOG_POST || type === 'blog_post') return 'blog_post';
    if (type === IndexContentType.SOCIAL_MEDIA || type === 'social_media') return 'social_media';
    if (type === IndexContentType.EMAIL || type === 'email') return 'email';
    if (type === IndexContentType.LANDING_PAGE || type === 'ad_copy') return 'ad_copy';
    return 'blog_post'; // default
  }

  /**
   * Check if type is blog post
   */
  private isBlogPostType(type: IndexContentType | string): boolean {
    return type === IndexContentType.BLOG_POST || type === 'blog_post';
  }

  /**
   * Check if type is social media
   */
  private isSocialMediaType(type: IndexContentType | string): boolean {
    return type === IndexContentType.SOCIAL_MEDIA || type === 'social_media';
  }

  /**
   * Get appropriate images for content based on settings
   */
  private async getImagesForContent(
    request: EnhancedContentRequest, 
    maxImages?: number
  ): Promise<GalleryImage[]> {
    const imageSettings = request.imageSettings!;
    const limit = maxImages || imageSettings.maxImages || 3;

    try {
      if (imageSettings.imageSelection === 'category') {
        // Use category-based selection
        const categorySlug = imageSettings.imageCategory || this.detectCategoryFromTopic(request.topic);
        logger.info(`🎯 Using category: ${categorySlug}`);
        
        const result = await this.photoGalleryService.getFeaturedImagesWithRetry({
          category: categorySlug,
          limit,
          priority: 'desc',
          metadata: true
        });
        
        // Convert PhotoGalleryImage[] to GalleryImage[] format
        return result.images.map((img): GalleryImage => ({
          id: img.id.toString(),
          source_key: img.source_key,
          relative_path: img.image_path,
          folder_name: img.folder_path,
          category: img.category?.slug || categorySlug,
          alt_text: img.metadata?.alt_text || `${request.topic} - Image ${img.id}`,
          description: img.metadata?.description || `Professional photography for ${request.topic}`,
          thumbnail_url: img.thumbnail_url,
          full_url: img.full_image_url,
          download_url: img.full_image_url,
          priority: img.priority_order,
          tags: [request.topic.toLowerCase()],
          wordpress_ready: true
        }));
        
      } else if (imageSettings.imageSelection === 'folder' && imageSettings.specificFolder) {
        // Get images from specific folder - use folder path matching
        const result = await this.photoGalleryService.getFeaturedImagesWithRetry({
          limit: limit * 2, // Get more to filter by folder
          priority: 'desc',
          metadata: true
        });
        
        // Filter by folder path
        const folderImages = result.images.filter(img => 
          img.folder_path && img.folder_path.includes(imageSettings.specificFolder!)
        ).slice(0, limit);
        
        // Convert to GalleryImage[] format
        return folderImages.map((img): GalleryImage => ({
          id: img.id.toString(),
          source_key: img.source_key,
          relative_path: img.image_path,
          folder_name: img.folder_path,
          category: img.category?.slug || 'wedding',
          alt_text: img.metadata?.alt_text || `${request.topic} - Image ${img.id}`,
          description: img.metadata?.description || `Professional photography for ${request.topic}`,
          thumbnail_url: img.thumbnail_url,
          full_url: img.full_image_url,
          download_url: img.full_image_url,
          priority: img.priority_order,
          tags: [request.topic.toLowerCase()],
          wordpress_ready: true
        }));
        
      } else if (imageSettings.imageSelection === 'manual' && imageSettings.selectedImages) {
        // Use manually selected images - convert to GalleryImage format
        return imageSettings.selectedImages.map((url, index): GalleryImage => ({
          id: `manual_${index}`,
          source_key: 'manual',
          relative_path: url,
          folder_name: 'manual_selection',
          category: 'manual',
          alt_text: `${request.topic} - Image ${index + 1}`,
          description: `Professional photography for ${request.topic}`,
          thumbnail_url: url,
          full_url: url,
          download_url: url,
          priority: index,
          tags: [request.topic.toLowerCase()],
          wordpress_ready: true
        }));
      }

      // Fallback to wedding category
      return await this.photoGalleryService.getFeaturedImages({
        categorySlug: 'wedding',
        limit,
        format: 'wordpress'
      });
      
    } catch (error) {
      logger.error('❌ Error getting images for content:', error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Detect category from topic content - moved from PhotoGalleryService
   */
  private detectCategoryFromTopic(topic: string): string {
    const topicLower = topic.toLowerCase();
    
    if (
      topicLower.includes('cưới') ||
      topicLower.includes('wedding') ||
      topicLower.includes('đám cưới')
    ) {
      return 'wedding';
    } else if (
      topicLower.includes('pre-wedding') ||
      topicLower.includes('prewedding')
    ) {
      return 'pre-wedding';
    } else if (topicLower.includes('kỷ yếu') && topicLower.includes('trường')) {
      return 'graduation-school';
    } else if (topicLower.includes('kỷ yếu') && topicLower.includes('concept')) {
      return 'graduation-concept';
    } else if (topicLower.includes('doanh nghiệp') || topicLower.includes('corporate')) {
      return 'corporate';
    } else if (topicLower.includes('ảnh thẻ') || topicLower.includes('profile')) {
      return 'id-photo';
    }
    
    return 'wedding'; // Default
  }

  /**
   * Convert GalleryImage[] to enhanced format
   */
  private convertGalleryImagesToEnhanced(images: GalleryImage[]): Array<{url: string; alt_text: string; caption?: string}> {
    return images.map(img => ({
      url: img.download_url || img.full_url,
      alt_text: img.alt_text,
      caption: img.description
    }));
  }

  /**
   * Download image and return local path
   */
  private async downloadImage(imageUrl: string, filename: string): Promise<string> {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');
    const path = require('path');
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, filename);
    
    return new Promise((resolve, reject) => {
      const client = imageUrl.startsWith('https:') ? https : http;
      
      client.get(imageUrl, (response: any) => {
        if (response.statusCode === 200) {
          const fileStream = fs.createWriteStream(filePath);
          response.pipe(fileStream);
          
          fileStream.on('finish', () => {
            fileStream.close();
            resolve(filePath);
          });
          
          fileStream.on('error', reject);
        } else {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
        }
      }).on('error', reject);
    });
  }

  /**
   * Download image with retry logic
   */
  private async downloadImageWithRetry(imageUrl: string, filename: string, retries = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.downloadImage(imageUrl, filename);
      } catch (error) {
        logger.warn(`Attempt ${i + 1} failed to download ${imageUrl}:`, error);
        if (i === retries - 1) throw error;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('All download attempts failed');
  }

  /**
   * Insert images into blog content at strategic points
   */
  private async insertImagesIntoBlogContent(
    content: IndexGeneratedContent | EnhancedGeneratedContent, 
    images: GalleryImage[]
  ): Promise<EnhancedGeneratedContent> {
    if (!images.length) {
      return {
        ...content,
        status: content.status as ContentStatus,
        metadata: content.metadata as EnhancedContentMetadata
      };
    }

    try {
      let enhancedBody = content.body;
      const contentSections = this.findContentSections(enhancedBody);
      
      // Insert images at strategic points
      if (contentSections.headings.length > 0) {
        // Insert after section headings
        for (let i = 0; i < Math.min(images.length, contentSections.headings.length); i++) {
          const image = images[i];
          const heading = contentSections.headings[i];
          const imageHtml = this.generateWordPressImageBlock({
            url: image.download_url || image.full_url,
            alt_text: image.alt_text,
            caption: image.description
          });
          
          enhancedBody = enhancedBody.replace(
            heading.match,
            heading.match + '\n\n' + imageHtml + '\n'
          );
        }
      } else {
        // Fallback: Insert after paragraphs
        const paragraphs = enhancedBody.split('\n\n');
        const insertPoints = Math.ceil(paragraphs.length / images.length);
        
        for (let i = 0; i < images.length; i++) {
          const insertIndex = (i + 1) * insertPoints;
          if (insertIndex < paragraphs.length) {
            const image = images[i];
            const imageHtml = this.generateWordPressImageBlock({
              url: image.download_url || image.full_url,
              alt_text: image.alt_text,
              caption: image.description
            });
            paragraphs.splice(insertIndex, 0, imageHtml);
          }
        }
        
        enhancedBody = paragraphs.join('\n\n');
      }

      return {
        ...content,
        body: enhancedBody,
        status: content.status as ContentStatus,
        metadata: {
          ...content.metadata,
          featuredImageAlt: images[0].alt_text,
          featuredImageCaption: images[0].description,
          galleryImages: this.convertGalleryImagesToEnhanced(images)
        } as EnhancedContentMetadata
      };

    } catch (error) {
      logger.error('❌ Error inserting images into content:', error);
      return {
        ...content,
        status: content.status as ContentStatus,
        metadata: content.metadata as EnhancedContentMetadata
      };
    }
  }

  /**
   * Find content structure for strategic image placement
   */
  private findContentSections(content: string): {
    headings: Array<{match: string; level: number; text: string}>;
    paragraphs: string[];
  } {
    const headings: Array<{match: string; level: number; text: string}> = [];
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    
    // Find headings (markdown format)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        match: match[0],
        level: match[1].length,
        text: match[2]
      });
    }
    
    return { headings, paragraphs };
  }

  /**
   * Generate WordPress image block HTML
   */
  private generateWordPressImageBlock(image: {url: string; alt_text: string; caption?: string}): string {
    return `<!-- wp:image {"className":"wp-image-auto"} -->
<figure class="wp-block-image wp-image-auto">
  <img src="${image.url}" alt="${image.alt_text}" />
  ${image.caption ? `<figcaption>${image.caption}</figcaption>` : ''}
</figure>
<!-- /wp:image -->`;
  }

  /**
   * Get content preview with image information
   */
  async getContentPreview(content: IndexGeneratedContent): Promise<{
    hasImages: boolean;
    hasFeaturedImage: boolean;
    hasGalleryImages: boolean;
    imageCount: number;
    preview: string;
  }> {
    const metadata = content.metadata as EnhancedContentMetadata;
    
    return {
      hasImages: !!(metadata?.featuredImageAlt || metadata?.galleryImages?.length),
      hasFeaturedImage: !!metadata?.featuredImageAlt,
      hasGalleryImages: !!metadata?.galleryImages?.length,
      imageCount: (metadata?.galleryImages?.length || 0) + (metadata?.featuredImageAlt ? 1 : 0),
      preview: content.body.substring(0, 200) + '...'
    };
  }

  /**
   * Generate featured image caption for WordPress
   */
  generateFeaturedImageCaption(content: IndexGeneratedContent): string {
    const metadata = content.metadata as EnhancedContentMetadata;
    return metadata?.featuredImageCaption || 
           metadata?.featuredImageAlt || 
           content.title;
  }

  /**
   * Extract gallery images for WordPress upload
   */
  extractGalleryImages(content: IndexGeneratedContent): Array<{url: string; alt_text: string; caption?: string}> {
    const metadata = content.metadata as EnhancedContentMetadata;
    
    if (metadata?.galleryImages && Array.isArray(metadata.galleryImages)) {
      return metadata.galleryImages.map(img => ({
        url: img.url,
        alt_text: img.alt_text,
        caption: img.caption
      }));
    }
    
    return [];
  }
} 