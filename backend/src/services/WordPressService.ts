import axios, { AxiosInstance, AxiosError } from 'axios';
import { WordPressError } from '@/utils/errors';
import type { Content, PublishResult, PlatformCredentials } from '@/types';
import { logger } from '../utils/logger';

interface WordPressCredentials extends PlatformCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

interface WordPressPost {
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  status: 'draft' | 'publish' | 'private' | 'pending';
  date?: string;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  meta?: Record<string, any>;
}

interface WordPressMedia {
  id: number;
  source_url: string;
  alt_text: string;
  caption: { rendered: string };
}

interface PublishSettings {
  status?: 'draft' | 'publish' | 'private';
  scheduledDate?: Date;
  categories?: string[];
  tags?: string[];
  featuredImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export class WordPressService {
  private client: AxiosInstance;
  private credentials: WordPressCredentials;

  constructor(credentials: WordPressCredentials) {
    this.credentials = credentials;
    this.client = this.createClient();
  }

  private createClient(): AxiosInstance {
    const { siteUrl, username, applicationPassword } = this.credentials;
    
    // Create base64 encoded auth string for Application Passwords
    const authString = Buffer.from(`${username}:${applicationPassword}`).toString('base64');

    return axios.create({
      baseURL: `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2`,
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Content-Agent/1.0'
      },
      timeout: 30000, // 30 seconds timeout
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });
  }

