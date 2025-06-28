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
          imageCategory: request.imageSettings.imageCategory
        }
      );

        if (images.length === 0) {
        logger.warn("⚠️ No real images found, returning content without images.");
        return baseContent;
      }
      
      logger.info(`✅ Found ${images.length} images. Enhancing content...`);

      // Select featured image before modifying the content body
      const featuredImage = this.selectFeaturedImage(images, request.type);
      if (featuredImage) {
        baseContent.metadata.featuredImage = featuredImage.full_image_url;
      }

      if (request.type === "blog_post") {
        baseContent.body = this.insertImagesIntoContent(baseContent.body, images, request);
        
        baseContent.metadata.galleryImages = images.map(img => {
          const altText = img.metadata?.alt_text || request.topic;
          return {
            url: img.full_image_url,
            alt_text: altText,
            caption: this.generateSmartCaption(img, request, altText),
            width: img.metadata?.width,
            height: img.metadata?.height
          };
        });

      } else if (request.type === "social_media") {
        // For social media, we just set the featured image, no insertion
      }

      logger.info('✅ Content generation with images complete.');
      return baseContent;

    } catch (error) {
      logger.error("Failed to generate content with images:", { error });
      const fallbackContent = await this.aiService.generateContent(request);
      logger.warn('Returning content without images due to error.');
      return fallbackContent;
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
   * Selects a featured image based on specific criteria.
   * - Prefers horizontal images from the provided list.
   * - Falls back to fetching a new horizontal image if none are found.
   */
  private selectFeaturedImage(
    images: PhotoGalleryImage[],
    contentType: 'blog_post' | 'social_media' | 'email' | 'ad_copy'
  ): PhotoGalleryImage | undefined {
    if (!images || images.length === 0) {
      return undefined;
    }

    // Find horizontal images (landscape)
    const horizontalImages = images.filter(
      (img) => (img.metadata?.width ?? 0) > (img.metadata?.height ?? 0)
    );

    if (horizontalImages.length > 0) {
      // Return a random horizontal image from the list
      const randomIndex = Math.floor(Math.random() * horizontalImages.length);
      logger.info(`✅ Selected a random horizontal featured image from the existing list.`);
      return horizontalImages[randomIndex];
    }

    // Fallback for blog posts: if no horizontal images, just pick the first one.
    // We avoid fetching new images to prevent surprises in the post body.
    if (contentType === "blog_post" && images.length > 0) {
      logger.warn(`⚠️ No horizontal images found in the list for blog post. Falling back to the first image.`);
      return images[0];
    }
    
    // For other content types, we can just return the first image as well.
    // A specific fetch for a horizontal image could be added here if needed for social media.
    logger.warn(`⚠️ No horizontal images found. Using the first available image as featured image.`);
    return images[0];
  }

  // ... other helper functions can be removed if they are not used anymore ...
}
