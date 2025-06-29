import { Request, Response } from "express";
import { LinkBasedContentService, CreateBatchJobRequest } from "../services/LinkBasedContentService";
import { WebScrapingService } from "../services/WebScrapingService";
import { PhotoGalleryService } from "../services/PhotoGalleryService";
import { EnhancedContentService } from "../services/EnhancedContentService";
import { asyncHandler } from "../utils/asyncHandler";
import { logger } from "../utils/logger";
import type { BrandVoiceConfig } from "../types";
import { ContentGenerationRequest } from "../types/index";
import { ContentType } from "../types/index";

/**
 * Controller for Link-Based Content Generation
 */
export class LinkContentController {
  private readonly linkContentService: LinkBasedContentService;
  private readonly webScrapingService: WebScrapingService;
  private readonly photoGalleryService: PhotoGalleryService;
  private readonly enhancedContentService: EnhancedContentService;

  constructor() {
    this.linkContentService = new LinkBasedContentService();
    this.webScrapingService = new WebScrapingService();
    this.photoGalleryService = new PhotoGalleryService();
    this.enhancedContentService = new EnhancedContentService();
  }

  /**
   * Create a new batch job for link-based content generation
   * POST /api/v1/link-content/batch
   */
  createBatchJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId, urls, settings } = req.body;

    // Validate input
    if (!projectId || !Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: projectId and urls",
        },
      });
      return;
    }

    if (!settings?.contentType || !settings.brandVoice) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing content settings",
        },
      });
      return;
    }

    try {
      const request: CreateBatchJobRequest = {
        projectId,
        urls: urls.filter((url: string) => url && url.trim()),
        settings: {
          contentType: settings.contentType,
          brandVoice: settings.brandVoice as BrandVoiceConfig,
          targetAudience: settings.targetAudience || "General audience",
          preferredProvider: settings.preferredProvider || "auto",
        },
      };

      const batchJob = await this.linkContentService.createBatchJob(request);

      logger.info(`Created batch job ${batchJob.id} for project ${projectId}`);

      res.status(201).json({
        success: true,
        data: batchJob,
        message: "Batch job created successfully",
      });

    } catch (error) {
      logger.error("Error creating batch job:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create batch job",
        },
      });
    }
  });

  /**
   * Get batch job status with items
   * GET /api/v1/link-content/batch/:jobId
   */
  getBatchJobStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Job ID is required",
        },
      });
      return;
    }

    try {
      const status = await this.linkContentService.getBatchJobStatus(jobId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Batch job not found",
          },
        });
        return;
      }

      res.json({
        success: true,
        data: status,
        message: "Batch job status retrieved successfully",
      });

    } catch (error) {
      logger.error("Error getting batch job status:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get batch job status",
        },
      });
    }
  });

  /**
   * Start crawling URLs in a batch job
   * POST /api/v1/link-content/batch/:jobId/crawl
   */
  startCrawling = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Job ID is required",
        },
      });
      return;
    }

    try {
      // Start crawling asynchronously
      this.linkContentService.startCrawling(jobId).catch(error => {
        logger.error(`Crawling failed for batch job ${jobId}:`, error);
      });

      res.json({
        success: true,
        message: "Crawling started successfully",
      });

    } catch (error) {
      logger.error("Error starting crawling:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to start crawling",
        },
      });
    }
  });

  /**
   * Generate AI content for batch job
   * POST /api/v1/link-content/batch/:jobId/generate
   */
  generateContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Job ID is required",
        },
      });
      return;
    }

    try {
      // Start generation asynchronously
      this.linkContentService.generateContent(jobId).catch(error => {
        logger.error(`Content generation failed for batch job ${jobId}:`, error);
      });

      res.json({
        success: true,
        message: "Content generation started successfully",
      });

    } catch (error) {
      logger.error("Error starting content generation:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to start content generation",
        },
      });
    }
  });

  /**
   * Generate AI content for batch job with enhanced settings
   * POST /api/v1/link-content/batch/:jobId/generate-content
   */
  generateBatchContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;
    const { settings } = req.body;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Job ID is required",
        },
      });
      return;
    }

    if (!settings) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Content generation settings are required",
        },
      });
      return;
    }

    try {
      // Validate settings structure
      const requiredFields = ["contentType", "brandVoice", "targetAudience"];
      for (const field of requiredFields) {
        if (!settings[field]) {
          res.status(400).json({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: `Missing required setting: ${field}`,
            },
          });
          return;
        }
      }

      // Start enhanced content generation asynchronously
      this.linkContentService.generateBatchContentWithSettings(jobId, settings).catch(error => {
        logger.error(`Enhanced content generation failed for batch job ${jobId}:`, error);
      });

      res.json({
        success: true,
        message: "Enhanced content generation started successfully",
      });

    } catch (error) {
      logger.error("Error starting enhanced content generation:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to start enhanced content generation",
        },
      });
    }
  });

  /**
   * Approve a content item
   * POST /api/v1/link-content/batch/:jobId/items/:itemId/approve
   */
  approveContentItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId, itemId } = req.params;

    if (!jobId || !itemId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Job ID and Item ID are required",
        },
      });
      return;
    }

    try {
      await this.linkContentService.approveContentItem(jobId, itemId);

      res.json({
        success: true,
        message: "Content item approved successfully",
      });

    } catch (error) {
      logger.error("Error approving content item:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to approve content item",
        },
      });
    }
  });

  /**
   * Regenerate content for a specific item
   * POST /api/v1/link-content/batch/:jobId/items/:itemId/regenerate
   */
  regenerateContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId, itemId } = req.params;

    if (!jobId || !itemId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Job ID and Item ID are required",
        },
      });
      return;
    }

    try {
      // Start regeneration asynchronously
      this.linkContentService.regenerateContent(jobId, itemId).catch(error => {
        logger.error(`Content regeneration failed for item ${itemId}:`, error);
      });

      res.json({
        success: true,
        message: "Content regeneration started successfully",
      });

    } catch (error) {
      logger.error("Error starting content regeneration:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to start content regeneration",
        },
      });
    }
  });

  /**
   * Get approved content items ready for publishing
   * GET /api/v1/link-content/batch/:jobId/approved
   */
  getApprovedContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Job ID is required",
        },
      });
      return;
    }

    try {
      const approvedItems = await this.linkContentService.getApprovedContent(jobId);

      res.json({
        success: true,
        data: {
          items: approvedItems,
          count: approvedItems.length,
        },
        message: "Approved content retrieved successfully",
      });

    } catch (error) {
      logger.error("Error getting approved content:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get approved content",
        },
      });
    }
  });

  /**
   * Test scraping a single URL (for testing purposes)
   * POST /api/v1/link-content/test-scrape
   */
  testScrape = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "URL is required",
        },
      });
      return;
    }

    try {
      logger.info(`Testing scrape for URL: ${url}`);
      
      const results = await this.webScrapingService.scrapeUrls([url]);
      const result = results[0];

      if (!result) {
        res.status(400).json({
          success: false,
          error: {
            code: "SCRAPING_FAILED",
            message: "Failed to scrape URL",
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          url: result.url,
          title: result.title,
          content: result.content,
          wordCount: result.metadata?.wordCount || result.content.split(" ").length,
          qualityScore: result.qualityScore,
          metadata: result.metadata,
          scrapedAt: result.scrapedAt,
        },
        message: "URL scraped successfully",
      });

    } catch (error) {
      logger.error("Error testing scrape:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SCRAPING_ERROR",
          message: error instanceof Error ? error.message : "Scraping failed",
        },
      });
    }
  });

  /**
   * Health check for link content service
   * GET /api/v1/link-content/health
   */
  healthCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const isHealthy = await this.linkContentService.healthCheck();
      
      res.json({
        success: true,
        data: {
          status: isHealthy ? "healthy" : "unhealthy",
          service: "LinkBasedContentService",
          timestamp: new Date().toISOString(),
        },
        message: "Health check completed",
      });

    } catch (error) {
      logger.error("Health check failed:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "HEALTH_CHECK_FAILED",
          message: "Service health check failed",
        },
      });
    }
  });

  /**
   * Get available image categories from Photo Gallery
   * GET /api/v1/link-content/image-categories
   */
  getImageCategories = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const categoriesRaw = await this.photoGalleryService.getCategories(true);
      const categories = categoriesRaw.map((c: any) => ({
        id: c.id || c.category_slug || c.slug || c.key || c.id,
        category_name: c.category_name || c.name,
        category_slug: c.category_slug || c.id || c.slug,
        description: c.description || "",
        color_code: c.color_code || "#6B7280",
        folder_count: c.folder_count || 0,
      }));
      
      res.json({
        success: true,
        data: { categories },
        message: "Image categories retrieved successfully",
      });
    } catch (error) {
      logger.error("Failed to get image categories:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "GALLERY_ERROR",
          message: "Failed to retrieve image categories",
        },
      });
    }
  });

  /**
   * Get folders by category
   * GET /api/v1/link-content/image-folders/:categorySlug
   */
  getImageFolders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { categorySlug } = req.params;
    
    if (!categorySlug) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Category slug is required",
        },
      });
      return;
    }

    try {
      const folders = await this.photoGalleryService.getFoldersByCategory(categorySlug);
      
      res.json({
        success: true,
        data: { folders },
        message: "Image folders retrieved successfully",
      });
    } catch (error) {
      logger.error("Failed to get image folders:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "GALLERY_ERROR",
          message: "Failed to retrieve image folders",
        },
      });
    }
  });

  /**
   * Preview images from a folder or category
   * GET /api/v1/link-content/preview-images
   */
  previewImages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { categorySlug, folderName, limit = "5" } = req.query as { [key: string]: string };
    
    try {
      // Fetch images by category (if provided) - use retry with mock fallback
      const result = await this.photoGalleryService.getFeaturedImagesWithRetry({
        category: categorySlug || undefined,
        limit: parseInt(limit, 10),
        metadata: true,
        priority: "desc",
        maxRetries: 1,
      });

      let images = result.images;

      // Optional folder filtering (client-side) if folderName is provided
      if (folderName) {
        images = images.filter(img => img.folder_path?.toLowerCase().includes(folderName.toLowerCase()));
      }
      
      logger.info(`📸 Preview images: ${images.length} images returned for category="${categorySlug}"`);
      
      res.json({
        success: true,
        data: { images },
        message: "Preview images retrieved successfully",
      });
    } catch (error) {
      logger.error("Failed to preview images:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "GALLERY_ERROR",
          message: "Failed to retrieve preview images",
        },
      });
    }
  });

  /**
   * Generate content with image integration
   * POST /api/v1/link-content/generate-enhanced
   */
  generateEnhancedContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sourceContent, settings } = req.body;
    
    if (!sourceContent || !settings) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Source content and settings are required",
        },
      });
      return;
    }

    try {
      // Convert frontend format to EnhancedContentRequest format
      const request: ContentGenerationRequest = {
        type: settings.contentType === "wordpress_blog" ? "blog_post" : "social_media",
        topic: sourceContent.title || "Content Topic",
        context: sourceContent.content,
        targetAudience: settings.targetAudience || "General audience",
        keywords: settings.keywords ? settings.keywords.split(",").map((k: string) => k.trim()) : [],
        brandVoice: {
          tone: settings.tone || "professional",
          style: "conversational",
          vocabulary: "advanced",
          length: "comprehensive",
          brandName: settings.brandName || "Your Brand",
        },
        preferredProvider: settings.preferredProvider || "auto",
        imageSettings: settings.includeImages ? {
          includeImages: true,
          imageSelection: settings.imageSelection,
          imageCategory: settings.imageCategory,
          specificFolder: settings.specificFolder,
          maxImages: settings.maxImages || 3,
          ensureConsistency: settings.ensureConsistency || false,
        } : { includeImages: false },
        language: settings.language || "vietnamese",
        specialInstructions: settings.specialRequest || "",
      };

      logger.info("🎨 Starting enhanced content generation with images", {
        topic: request.topic,
        includeImages: request.imageSettings?.includeImages,
        imageSelection: request.imageSettings?.imageSelection,
        imageCategory: request.imageSettings?.imageCategory,
      });
      
      const enhancedContent = await this.enhancedContentService.generateContentWithImages(request);
      
      // Log the result to check if images were added
      logger.info("✅ Enhanced content generated", {
        hasMetadata: !!enhancedContent.metadata,
        hasFeaturedImage: !!enhancedContent.metadata?.featuredImage,
        galleryImagesCount: enhancedContent.metadata?.galleryImages?.length || 0,
      });
      
      res.json({
        success: true,
        data: enhancedContent,
        enhanced: true,
        withImages: !!enhancedContent.metadata?.featuredImage,
        message: "Enhanced content generated successfully",
      });
    } catch (error) {
      logger.error("Failed to generate enhanced content:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "GENERATION_ERROR",
          message: "Failed to generate enhanced content",
        },
      });
    }
  });

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.linkContentService.cleanup();
    await this.webScrapingService.close();
  }
} 