  /**
   * Test WordPress connection and credentials
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('Testing WordPress connection to:', this.credentials.siteUrl);
      
      // First, test if WordPress REST API is available
      const apiTestResponse = await axios.get(`${this.credentials.siteUrl}/wp-json/wp/v2`, {
        timeout: 10000,
        validateStatus: (status) => status < 500,
      });

      if (apiTestResponse.status === 404) {
        return {
          success: false,
          message: 'WordPress REST API not found. Please ensure WordPress REST API is enabled.',
        };
      }

      // Test authentication by trying to access a protected endpoint
      const authTestResponse = await this.client.get('/users/me');
      
      if (authTestResponse.status === 401) {
        const errorData = authTestResponse.data;
        if (errorData?.code === 'incorrect_password') {
          return {
            success: false,
            message: 'Invalid Application Password. Please create a new Application Password in WordPress Admin → Users → Your Profile → Application Passwords.',
          };
        }
        return {
          success: false,
          message: 'Authentication failed. Please check your username and Application Password.',
        };
      }

      if (authTestResponse.status === 403) {
        return {
          success: false,
          message: 'Access forbidden. User may not have sufficient permissions.',
        };
      }

      if (authTestResponse.status !== 200) {
        return {
          success: false,
          message: `WordPress API returned status ${authTestResponse.status}`,
        };
      }

      // Get site information
      const siteInfo = await this.getSiteInfo();
      
      console.log('WordPress connection successful');
      return {
        success: true,
        message: 'WordPress connection successful',
        details: siteInfo,
      };
    } catch (error) {
      console.error('WordPress connection test failed:', error);
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Cannot connect to WordPress site. Please check the URL.',
        };
      }
      
      if (axiosError.response?.status === 401) {
        return {
          success: false,
          message: 'Authentication failed. Please check your credentials.',
        };
      }
      
      return {
        success: false,
        message: `Connection failed: ${axiosError.message}`,
      };
    }
  }

  /**
   * Get WordPress site information
   */
  private async getSiteInfo(): Promise<any> {
    try {
      // Get site info from root endpoint
      const siteResponse = await axios.get(`${this.credentials.siteUrl}/wp-json`);
      
      // Get categories and tags for additional info
      const [categoriesResponse, tagsResponse] = await Promise.all([
        this.client.get('/categories?per_page=20'),
        this.client.get('/tags?per_page=20'),
      ]);

      return {
        siteTitle: siteResponse.data.name || 'WordPress Site',
        siteUrl: this.credentials.siteUrl,
        wordpressVersion: siteResponse.data.wp_version || 'Unknown',
        apiVersion: siteResponse.data.api_version || 'wp/v2',
        availableCategories: categoriesResponse.data.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
        })),
        availableTags: tagsResponse.data.map((tag: any) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
        })),
      };
    } catch (error) {
      throw new WordPressError('Failed to get site information', error);
    }
  }

  /**
   * Publish content to WordPress
   */
  async publishContent(content: Content, settings: PublishSettings = {}): Promise<PublishResult> {
    try {
      console.log(`Publishing content "${content.title}" to WordPress...`);

      // Prepare WordPress post data
      const postData = await this.preparePostData(content, settings);

      // Create the post with a shorter initial timeout
      let postId: string | null = null;
      
      try {
        const response = await this.client.post('/posts', postData, {
          timeout: 30000 // 30 seconds initial timeout
        });

        if (response.status === 201) {
          postId = response.data.id.toString();
          console.log(`✅ Post created successfully. Post ID: ${postId}`);
          
          return {
            success: true,
            externalId: postId,
            externalUrl: response.data.link,
            message: 'Content published to WordPress successfully',
            publishedAt: new Date(response.data.date),
          };
        }
      } catch (error: any) {
        // Check if it's a timeout error
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          console.log('⏱️ Initial request timed out, attempting to verify post creation...');
          
          // Wait a bit then check if post was created
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Search for the post by title
          const searchResponse = await this.client.get('/posts', {
            params: {
              search: content.title,
              status: 'any',
              per_page: 5,
              orderby: 'date',
              order: 'desc'
            },
            timeout: 10000
          });
          
          // Check if we find a recent post with matching title
          const recentPost = searchResponse.data.find((post: any) => {
            const postDate = new Date(post.date_gmt + 'Z'); // Ensure UTC
            const timeDiff = Date.now() - postDate.getTime();
            // Check if post was created within last 2 minutes
            return post.title.rendered === content.title && timeDiff < 120000;
          });
          
          if (recentPost) {
            console.log(`✅ Post verified after timeout. Post ID: ${recentPost.id}`);
            return {
              success: true,
              externalId: recentPost.id.toString(),
              externalUrl: recentPost.link,
              message: 'Content published to WordPress successfully (verified after timeout)',
              publishedAt: new Date(recentPost.date),
            };
          }
        }
        
        // If not timeout or post not found, throw the original error
        throw error;
      }

      // If we get here without returning, something went wrong
      throw new WordPressError(`Failed to create post. Unexpected response.`);

    } catch (error) {
      console.error('WordPress publishing failed:', error);
      
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new WordPressError(errorMessage, error);
      }
      
      throw new WordPressError('Unknown error occurred during publishing', error);
    }
  }

  /**
   * Update existing WordPress post
   */
  async updateContent(postId: string, content: Content, settings: PublishSettings = {}): Promise<PublishResult> {
    try {
      console.log(`Updating WordPress post ${postId}...`);

      const postData = await this.preparePostData(content, settings);
      const response = await this.client.put(`/posts/${postId}`, postData);

      if (response.status !== 200) {
        throw new WordPressError(`Failed to update post. Status: ${response.status}`);
      }

      const post = response.data;

      return {
        success: true,
        externalId: post.id.toString(),
        externalUrl: post.link,
        message: 'Content updated in WordPress successfully',
        publishedAt: new Date(post.date),
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new WordPressError(errorMessage, error);
      }
      
      throw new WordPressError('Failed to update WordPress post', error);
    }
  }

  /**
   * Process and upload all images in content to WordPress media library
   */
  private async processContentImages(content: Content): Promise<{
    processedBody: string;
    featuredImageId?: number;
  }> {
    try {
      logger.info('🖼️ Processing images in content...');
      
      let processedBody = content.body;
      let featuredImageId: number | undefined;
      const uploadedImages: Map<string, { id: number; url: string }> = new Map();
      
      // FIRST: Check and upload featured image from metadata (highest priority)
      if (content.metadata?.featuredImage) {
        try {
          const featuredImageUrl = content.metadata.featuredImage;
          const featuredImageAlt = content.metadata.featuredImageAlt || content.title;
          const featuredImageCaption = content.metadata.featuredImageCaption || '';
          
          logger.info('📌 Found featured image in metadata, uploading with highest priority...');
          logger.info(`   URL: ${featuredImageUrl}`);
          logger.info(`   Alt: ${featuredImageAlt}`);
          
          const imageResponse = await axios.get(featuredImageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          
          const uploadResult = await this.uploadImageToWordPress(
            Buffer.from(imageResponse.data),
            `${content.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-featured.jpg`,
            featuredImageAlt,
            featuredImageCaption
          );
          
          featuredImageId = uploadResult.id;
          logger.info(`✅ Featured image from metadata uploaded successfully (ID: ${featuredImageId})`);
        } catch (error) {
          logger.error('❌ Failed to upload featured image from metadata:', error);
        }
      }
      
      // Extract all image URLs from content
      const imageRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
      const imageMatches = Array.from(content.body.matchAll(imageRegex));
      
      if (imageMatches.length === 0) {
        logger.info('No images found in content body');
        return { processedBody, featuredImageId };
      }
      
      logger.info(`Found ${imageMatches.length} images in content body to process`);
      
      // Process each image
      for (let i = 0; i < imageMatches.length; i++) {
        const match = imageMatches[i];
        const originalUrl = match[1];
        const fullMatch = match[0];
        
        try {
          // Skip if already uploaded
          if (uploadedImages.has(originalUrl)) {
            const uploaded = uploadedImages.get(originalUrl)!;
            processedBody = processedBody.replace(originalUrl, uploaded.url);
            continue;
          }
          
          // Extract alt text and other attributes
          const altMatch = fullMatch.match(/alt="([^"]*)"/);
          const altText = altMatch ? altMatch[1] : content.title;
          
          // Generate filename
          const filename = `${content.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${i + 1}.jpg`;
          
          // Download image
          logger.info(`Downloading image ${i + 1}/${imageMatches.length}: ${originalUrl}`);
          const imageResponse = await axios.get(originalUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          
          // Upload to WordPress
          const uploadResult = await this.uploadImageToWordPress(
            Buffer.from(imageResponse.data),
            filename,
            altText,
            altText
          );
          
          // Store the mapping
          uploadedImages.set(originalUrl, uploadResult);
          
          // Replace URL in content
          processedBody = processedBody.replace(originalUrl, uploadResult.url);
          
          // Only set as featured if we don't already have one from metadata
          if (!featuredImageId && i === 0) {
            featuredImageId = uploadResult.id;
            logger.info(`📌 Set first content image as featured (ID: ${uploadResult.id}) - no metadata featured image`);
          }
          
        } catch (error) {
          logger.error(`Failed to process image ${originalUrl}:`, error);
          // Continue with original URL if upload fails
        }
      }
      
      // If still no featured image, try gallery images as last resort
      if (!featuredImageId && content.metadata?.galleryImages?.length > 0) {
        try {
          logger.info('📌 No featured image yet, checking gallery images...');
          
          // Look for a landscape image first
          const landscapeImage = content.metadata.galleryImages.find(img => 
            this.isLikelyLandscape(img.url)
          );
          
          const selectedImage = landscapeImage || content.metadata.galleryImages[0];
          const featuredImageUrl = selectedImage.url;
          const featuredImageAlt = selectedImage.alt_text || content.title;
          const featuredImageCaption = selectedImage.caption || '';
          
          logger.info(`Using ${landscapeImage ? 'landscape' : 'first'} gallery image as featured`);
          
          const imageResponse = await axios.get(featuredImageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          });
          
          const uploadResult = await this.uploadImageToWordPress(
            Buffer.from(imageResponse.data),
            `${content.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-featured-gallery.jpg`,
            featuredImageAlt,
            featuredImageCaption
          );
          
          featuredImageId = uploadResult.id;
          logger.info(`✅ Gallery image uploaded as featured (ID: ${featuredImageId})`);
        } catch (error) {
          logger.error('Failed to upload gallery image as featured:', error);
        }
      }
      
      logger.info(`✅ Image processing complete. Uploaded ${uploadedImages.size} content images. Featured image ID: ${featuredImageId || 'none'}`);
      return { processedBody, featuredImageId };
      
    } catch (error) {
      logger.error('Error processing content images:', error);
      return { processedBody: content.body, featuredImageId: undefined };
    }
  }

  /**
   * Prepare WordPress post data from content
   */
  private async preparePostData(content: Content, settings: PublishSettings): Promise<any> {
    // Process images first
    const { processedBody, featuredImageId } = await this.processContentImages(content);
    
    // Add custom CSS for centered figcaptions
    const styledContent = `
      <style>
        figure {
          text-align: center;
          margin: 1.5rem 0;
        }
        figure img {
          max-width: 100%;
          height: auto;
          margin: 0 auto;
          display: block;
        }
        figcaption {
          text-align: center !important;
          font-style: italic;
          color: #666;
          font-size: 0.9rem;
          margin-top: 0.5rem;
          padding: 0 1rem;
        }
        .wp-caption {
          text-align: center !important;
        }
        .wp-caption-text {
          text-align: center !important;
          font-style: italic;
          color: #666;
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }
      </style>
      ${processedBody}
    `;
    
    const postData: any = {
      title: content.title,
      content: styledContent, // Use styled content with centered figcaptions
      excerpt: content.excerpt || this.generateExcerpt(content.body),
      status: settings.status || 'draft',
    };

    // Handle scheduled publishing
    if (settings.scheduledDate) {
      postData.date = settings.scheduledDate.toISOString();
      postData.status = 'future';
    }

    // Handle categories
    if (settings.categories && settings.categories.length > 0) {
      postData.categories = await this.resolveCategoryIds(settings.categories);
    }

    // Handle tags
    if (settings.tags && settings.tags.length > 0) {
      postData.tags = await this.resolveTagIds(settings.tags);
    }

    // Set featured image
    if (featuredImageId) {
      postData.featured_media = featuredImageId;
    } else if (settings.featuredImageUrl) {
      // Fallback to settings featured image if no image found in content
      try {
        const mediaId = await this.uploadFeaturedImage(settings.featuredImageUrl, content.title);
        postData.featured_media = mediaId;
      } catch (error) {
        console.warn('Failed to upload featured image from settings:', error);
      }
    }

    // Handle SEO meta (for Yoast or similar plugins)
    if (settings.seoTitle || settings.seoDescription) {
      postData.meta = {
        ...(settings.seoTitle && { _yoast_wpseo_title: settings.seoTitle }),
        ...(settings.seoDescription && { _yoast_wpseo_metadesc: settings.seoDescription }),
        _ai_generated: content.aiGenerated || false,
        _content_quality_score: content.metadata?.seoScore || 0,
      };
    }

    return postData;
  }

  /**
   * Check if image URL is likely a landscape image based on naming patterns
   */
  private isLikelyLandscape(imageUrl: string): boolean {
    const url = imageUrl.toLowerCase();
    // Look for landscape indicators in URL/filename
    return url.includes('landscape') || 
           url.includes('wide') || 
           url.includes('horizontal') ||
           url.includes('banner') ||
           !url.includes('portrait') && !url.includes('vertical');
  }

  /**
   * Generate excerpt from content body
   */
  private generateExcerpt(body: string, length: number = 160): string {
    // Remove HTML tags and get plain text
    const plainText = body.replace(/<[^>]*>/g, '');
    
    if (plainText.length <= length) {
      return plainText;
    }

    // Find the last complete sentence within the length limit
    const truncated = plainText.substring(0, length);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > length * 0.6) {
      return plainText.substring(0, lastSentence + 1);
    }

    // Fallback to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? plainText.substring(0, lastSpace) + '...' : truncated + '...';
  }

  /**
   * Resolve category names to IDs
   */
  private async resolveCategoryIds(categoryNames: string[]): Promise<number[]> {
    try {
      const categoryIds: number[] = [];

      for (const name of categoryNames) {
        // First, try to find existing category
        const response = await this.client.get(`/categories?search=${encodeURIComponent(name)}`);
        
        if (response.data.length > 0) {
          categoryIds.push(response.data[0].id);
        } else {
          // Create new category if it doesn't exist
          const createResponse = await this.client.post('/categories', {
            name: name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
          });
          
          if (createResponse.status === 201) {
            categoryIds.push(createResponse.data.id);
          }
        }
      }

      return categoryIds;
    } catch (error) {
      console.warn('Failed to resolve category IDs:', error);
      return [];
    }
  }

  /**
   * Resolve tag names to IDs
   */
  private async resolveTagIds(tagNames: string[]): Promise<number[]> {
    try {
      const tagIds: number[] = [];

      for (const name of tagNames) {
        // First, try to find existing tag
        const response = await this.client.get(`/tags?search=${encodeURIComponent(name)}`);
        
        if (response.data.length > 0) {
          tagIds.push(response.data[0].id);
        } else {
          // Create new tag if it doesn't exist
          const createResponse = await this.client.post('/tags', {
            name: name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
          });
          
          if (createResponse.status === 201) {
            tagIds.push(createResponse.data.id);
          }
        }
      }

      return tagIds;
    } catch (error) {
      console.warn('Failed to resolve tag IDs:', error);
      return [];
    }
  }

  /**
   * Upload featured image to WordPress media library
   */
  private async uploadFeaturedImage(imageUrl: string, altText: string): Promise<number> {
    try {
      // Download image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      // Extract filename from URL or generate one
      const urlParts = imageUrl.split('/');
      const filename = urlParts[urlParts.length - 1] || `featured-image-${Date.now()}.jpg`;

      // Upload to WordPress
      const uploadResponse = await this.client.post('/media', imageResponse.data, {
        headers: {
          'Content-Type': imageResponse.headers['content-type'] || 'image/jpeg',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });

      if (uploadResponse.status === 201) {
        // Update media metadata
        await this.client.put(`/media/${uploadResponse.data.id}`, {
          alt_text: altText,
          caption: altText,
        });

        return uploadResponse.data.id;
      }

      throw new Error(`Failed to upload image. Status: ${uploadResponse.status}`);
    } catch (error) {
      throw new WordPressError('Failed to upload featured image', error);
    }
  }

  /**
   * Upload image buffer to WordPress media library
   */
  async uploadImageToWordPress(
    imageBuffer: Buffer, 
    filename: string, 
    altText: string, 
    caption?: string
  ): Promise<{ id: number; url: string; }> {
    try {
      // Upload to WordPress
      const uploadResponse = await this.client.post('/media', imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });

      if (uploadResponse.status === 201) {
        const mediaId = uploadResponse.data.id;
        const mediaUrl = uploadResponse.data.source_url;

        // Update media metadata
        await this.client.put(`/media/${mediaId}`, {
          alt_text: altText,
          caption: caption || altText,
        });

        logger.info(`Uploaded image to WordPress: ${filename} (ID: ${mediaId})`);

        return {
          id: mediaId,
          url: mediaUrl
        };
      }

      throw new Error(`Failed to upload image. Status: ${uploadResponse.status}`);
    } catch (error) {
      throw new WordPressError('Failed to upload image to WordPress', error);
    }
  }

  /**
   * Get WordPress post by ID
   */
  async getPost(postId: string): Promise<any> {
    try {
      const response = await this.client.get(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      throw new WordPressError('Failed to get WordPress post', error);
    }
  }

  /**
   * Delete WordPress post
   */
  async deletePost(postId: string): Promise<boolean> {
    try {
      const response = await this.client.delete(`/posts/${postId}`);
      return response.status === 200;
    } catch (error) {
      throw new WordPressError('Failed to delete WordPress post', error);
    }
  }

  /**
   * Get post analytics/stats (basic info)
   */
  async getPostStats(postId: string): Promise<any> {
    try {
      const post = await this.getPost(postId);
      
      // Basic stats from WordPress (limited without additional plugins)
      return {
        id: post.id,
        title: post.title.rendered,
        url: post.link,
        status: post.status,
        publishedDate: post.date,
        modifiedDate: post.modified,
        commentCount: post.comment_status === 'open' ? 'Comments enabled' : 'Comments disabled',
        // Note: View counts require additional plugins like WP Statistics
      };
    } catch (error) {
      throw new WordPressError('Failed to get post stats', error);
    }
  }
} 