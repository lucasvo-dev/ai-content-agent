import axios, { AxiosInstance, AxiosError } from 'axios';
import { WordPressError } from '@/utils/errors';
import type { Content, PublishResult, PlatformCredentials } from '@/types';

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

      // Create the post
      const response = await this.client.post('/posts', postData);

      if (response.status !== 201) {
        throw new WordPressError(`Failed to create post. Status: ${response.status}`);
      }

      const post = response.data;
      
      console.log(`Successfully published to WordPress. Post ID: ${post.id}`);

      return {
        success: true,
        externalId: post.id.toString(),
        externalUrl: post.link,
        message: 'Content published to WordPress successfully',
        publishedAt: new Date(post.date),
      };

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
   * Prepare WordPress post data from content
   */
  private async preparePostData(content: Content, settings: PublishSettings): Promise<any> {
    const postData: any = {
      title: content.title,
      content: content.body,
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

    // Handle featured image
    if (settings.featuredImageUrl) {
      try {
        const mediaId = await this.uploadFeaturedImage(settings.featuredImageUrl, content.title);
        postData.featured_media = mediaId;
      } catch (error) {
        console.warn('Failed to upload featured image:', error);
        // Continue without featured image
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