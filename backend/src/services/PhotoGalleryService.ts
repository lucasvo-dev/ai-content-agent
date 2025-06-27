import axios from 'axios';
import { logger } from '../utils/logger';

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
  private config: PhotoGalleryConfig;
  private axios: any;

  constructor(config?: PhotoGalleryConfig) {
    this.config = config || {
      apiUrl: process.env.PHOTO_GALLERY_API_URL || 'https://photo.guustudio.vn/api.php'
    };

    this.axios = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'AI-Content-Agent/1.0',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Ensure URL is absolute. The Gallery API often returns paths like "/api.php?...".
   */
  private makeAbsolute(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Remove trailing "/api.php" from base if present
    const base = this.config.apiUrl.replace(/\/api\.php$/i, '');
    // Ensure there is no double slash
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  /**
   * Get available categories from photo gallery
   */
  async getCategories(includeStats: boolean = false): Promise<PhotoGalleryCategory[]> {
    try {
      const response = await this.axios.get('', {
        params: {
          action: 'ai_get_categories',
          stats: includeStats
        }
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch categories');
      }

      return response.data.categories;
    } catch (error) {
      logger.error('Failed to fetch gallery categories:', error);
      throw error;
    }
  }

  /**
   * Get featured images by category for content integration
   */
  async getFeaturedImages(options: {
    category?: string;
    type?: 'featured' | 'portrait';
    source?: string;
    limit?: number;
    priority?: 'asc' | 'desc';
    metadata?: boolean;
  } = {}): Promise<{
    images: PhotoGalleryImage[];
    total_found: number;
    available_categories: PhotoGalleryCategory[];
  }> {
    try {
      const params: any = {
        action: 'ai_get_featured_images',
        limit: options.limit || 10,
        priority: options.priority || 'desc', // Photo Gallery team recommends desc for best quality
        metadata: options.metadata !== false ? 'true' : 'false'
      };

      // Only add optional params if they exist
      if (options.category) params.category = options.category;
      if (options.type) params.type = options.type;
      if (options.source) params.source = options.source;

      logger.info('🔍 Fetching featured images from Photo Gallery', { params });

      const response = await this.axios.get('', { params });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch featured images');
      }

      // If no images found and no source specified, try all available sources
      if (response.data.images?.length === 0 && !options.source && response.data.available_sources?.length > 0) {
        logger.info('🔄 No images found, trying all available sources...');
        
        for (const source of response.data.available_sources) {
          logger.info(`🔍 Trying source: ${source.key} (${source.name})`);
          
          const sourceParams = { ...params, source: source.key };
          const sourceResponse = await this.axios.get('', { params: sourceParams });
          
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
        available_categories: response.data.available_categories || []
      };
    } catch (error) {
      logger.error('Failed to fetch featured images:', error);
      throw error;
    }
  }

  /**
   * Get featured images with retry logic for cache building
   */
  async getFeaturedImagesWithRetry(options: {
    category?: string;
    type?: 'featured' | 'portrait';
    source?: string;
    limit?: number;
    priority?: 'asc' | 'desc';
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
          logger.warn('📸 No real images available from Photo Gallery API');
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
        source_key: 'mock',
        image_path: `${selectedFolder}/image_${i + 1}.jpg`,
        folder_path: selectedFolder,
        featured_type: 'featured',
        priority_order: i,
        thumbnail_url: imageUrl,
        full_image_url: imageUrl,
        preferred_url: imageUrl,
        category: {
          name: category.charAt(0).toUpperCase() + category.slice(1),
          slug: category,
          color: '#EF4444',
          icon: 'fas fa-image'
        }
      });
    }
    
    return mockImages;
  }

  /**
   * Get best matching images for content topic
   */
  async getImagesForTopic(
    topic: string,
    contentType: 'blog' | 'social' = 'blog',
    limit: number = 5
  ): Promise<PhotoGalleryImage[]> {
    try {
      // Smart keyword mapping to categories
      const topicLower = topic.toLowerCase();
      let categorySlug = '';

      if (topicLower.includes('cưới') || topicLower.includes('wedding') || topicLower.includes('đám cưới')) {
        categorySlug = 'wedding';
      } else if (topicLower.includes('pre-wedding') || topicLower.includes('prewedding')) {
        categorySlug = 'pre-wedding';
      } else if (topicLower.includes('kỷ yếu') || topicLower.includes('graduation') || topicLower.includes('yearbook')) {
        categorySlug = 'graduation';
      } else if (topicLower.includes('doanh nghiệp') || topicLower.includes('corporate') || topicLower.includes('công ty')) {
        categorySlug = 'corporate';
      } else if (topicLower.includes('ảnh thẻ') || topicLower.includes('id photo') || topicLower.includes('profile')) {
        categorySlug = 'id-photo';
      }

      // If no specific category detected, try to get from all categories
      const result = await this.getFeaturedImages({
        category: categorySlug || undefined,
        type: contentType === 'social' ? 'portrait' : 'featured',
        limit: limit,
        priority: 'desc',
        metadata: true
      });

      logger.info(`Found ${result.images.length} images for topic "${topic}" (category: ${categorySlug || 'all'})`);
      
      // If no images for default query, try each available source
      if (result.images.length === 0) {
        logger.warn('No images found for default query, iterating over available sources...');
        const sources = result.available_sources?.map((s: any) => s.key) || ['main','guu_2025','guu_ssd'];
        for (const src of sources) {
          try {
            const alt = await this.getFeaturedImages({
              category: categorySlug || undefined,
              source: src,
              type: contentType === 'social' ? 'portrait' : 'featured',
              limit,
              priority: 'desc',
              metadata: true
            });
            if (alt.images.length > 0) {
              logger.info(`Found ${alt.images.length} images using source "${src}"`);
              return alt.images;
            }
          } catch (err) { /* ignore individual source errors */ }
        }

        // No real images found - return empty array (real images only per user request)
        logger.warn('⚠️ No real images found from any source, returning empty array (real images only)');
        return [];
      }
      
      return result.images;
    } catch (error) {
      logger.error('Failed to get images for topic:', error);
      return [];
    }
  }

  /**
   * Generate mock images for testing when API returns no results
   */
  generateMockImagesForTopic(topic: string, limit: number = 5): PhotoGalleryImage[] {
    const mockImages: PhotoGalleryImage[] = [];
    const baseUrl = 'https://picsum.photos';
    
    // Use topic hash to generate consistent images
    const topicHash = topic.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 0; i < limit; i++) {
      const seed = topicHash + i;
      const width = 1200;
      const height = 800;
      
      mockImages.push({
        id: seed,
        source_key: 'mock',
        image_path: `mock/image_${seed}.jpg`,
        folder_path: 'mock',
        featured_type: 'featured',
        priority_order: i + 1,
        thumbnail_url: `${baseUrl}/seed/${seed}/${width}/${height}`,
        full_image_url: `${baseUrl}/seed/${seed}/${width * 2}/${height * 2}`,
        category: {
          name: 'Mock Category',
          slug: 'mock',
          color: '#6B7280',
          icon: 'fas fa-image'
        },
        metadata: {
          filename: `image_${seed}.jpg`,
          filesize: 1024 * 1024 * 2, // 2MB
          modified_date: new Date().toISOString(),
          alt_text: `${topic} - Image ${i + 1}`,
          description: `Mock image for ${topic} content`,
          created_at: new Date().toISOString(),
          width: width,
          height: height,
          aspect_ratio: width / height
        }
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
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'AI-Content-Agent/1.0'
        }
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download image:', error);
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
      logger.error('Photo Gallery API connection failed:', error);
      return false;
    }
  }

  /**
   * Get a set of images by category
   */
  async getImagesByCategory(categorySlug: string, limit: number = 5): Promise<string[]> {
    try {
      const result = await this.getFeaturedImagesWithRetry({
        category: categorySlug,
        limit,
        priority: 'desc',
        metadata: true,
        maxRetries: 1, // Quick retry for content generation
      });
      return result.images.slice(0, limit).map((img) => img.preferred_url).filter(Boolean);
    } catch (error) {
      logger.error('getImagesByCategory failed:', error);
      // Return empty array - no mock fallback
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
      return shuffled.slice(0, limit).map((img) => img.preferred_url).filter(Boolean);
    } catch (error) {
      logger.error('getRandomImages failed:', error);
      // Return empty array - no mock fallback
      return [];
    }
  }

  /**
   * Get images from a specific folder
   */
  async getImagesFromFolder(folderPath: string, limit: number = 5): Promise<string[]> {
    try {
      // Try to get images by searching for folder path in image_path
      const result = await this.getFeaturedImagesWithRetry({ 
        limit: limit * 2, 
        metadata: true,
        maxRetries: 1,
      });
      
      // Filter by folder path
      const folderImages = result.images.filter(img => 
        img.folder_path && img.folder_path.includes(folderPath)
      );
      
      return folderImages.slice(0, limit).map((img) => img.preferred_url).filter(Boolean);
    } catch (error) {
      logger.error('getImagesFromFolder failed:', error);
      // Return empty array - no mock fallback
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
        const resp = await this.axios.get('', {
          params: {
            action: 'ai_get_folders_by_category',
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
        maxRetries: 1
      });
      
      if (result.images.length === 0) {
        // Return empty array - no mock fallback
        return [];
      }

      // Extract unique folder paths
      const folders = [...new Set(
        result.images
          .map(img => img.folder_path)
          .filter(Boolean)
      )];

      return folders;
    } catch (error) {
      logger.error('getFoldersByCategory failed:', error);
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
        'PSC Ba Son - Lam Vien',
        'Wedding Ceremony - Downtown',
        'Reception Party - Grand Hotel',
        'Pre-Wedding Photoshoot'
      ],
      graduation: [
        'University Graduation 2024',
        'High School Yearbook',
        'Academic Achievement Photos'
      ],
      corporate: [
        'Company Event 2024',
        'Team Building Activities',
        'Product Launch Event'
      ],
      portrait: [
        'Professional Headshots',
        'Family Portrait Session',
        'Individual Portrait Collection'
      ]
    };
    
    return mockFolders[categorySlug] || [`${categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)} Collection`];
  }
} 