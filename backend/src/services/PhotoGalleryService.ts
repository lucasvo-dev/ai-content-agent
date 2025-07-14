import axios from "axios";
import { logger } from "../utils/logger";
import { ImageUsageTrackingService } from "./ImageUsageTrackingService";

export interface PhotoGalleryImage {
  id: number;
  source_key: string;
  image_path: string;
  folder_path: string;
  featured_type: string;
  priority_order: number;
  thumbnail_url: string;
  full_image_url: string;
  category?: {
    name: string;
    slug: string;
    color: string;
    icon: string;
  };
  metadata?: {
    filename: string;
    filesize: number;
    modified_date: string;
    alt_text: string;
    description: string;
    created_at: string;
    width: number;
    height: number;
    aspect_ratio: number;
  };
}

export interface PhotoGalleryCategory {
  id: number;
  category_name: string;
  category_slug: string;
  description: string;
  color_code: string;
  icon_class: string;
  sort_order: number;
  created_at: string;
  folder_count?: number;
  featured_images?: {
    total: number;
    featured: number;
    portrait: number;
  };
}

export interface PhotoGalleryConfig {
  apiUrl: string;
  authToken?: string;
}

export class PhotoGalleryService {
  private readonly config: PhotoGalleryConfig;
  private readonly axios: any;
  private readonly usageTracker: ImageUsageTrackingService;

