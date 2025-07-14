import { HybridAIService } from "./HybridAIService";
import { PhotoGalleryService, PhotoGalleryImage } from "./PhotoGalleryService";
import { logger } from "../utils/logger";
import { 
  ContentGenerationRequest,
  GeneratedContent,
  ContentType,
  ContentStatus,
} from "../types/index";

export class EnhancedContentService {
  private readonly aiService: HybridAIService;
  private readonly photoGalleryService: PhotoGalleryService;

  constructor() {
    this.aiService = new HybridAIService();
    this.photoGalleryService = new PhotoGalleryService();
  }

  public async generateContentWithImages(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      logger.info("🎨 Generating enhanced content with images...");
      
      const baseContent = await this.aiService.generateContent(request);
      
      if (!request.imageSettings?.includeImages) {
        logger.info('✅ Content generation complete (no images requested).');
        return baseContent;
      }

      logger.info("📸 Fetching images from Photo Gallery...");
      const images = await this.photoGalleryService.getImagesForTopic(
            request.topic,
        request.type === "blog_post" ? "blog" : "social",
        this.getImageLimit(request.imageSettings.maxImages),
        {
          ensureConsistency: request.imageSettings.ensureConsistency,
          ensureAlbumConsistency: request.imageSettings.ensureAlbumConsistency,
          imageCategory: request.imageSettings.imageCategory
        }
      );

        if (images.length === 0) {
        logger.warn("⚠️ No real images found, returning content without images.");
        return baseContent;
        }
        
      logger.info(`✅ Found ${images.length} images. Enhancing content...`);

      if (request.type === "blog_post") {
        baseContent.body = this.insertImagesIntoContent(baseContent.body, images, request);
          
        // Select featured image - prioritize landscape images
        const featuredImage = this.selectFeaturedImage(images, request);
        
        baseContent.metadata.featuredImage = featuredImage.full_image_url;
        baseContent.metadata.featuredImageAlt = featuredImage.metadata?.alt_text || request.topic;
        baseContent.metadata.featuredImageCaption = this.generateSmartCaption(featuredImage, request, featuredImage.metadata?.alt_text || request.topic);
        
        // Store all gallery images metadata
        baseContent.metadata.galleryImages = images.map(img => {
          const altText = img.metadata?.alt_text || request.topic;
          return {
            url: img.full_image_url,
            alt_text: altText,
            caption: this.generateSmartCaption(img, request, altText),
            is_featured: img.id === featuredImage.id
          };
        });

      } else if (request.type === "social_media") {
        // For social media, prefer portrait images
        const featuredImage = this.selectFeaturedImage(images, request, true);
        baseContent.metadata.featuredImage = featuredImage.full_image_url;
        }

      logger.info('✅ Content generation with images complete.');
      return baseContent;

    } catch (error) {
      logger.error("Failed to generate content with images:", error);
      throw error;
    }
  }

  private insertImagesIntoContent(
    content: string,
    images: PhotoGalleryImage[],
    request: ContentGenerationRequest
  ): string {
    logger.info(`Inserting ${images.length} images into content.`);

    // First, check if the content already has placeholders
    if (content.includes("[INSERT_IMAGE]")) {
      logger.info("Found [INSERT_IMAGE] placeholders. Replacing them.");
      let imageIndex = 0;
      const replacer = () => {
        if (imageIndex < images.length) {
          const image = images[imageIndex];
          const altText = image.metadata?.alt_text || request.topic;
          const caption = this.generateSmartCaption(image, request, altText);
          const figureHtml = this.createImageBlock(image.full_image_url, altText, caption);
          imageIndex++;
          return figureHtml;
        }
        return ''; 
      };
      return content.replace(/\[INSERT_IMAGE\]/g, replacer);
    }

    // --- Fallback Logic ---
    // If no placeholders, insert images at calculated points
    logger.info("No [INSERT_IMAGE] placeholders found. Calculating insertion points.");
    const paragraphs = content.split("\n\n").filter(p => p.trim() !== '');
    
    if (paragraphs.length < 2 || images.length === 0) {
      return content;
    }
    
    const imageCount = Math.min(images.length, paragraphs.length -1);
    const insertInterval = Math.floor(paragraphs.length / (imageCount + 1));
    
    let imageIndex = 0;
    const newParagraphs = paragraphs.reduce((acc, paragraph, index) => {
      acc.push(paragraph);
      // Insert an image after this paragraph if it's an interval point
      if ((index + 1) % insertInterval === 0 && imageIndex < imageCount) {
        const image = images[imageIndex];
        const altText = image.metadata?.alt_text || request.topic;
        const caption = this.generateSmartCaption(image, request, altText);
        const figureHtml = this.createImageBlock(image.full_image_url, altText, caption);
        acc.push(figureHtml);
        imageIndex++;
      }
      return acc;
    }, []);

    return newParagraphs.join("\n\n");
  }

  private createImageBlock(url: string, alt: string, caption: string): string {
    return `
<figure class="wp-block-image size-large">
<img src="${url}" alt="${alt}" class="wp-image-auto" />
  ${caption ? `<figcaption class="wp-element-caption">${caption}</figcaption>` : ''}
</figure>`;
      }

  private generateSmartCaption(
    image: PhotoGalleryImage,
    request: ContentGenerationRequest,
    altText: string
  ): string {
    const { brandVoice, topic, language = "english", imageSettings } = request;
    const brandName = brandVoice?.brandName;
    const imageCategory = imageSettings?.imageCategory;
        
    const originalCaption = image.metadata?.description;
    if (originalCaption && originalCaption.trim().toLowerCase() !== topic.toLowerCase()) {
      return originalCaption;
    }
    
    let caption = '';
    if (language === "vietnamese") {
      caption = brandName ? `Nghệ thuật nhiếp ảnh chuyên nghiệp từ ${brandName}` : `Hình ảnh chuyên nghiệp về ${topic}`;
      if(imageCategory === "wedding") caption = `Khoảnh khắc đám cưới tuyệt vời, thực hiện bởi ${brandName || 'chúng tôi'}.`;
        } else {
      caption = brandName ? `Professional photography by ${brandName}` : `A professional image of ${topic}`;
      if(imageCategory === "wedding") caption = `A beautiful wedding moment, captured by ${brandName || 'us'}.`;
    }
    
    return caption || altText;
      }

  private getImageLimit(maxImages?: number | "auto"): number {
    if (maxImages === "auto") return 5;
    return maxImages || 3;
  }

  /**
   * Select the best featured image based on criteria - ENHANCED with stricter landscape preference
   */
  private selectFeaturedImage(
    images: PhotoGalleryImage[], 
    request: ContentGenerationRequest,
    preferPortrait: boolean = false
  ): PhotoGalleryImage {
    if (images.length === 0) {
      throw new Error("No images available to select featured image");
    }

    logger.info(`🎯 Selecting featured image from ${images.length} candidates (preferPortrait: ${preferPortrait})`);

    // ENHANCED: Sort images with ULTRA-AGGRESSIVE landscape preference for blog posts
    const sortedImages = [...images].sort((a, b) => {
      if (preferPortrait) {
        // For social media - prefer portrait
        if (a.featured_type === 'portrait' && b.featured_type !== 'portrait') return -1;
        if (a.featured_type !== 'portrait' && b.featured_type === 'portrait') return 1;
      } else {
        // For blog posts - ULTRA-AGGRESSIVE landscape preference
        const aIsLandscape = this.isLandscapeImage(a);
        const bIsLandscape = this.isLandscapeImage(b);
        
        // Log detailed comparison for debugging
        logger.info(`🔍 Comparing images:`, {
          imageA: {
            path: a.image_path,
            type: a.featured_type,
            isLandscape: aIsLandscape,
            aspectRatio: a.metadata?.aspect_ratio || 'unknown',
            priority: a.priority_order
          },
          imageB: {
            path: b.image_path,
            type: b.featured_type,
            isLandscape: bIsLandscape,
            aspectRatio: b.metadata?.aspect_ratio || 'unknown',
            priority: b.priority_order
          }
        });
      
        // HIGHEST PRIORITY: True landscape images (aspect_ratio > 1.0)
        if (aIsLandscape && !bIsLandscape) {
          logger.info(`✅ A wins: landscape vs non-landscape`);
          return -1;
        }
        if (!aIsLandscape && bIsLandscape) {
          logger.info(`✅ B wins: landscape vs non-landscape`);
          return 1;
        }
        
        // Among landscape images, prefer higher aspect ratios (wider images)
        if (aIsLandscape && bIsLandscape) {
          const aRatio = a.metadata?.aspect_ratio || 1.0;
          const bRatio = b.metadata?.aspect_ratio || 1.0;
          
          if (Math.abs(aRatio - bRatio) > 0.1) { // Significant difference
            logger.info(`📏 Comparing aspect ratios: ${aRatio.toFixed(2)} vs ${bRatio.toFixed(2)}`);
            return bRatio - aRatio; // Higher aspect ratio first
          }
          
          // If similar aspect ratios, prefer 'featured' type
          if (a.featured_type === 'featured' && b.featured_type !== 'featured') {
            logger.info(`✅ A wins: featured type among landscapes`);
            return -1;
          }
          if (a.featured_type !== 'featured' && b.featured_type === 'featured') {
            logger.info(`✅ B wins: featured type among landscapes`);
            return 1;
          }
        }
        
        // If both are portrait or unknown orientation, strongly prefer 'featured' type
        if (!aIsLandscape && !bIsLandscape) {
          if (a.featured_type === 'featured' && b.featured_type !== 'featured') {
            logger.info(`✅ A wins: featured type among non-landscapes`);
            return -1;
          }
          if (a.featured_type !== 'featured' && b.featured_type === 'featured') {
            logger.info(`✅ B wins: featured type among non-landscapes`);
            return 1;
          }
        }
      }

      // Finally sort by priority order (lower number = higher priority)
      return a.priority_order - b.priority_order;
    });

    const selected = sortedImages[0];
    const isLandscape = this.isLandscapeImage(selected);
    const aspectRatio = selected.metadata?.aspect_ratio || 'unknown';
    
    logger.info(`📷 SELECTED featured image:`, {
      path: selected.image_path,
      type: selected.featured_type,
      isLandscape,
      aspectRatio: typeof aspectRatio === 'number' ? aspectRatio.toFixed(2) : aspectRatio,
      priority: selected.priority_order,
      dimensions: selected.metadata ? `${selected.metadata.width}x${selected.metadata.height}` : 'unknown'
    });
    
    // Validate selection for blog posts
    if (!preferPortrait && !isLandscape) {
      logger.warn(`⚠️ WARNING: Selected image is NOT landscape for blog post! This may affect thumbnail appearance.`);
      
      // Try to find ANY landscape image as backup
      const landscapeBackup = sortedImages.find(img => this.isLandscapeImage(img));
      if (landscapeBackup) {
        logger.info(`🔄 SWITCHING to landscape backup:`, {
          path: landscapeBackup.image_path,
          type: landscapeBackup.featured_type,
          aspectRatio: landscapeBackup.metadata?.aspect_ratio || 'unknown'
        });
        return landscapeBackup;
      }
    }
    
    return selected;
  }

  /**
   * Determine if image is landscape based on metadata or type - ENHANCED detection
   */
  private isLandscapeImage(image: PhotoGalleryImage): boolean {
    // PRIORITY 1: Check metadata aspect ratio first (most accurate)
    if (image.metadata?.aspect_ratio) {
      const isLandscape = image.metadata.aspect_ratio > 1.0;
      logger.info(`🔍 Aspect ratio check: ${image.metadata.aspect_ratio.toFixed(2)} → ${isLandscape ? 'LANDSCAPE' : 'portrait'} (${image.image_path})`);
      return isLandscape;
    }
    
    // PRIORITY 2: Check width vs height from metadata
    if (image.metadata?.width && image.metadata?.height) {
      const isLandscape = image.metadata.width > image.metadata.height;
      const aspectRatio = (image.metadata.width / image.metadata.height).toFixed(2);
      logger.info(`🔍 Dimension check: ${image.metadata.width}x${image.metadata.height} (${aspectRatio}) → ${isLandscape ? 'LANDSCAPE' : 'portrait'} (${image.image_path})`);
      return isLandscape;
    }

    // PRIORITY 3: Check file path/name for orientation indicators
    const imagePath = image.image_path?.toLowerCase() || '';
    const folderPath = image.folder_path?.toLowerCase() || '';
    const pathContent = `${imagePath} ${folderPath}`;
    
    // Strong landscape indicators
    const landscapeKeywords = ['landscape', 'wide', 'horizontal', 'panorama', 'banner'];
    const portraitKeywords = ['portrait', 'vertical', 'upright'];
    
    const hasLandscapeKeywords = landscapeKeywords.some(keyword => pathContent.includes(keyword));
    const hasPortraitKeywords = portraitKeywords.some(keyword => pathContent.includes(keyword));
    
    if (hasLandscapeKeywords && !hasPortraitKeywords) {
      logger.info(`🔍 Path keyword check: Found landscape keywords → LANDSCAPE (${image.image_path})`);
      return true;
    }
    
    if (hasPortraitKeywords && !hasLandscapeKeywords) {
      logger.info(`🔍 Path keyword check: Found portrait keywords → portrait (${image.image_path})`);
      return false;
    }

    // PRIORITY 4: Type-based fallback with enhanced logic
    if (image.featured_type === 'featured') {
      // 'featured' type is typically landscape for blog thumbnails
      logger.info(`🔍 Type fallback: 'featured' type → LANDSCAPE (${image.image_path})`);
      return true;
    }
    
    if (image.featured_type === 'portrait') {
      // 'portrait' type is explicitly portrait
      logger.info(`🔍 Type fallback: 'portrait' type → portrait (${image.image_path})`);
      return false;
    }

    // FINAL FALLBACK: Unknown orientation, assume landscape for blog posts
    logger.warn(`⚠️ Unknown orientation, assuming LANDSCAPE for blog compatibility (${image.image_path})`);
    return true;
  }

  // ... other helper functions can be removed if they are not used anymore ...
}