  constructor(config?: PhotoGalleryConfig) {
    this.config = config || {
      apiUrl: process.env.PHOTO_GALLERY_API_URL || "https://photo.guustudio.vn/api.php",
    };

    this.axios = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000,
      headers: {
        "User-Agent": "AI-Content-Agent/1.0",
        "Accept": "application/json",
      },
    });
    
    this.usageTracker = new ImageUsageTrackingService();
  }

  /**
   * Ensure URL is absolute. The Gallery API often returns paths like "/api.php?...".
   */
  private makeAbsolute(url?: string): string {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    // Remove trailing "/api.php" from base if present
    const base = this.config.apiUrl.replace(/\/api\.php$/i, "");
    // Ensure there is no double slash
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  /**
   * Get available categories from photo gallery
   */
  async getCategories(includeStats: boolean = false): Promise<PhotoGalleryCategory[]> {
    try {
      const response = await this.axios.get("", {
        params: {
          action: "ai_get_categories",
          stats: includeStats,
        },
      });

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to fetch categories");
      }

      return response.data.categories;
    } catch (error) {
      logger.error("Failed to fetch gallery categories:", error);
      throw error;
    }
  }

  /**
   * Get featured images by category for content integration
   */
  async getFeaturedImages(options: {
    category?: string;
    type?: "featured" | "portrait";
    source?: string;
    limit?: number;
    priority?: "asc" | "desc";
    metadata?: boolean;
  } = {}): Promise<{
    images: PhotoGalleryImage[];
    total_found: number;
    available_categories: PhotoGalleryCategory[];
  }> {
    try {
      const params: any = {
        action: "ai_get_featured_images",
        limit: options.limit || 10,
        priority: options.priority || "desc", // Photo Gallery team recommends desc for best quality
        metadata: options.metadata !== false ? "true" : "false",
      };

      // Only add optional params if they exist
      if (options.category) params.category = options.category;
      if (options.type) params.type = options.type;
      if (options.source) params.source = options.source;

      logger.info("🔍 Fetching featured images from Photo Gallery", { params });

      const response = await this.axios.get("", { params });

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to fetch featured images");
      }

      // If no images found and no source specified, try all available sources
      if (response.data.images?.length === 0 && !options.source && response.data.available_sources?.length > 0) {
        logger.info("🔄 No images found, trying all available sources...");
        
        for (const source of response.data.available_sources) {
          logger.info(`🔍 Trying source: ${source.key} (${source.name})`);
          
          const sourceParams = { ...params, source: source.key };
          const sourceResponse = await this.axios.get("", { params: sourceParams });
          
          if (sourceResponse.data.success && sourceResponse.data.images?.length > 0) {
            logger.info(`✅ Found ${sourceResponse.data.images.length} images in source: ${source.key}`);
            response.data = sourceResponse.data;
            break;
          }
        }
      }

      // Photo Gallery team ensures only 750px cached thumbnails are returned
      // If we get fewer images than requested, the system is generating cache in background
      const images = (response.data.images || []).map((img: any) => {
        const thumb = this.makeAbsolute(img.thumbnail_url);
        const full = this.makeAbsolute(img.full_image_url);
        return {
          ...img,
          thumbnail_url: thumb,
          full_image_url: full,
          // Always use thumbnail_url as it's guaranteed 750px by Photo Gallery team
          preferred_url: thumb,
        };
      });

      // Log if we got fewer images than requested (cache building in progress)
      if (images.length < (options.limit || 10)) {
        logger.info(`📸 Received ${images.length}/${options.limit || 10} images - cache building in progress`);
      }

      return {
        images,
        total_found: response.data.total_found || 0,
        available_categories: response.data.available_categories || [],
      };
    } catch (error) {
      logger.error("Failed to fetch featured images:", error);
      throw error;
    }
  }

  /**
   * Get featured images with retry logic for cache building
   */
  async getFeaturedImagesWithRetry(options: {
    category?: string;
    type?: "featured" | "portrait";
    source?: string;
    limit?: number;
    priority?: "asc" | "desc";
    metadata?: boolean;
    maxRetries?: number;
  } = {}): Promise<{
    images: PhotoGalleryImage[];
    total_found: number;
    available_categories: PhotoGalleryCategory[];
  }> {
    const maxRetries = options.maxRetries || 2;
    const requestedLimit = options.limit || 10;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.getFeaturedImages(options);
      
      // If we got enough images or this is the last attempt, return
      if (result.images.length >= requestedLimit || attempt === maxRetries) {
        // Only return real images - no mock fallback
        if (result.images.length === 0) {
          logger.warn("📸 No real images available from Photo Gallery API");
        }
        return result;
      }
      
      // Wait before retry (5-10 seconds as recommended)
      const waitTime = Math.min(5000 + (attempt * 2000), 10000);
      logger.info(`🔄 Retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // This shouldn't be reached, but TypeScript needs it
    return { images: [], total_found: 0, available_categories: [] };
  }

  /**
   * Generate mock images when real API has no data
   */
  private generateMockImages(category: string, limit: number): PhotoGalleryImage[] {
    const mockImages: PhotoGalleryImage[] = [];
    const mockFolders = this.generateMockFolders(category);
    const selectedFolder = mockFolders[0] || `${category} Collection`;
    
    for (let i = 0; i < limit; i++) {
      const seed = `${category}-${i}`;
      const imageUrl = `https://picsum.photos/750/500?random=${seed}`;
      
      mockImages.push({
        id: i + 1,
        source_key: "mock",
        image_path: `${selectedFolder}/image_${i + 1}.jpg`,
        folder_path: selectedFolder,
        featured_type: "featured",
        priority_order: i,
        thumbnail_url: imageUrl,
        full_image_url: imageUrl,
        category: {
          name: category.charAt(0).toUpperCase() + category.slice(1),
          slug: category,
          color: "#EF4444",
          icon: "fas fa-image",
        },
      });
    }
    
    return mockImages;
  }

  /**
   * Get best matching images for content topic with randomization
   */
  async getImagesForTopic(
    topic: string,
    contentType: "blog" | "social" = "blog",
    limit: number = 5,
    options: {
      ensureConsistency?: boolean;
      ensureAlbumConsistency?: boolean;
      imageCategory?: string;
    } = {}
  ): Promise<PhotoGalleryImage[]> {
    try {
      // Use provided category or detect from topic
      let categorySlug = options.imageCategory || "";
      
      if (!categorySlug) {
      const topicLower = topic.toLowerCase();
        if (topicLower.includes("cưới") || topicLower.includes("wedding") || topicLower.includes("đám cưới")) {
          categorySlug = "wedding";
        } else if (topicLower.includes("pre-wedding") || topicLower.includes("prewedding")) {
          categorySlug = "pre-wedding";
        } else if (topicLower.includes("kỷ yếu") || topicLower.includes("graduation") || topicLower.includes("yearbook")) {
          categorySlug = "graduation";
        } else if (topicLower.includes("doanh nghiệp") || topicLower.includes("corporate") || topicLower.includes("công ty")) {
          categorySlug = "corporate";
        } else if (topicLower.includes("ảnh thẻ") || topicLower.includes("id photo") || topicLower.includes("profile")) {
          categorySlug = "id-photo";
        }
      }

      // Get more images than needed to have variety
      const fetchLimit = Math.max(limit * 3, 20);
      
      // ENHANCED: For blog posts, try to get both featured AND portrait images for better selection
      let result;
      if (contentType === "blog") {
        // For blog posts, get BOTH types and let the selection logic pick the best landscape
        logger.info(`🎯 Getting MIXED image types for better landscape selection (category: ${categorySlug || "all"})`);
        
        const featuredResult = await this.getFeaturedImages({
          category: categorySlug || undefined,
          type: "featured",
          limit: Math.ceil(fetchLimit * 0.7), // 70% featured
          priority: "desc",
          metadata: true,
        });
        
        const portraitResult = await this.getFeaturedImages({
          category: categorySlug || undefined,
          type: "portrait", 
          limit: Math.ceil(fetchLimit * 0.3), // 30% portrait (for variety)
          priority: "desc",
          metadata: true,
        });
        
        // Combine both types
        result = {
          images: [...featuredResult.images, ...portraitResult.images],
          total_found: featuredResult.total_found + portraitResult.total_found,
          available_categories: featuredResult.available_categories
        };
        
        logger.info(`📊 Mixed image types: ${featuredResult.images.length} featured + ${portraitResult.images.length} portrait = ${result.images.length} total`);
        
      } else {
        // For social media, stick to portrait preference
        result = await this.getFeaturedImages({
          category: categorySlug || undefined,
          type: "portrait",
          limit: fetchLimit,
          priority: "desc",
          metadata: true,
        });
      }

      logger.info(`Found ${result.images.length} images for topic "${topic}" (category: ${categorySlug || "all"})`);
      
      // If no images for default query, try each available source
      if (result.images.length === 0) {
        logger.warn("No images found for default query, iterating over available sources...");
        const sources = (result as any).available_sources?.map((s: any) => s.key) || ["main","guu_2025","guu_ssd"];
        for (const src of sources) {
          try {
            const alt = await this.getFeaturedImages({
              category: categorySlug || undefined,
              source: src,
              type: contentType === "social" ? "portrait" : "featured",
              limit: fetchLimit,
              priority: "desc",
              metadata: true,
            });
            if (alt.images.length > 0) {
              logger.info(`Found ${alt.images.length} images using source "${src}"`);
              result.images = alt.images;
              break;
            }
          } catch (err) { /* ignore individual source errors */ }
        }

        if (result.images.length === 0) {
          logger.warn("⚠️ No real images found from any source, returning empty array");
        return [];
      }
      }

      // ENHANCED: Apply SMART album mixing by default for better variety
      let selectedImages = result.images;
      
      if (selectedImages.length > 0) {
        // Group images by folder to understand distribution
        const imagesByFolder = selectedImages.reduce((acc, img) => {
          const folder = img.folder_path || "unknown";
          if (!acc[folder]) acc[folder] = [];
          acc[folder].push(img);
          return acc;
        }, {} as Record<string, PhotoGalleryImage[]>);

        const folders = Object.entries(imagesByFolder);
        
        if (options.ensureAlbumConsistency && folders.length > 1) {
          // User explicitly wants same album consistency
                     const eligibleFolders = folders.filter(([_, imgs]) => (imgs as PhotoGalleryImage[]).length >= limit);

          if (eligibleFolders.length > 0) {
            // Randomly select a folder
            const randomFolderIndex = Math.floor(Math.random() * eligibleFolders.length);
            const selectedFolder = eligibleFolders[randomFolderIndex];
            selectedImages = selectedFolder[1];
            
            logger.info(`📁 SAME ALBUM: Selected folder "${selectedFolder[0]}" with ${selectedImages.length} images (from ${eligibleFolders.length} eligible folders)`);
          } else {
            logger.info(`📁 No single folder has ${limit} images, falling back to mixed albums`);
          }
        } else if (folders.length > 1) {
          // DEFAULT: Smart mixing across albums for variety (when ensureAlbumConsistency = false)
          logger.info(`🎲 SMART MIXING: Distributing ${limit} images across ${folders.length} available albums for variety`);
          
          const mixedImages: PhotoGalleryImage[] = [];
          let folderIndex = 0;

          // Distribute images evenly across folders
          while (mixedImages.length < limit && mixedImages.length < selectedImages.length) {
            const currentFolder = folders[folderIndex % folders.length];
            const folderImages = currentFolder[1] as PhotoGalleryImage[];

            // Find unused image in this folder
            const unusedImage = folderImages.find(img => !mixedImages.includes(img));
            if (unusedImage) {
              mixedImages.push(unusedImage);
            }
            folderIndex++;
            
            // Safety check to prevent infinite loop
            if (folderIndex > folders.length * 10) break;
          }

          selectedImages = mixedImages;

          // Log the distribution
          const distribution = mixedImages.reduce((acc, img) => {
            const folder = img.folder_path || "unknown";
            acc[folder] = (acc[folder] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          logger.info(`📊 Smart mixing distribution: ${JSON.stringify(distribution)}`);
        } else {
          logger.info(`📁 Only one album available: ${folders[0]?.[0] || 'unknown'} (${selectedImages.length} images)`);
        }
      }

      // ENHANCED: Filter out recently used images to avoid duplicates
      const unusedImages = this.usageTracker.filterUnusedImages(
        selectedImages, 
        categorySlug || 'general',
        Math.min(limit, 3) // Ensure at least 3 images for variety
      ) as PhotoGalleryImage[];
      
      logger.info(`🚫 Duplicate filtering: ${selectedImages.length} → ${unusedImages.length} unused images`);
      
      // Shuffle the unused images for randomness
      const shuffled = this.shuffleArray([...unusedImages]);
      
      // Return only the requested number of images
      const finalImages = shuffled.slice(0, limit);
      
      // Mark selected images as used to prevent future duplicates
      this.usageTracker.markImagesAsUsed(
        finalImages, 
        topic, 
        categorySlug || 'general'
      );
      
      logger.info(`✅ Final selection: ${finalImages.length} unique images (topic: "${topic}")`);
      
      // Log usage stats for debugging
      const stats = this.usageTracker.getUsageStats();
      logger.info(`📊 Usage tracking stats:`, {
        totalTracked: stats.totalTracked,
        recentlyUsed: stats.recentlyUsed,
        categories: stats.categoriesUsed.join(', ')
      });
      
      return finalImages;

    } catch (error) {
      logger.error("Failed to get images for topic:", error);
      return [];
    }
  }

  /**
   * Fisher-Yates shuffle algorithm for array randomization
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate mock images for testing when API returns no results
   */
  generateMockImagesForTopic(topic: string, limit: number = 5): PhotoGalleryImage[] {
    const mockImages: PhotoGalleryImage[] = [];
    const baseUrl = "https://picsum.photos";
    
    // Use topic hash to generate consistent images
    const topicHash = topic.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 0; i < limit; i++) {
      const seed = topicHash + i;
      const width = 1200;
      const height = 800;
      
      mockImages.push({
        id: seed,
        source_key: "mock",
        image_path: `mock/image_${seed}.jpg`,
        folder_path: "mock",
        featured_type: "featured",
        priority_order: i + 1,
        thumbnail_url: `${baseUrl}/seed/${seed}/${width}/${height}`,
        full_image_url: `${baseUrl}/seed/${seed}/${width * 2}/${height * 2}`,
        category: {
          name: "Mock Category",
          slug: "mock",
          color: "#6B7280",
          icon: "fas fa-image",
        },
        metadata: {
          filename: `image_${seed}.jpg`,
          filesize: 1024 * 1024 * 2, // 2MB
          modified_date: new Date().toISOString(),
          alt_text: `${topic} - Image ${i + 1}`,
          description: `Mock image for ${topic} content`,
          created_at: new Date().toISOString(),
          width,
          height,
          aspect_ratio: width / height,
        },
      });
    }
    
    return mockImages;
  }

  /**
   * Download image for local use (if needed)
   */
  async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          "User-Agent": "AI-Content-Agent/1.0",
        },
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error("Failed to download image:", error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const categories = await this.getCategories(true);
      logger.info(`Photo Gallery API connected. Found ${categories.length} categories`);
      return true;
    } catch (error) {
      logger.error("Photo Gallery API connection failed:", error);
      return false;
    }
  }

  /**
   * Get a set of images by category with consistency options
   */
  async getImagesByCategory(
    categorySlug: string,
    limit: number = 5,
    options: {
      ensureAlbumConsistency?: boolean;
      preferPortrait?: boolean;
    } = {},
  ): Promise<string[]> {
    try {
      // First try portrait if preferred
      let result;
      if (options.preferPortrait) {
        result = await this.getFeaturedImagesWithRetry({
          category: categorySlug,
          type: "portrait",
          limit: limit * 2, // Get more to have options
          priority: "desc",
          metadata: true,
          maxRetries: 1,
        });

        // If not enough portrait images, fallback to featured
        if (result.images.length < limit) {
          const featuredResult = await this.getFeaturedImagesWithRetry({
            category: categorySlug,
            type: "featured",
            limit: limit * 2,
            priority: "desc",
            metadata: true,
            maxRetries: 1,
          });
          // Combine portrait + featured
          result.images = [...result.images, ...featuredResult.images];
        }
      } else {
        result = await this.getFeaturedImagesWithRetry({
        category: categorySlug,
          limit: limit * 2,
          priority: "desc",
        metadata: true,
          maxRetries: 1,
        });
      }

      let selectedImages = result.images;

      // If preferPortrait, reorder so portrait images come first
      if (options.preferPortrait) {
        const portraitImages = selectedImages.filter(img => img.featured_type === "portrait");
        const otherImages = selectedImages.filter(img => img.featured_type !== "portrait");
        selectedImages = [...portraitImages, ...otherImages];
      }

      // Handle album consistency based on option
      if (selectedImages.length > 0) {
        if (options.ensureAlbumConsistency) {
          // User wants all images from same album
          // Group by folder_path
          const imagesByFolder = selectedImages.reduce((acc, img) => {
            const folder = img.folder_path || "unknown";
            if (!acc[folder]) acc[folder] = [];
            acc[folder].push(img);
            return acc;
          }, {} as Record<string, PhotoGalleryImage[]>);

          let eligibleFolders = Object.entries(imagesByFolder)
            .filter(([_, imgs]) => (imgs as any[]).length >= limit);
          // If preferPortrait, prioritise folders containing portrait images first
          if (options.preferPortrait) {
            const portraitEligible = eligibleFolders.filter(([_, imgs]) => (imgs as PhotoGalleryImage[]).some(img => img.featured_type === "portrait"));
            if (portraitEligible.length > 0) {
              eligibleFolders = portraitEligible;
            }
          }

          if (eligibleFolders.length > 0) {
            // RANDOM SELECTION from eligible folders
            const randomIndex = Math.floor(Math.random() * eligibleFolders.length);
            const selectedFolder = eligibleFolders[randomIndex];
            selectedImages = selectedFolder[1];

            // Log all eligible albums for transparency
            const albumNames = eligibleFolders.map(([name, imgs]) => `${name}(${(imgs as any[]).length})`);
            logger.info(`🎯 Random album selected: ${selectedFolder[0]} (${(selectedFolder[1] as any[]).length} images)`);
            logger.info(`📋 Eligible albums: [${albumNames.join(", ")}] - randomly chose index ${randomIndex}`);
          } else {
            // If no single folder has enough, randomly pick from largest available folders
            const allFolders = Object.entries(imagesByFolder)
              .sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length);

            if (allFolders.length > 0) {
              // Take top 3 largest folders and randomly pick one
              const topFolders = allFolders.slice(0, Math.min(3, allFolders.length));
              const randomIndex = Math.floor(Math.random() * topFolders.length);
              const selectedFolder = topFolders[randomIndex];
              selectedImages = selectedFolder[1];
              logger.info(`🎯 Random album from top choices: ${selectedFolder[0]} (${(selectedFolder[1] as any[]).length} images) - chosen from top ${topFolders.length} albums`);
            }
          }
        } else {
          // User does NOT want album consistency - mix images from different albums
          logger.info("🔀 Mixing images from different albums (ensureAlbumConsistency = false)");

          // Group by folder_path
          const imagesByFolder = selectedImages.reduce((acc, img) => {
            const folder = img.folder_path || "unknown";
            if (!acc[folder]) acc[folder] = [];
            acc[folder].push(img);
            return acc;
          }, {} as Record<string, PhotoGalleryImage[]>);

          const folders = Object.entries(imagesByFolder);
          if (folders.length > 1) {
            // We have multiple folders - distribute images across them
            const mixedImages: PhotoGalleryImage[] = [];
            let folderIndex = 0;

            const isPortraitFirst = options.preferPortrait === true;

            while (mixedImages.length < limit && mixedImages.length < selectedImages.length) {
              const currentFolder = folders[folderIndex % folders.length];
              const folderImages = currentFolder[1] as PhotoGalleryImage[];

              let unusedImage: PhotoGalleryImage | undefined;
              if (isPortraitFirst) {
                // Try to find portrait image first in this folder
                unusedImage = folderImages.find(img => img.featured_type === "portrait" && !mixedImages.includes(img));
              }
              // If not found or not preferPortrait, pick any unused image
              if (!unusedImage) {
                unusedImage = folderImages.find(img => !mixedImages.includes(img));
              }
              if (unusedImage) {
                mixedImages.push(unusedImage);
              }
              folderIndex++;
            }

            // After mixing, if preferPortrait and we still have less than limit and some portrait images left in other folders, append them
            if (isPortraitFirst && mixedImages.length < limit) {
              const remainingPortraits = selectedImages
                .filter(img => img.featured_type === "portrait" && !mixedImages.includes(img))
                .slice(0, limit - mixedImages.length);
              mixedImages.push(...remainingPortraits);
            }

            selectedImages = mixedImages;

            // Log the distribution
            const distribution = mixedImages.reduce((acc, img) => {
              const folder = img.folder_path || "unknown";
              acc[folder] = (acc[folder] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            logger.info(`📊 Mixed image distribution: ${JSON.stringify(distribution)}`);
          } else {
            logger.info("⚠️ Only one folder available, cannot mix albums");
          }
        }
      }

      return selectedImages.slice(0, limit).map((img) => img.thumbnail_url).filter(Boolean);
    } catch (error) {
      logger.error("getImagesByCategory failed:", error);
      return [];
    }
  }

  /**
   * Get a random set of images across all categories
   */
  async getRandomImages(limit: number = 5): Promise<string[]> {
    try {
      const result = await this.getFeaturedImagesWithRetry({ 
        limit: limit * 2, 
        metadata: true,
        maxRetries: 1,
      });
      // Shuffle and take requested amount
      const shuffled = result.images.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, limit).map((img) => img.thumbnail_url).filter(Boolean);
    } catch (error) {
      logger.error("getRandomImages failed:", error);
      // Return empty array - no mock fallback
      return [];
    }
  }

  /**
   * Get images from a specific folder with category consistency
   */
  async getImagesFromFolder(
    folderPath: string,
    limit: number = 5,
    options: {
      categorySlug?: string;
      preferPortrait?: boolean;
    } = {},
  ): Promise<string[]> {
    try {
      let result;

      // If category is specified, filter by category first for consistency
      if (options.categorySlug) {
        result = await this.getFeaturedImagesWithRetry({
          category: options.categorySlug,
          type: options.preferPortrait ? "portrait" : undefined,
          limit: limit * 3, // Get more to filter
          metadata: true,
          maxRetries: 1,
        });

        // If preferPortrait and not enough, get featured from same category
        if (options.preferPortrait && result.images.length < limit) {
          const featuredResult = await this.getFeaturedImagesWithRetry({
            category: options.categorySlug,
            type: "featured",
        limit: limit * 2, 
        metadata: true,
        maxRetries: 1,
      });
          result.images = [...result.images, ...featuredResult.images];
        }
      } else {
        // No category constraint
        result = await this.getFeaturedImagesWithRetry({
          type: options.preferPortrait ? "portrait" : undefined,
          limit: limit * 3,
          metadata: true,
          maxRetries: 1,
        });
      }
      
      // Filter by folder path
      const folderImages = result.images.filter(img => 
        img.folder_path?.includes(folderPath),
      );
      
      logger.info(`📁 Found ${folderImages.length} images in folder "${folderPath}"${options.categorySlug ? ` (category: ${options.categorySlug})` : ""}`);

      return folderImages.slice(0, limit).map((img) => img.thumbnail_url).filter(Boolean);
    } catch (error) {
      logger.error("getImagesFromFolder failed:", error);
      return [];
    }
  }

  /**
   * Return list of unique folder names for a category. Fallback: scan featured images.
   */
  async getFoldersByCategory(categorySlug: string): Promise<string[]> {
    try {
      // Attempt to call dedicated endpoint if exists
      try {
        const resp = await this.axios.get("", {
          params: {
            action: "ai_get_folders_by_category",
            category: categorySlug,
          },
        });
        if (resp.data?.success && Array.isArray(resp.data.folders)) {
          return resp.data.folders.map((f: any) => f.folder_path || f.path || f.name).filter(Boolean);
        }
      } catch (_) {
        // ignore, fallback below
      }

      // Fallback: fetch featured images and derive folder paths
      const result = await this.getFeaturedImagesWithRetry({ 
        category: categorySlug, 
        limit: 50,
        maxRetries: 1,
      });
      
      if (result.images.length === 0) {
        // Return empty array - no mock fallback
        return [];
      }

      // Extract unique folder paths
      const folders = [...new Set(
        result.images
          .map(img => img.folder_path)
          .filter(Boolean),
      )];

      return folders;
    } catch (error) {
      logger.error("getFoldersByCategory failed:", error);
      // Return empty array - no mock fallback
      return [];
    }
  }

  /**
   * Generate mock folders for a category
   */
  private generateMockFolders(categorySlug: string): string[] {
    const mockFolders: { [key: string]: string[] } = {
      wedding: [
        "PSC Ba Son - Lam Vien",
        "Wedding Ceremony - Downtown",
        "Reception Party - Grand Hotel",
        "Pre-Wedding Photoshoot",
      ],
      graduation: [
        "University Graduation 2024",
        "High School Yearbook",
        "Academic Achievement Photos",
      ],
      corporate: [
        "Company Event 2024",
        "Team Building Activities",
        "Product Launch Event",
      ],
      portrait: [
        "Professional Headshots",
        "Family Portrait Session",
        "Individual Portrait Collection",
      ],
    };
    
    return mockFolders[categorySlug] || [`${categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)} Collection`];
  }

  /**
   * Clear image usage history (for development/testing)
   */
  clearUsageHistory(): void {
    this.usageTracker.clearUsageHistory();
  }

  /**
   * Get usage statistics for debugging
   */
  getUsageStats() {
    return this.usageTracker.getUsageStats();
  }

  /**
   * Get recently used images for debugging
   */
  getRecentlyUsedImages(category: string = 'general', limit: number = 10) {
    return this.usageTracker.getRecentlyUsedImages(category, limit);
  }
} 
