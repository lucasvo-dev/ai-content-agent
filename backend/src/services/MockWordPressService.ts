import type { Content, PublishResult, PlatformCredentials } from '../types';
import { logger } from '../utils/logger';

interface WordPressCredentials extends PlatformCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
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

export class MockWordPressService {
  private credentials: WordPressCredentials;

  constructor(credentials: WordPressCredentials) {
    this.credentials = credentials;
  }

  /**
   * Mock test WordPress connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    // Simulate connection test delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logger.info(`🧪 Mock testing connection to: ${this.credentials.siteUrl}`);
    
    return {
      success: true,
      message: 'Mock WordPress connection successful',
      details: {
        siteTitle: 'Mock WordPress Site',
        siteUrl: this.credentials.siteUrl,
        wordpressVersion: '6.4.0',
        apiVersion: 'wp/v2',
        availableCategories: [
          { id: 1, name: 'Wedding', slug: 'wedding' },
          { id: 2, name: 'Photography', slug: 'photography' }
        ],
        availableTags: [
          { id: 1, name: 'guustudio', slug: 'guustudio' },
          { id: 2, name: 'wedding', slug: 'wedding' }
        ]
      },
    };
  }

  /**
   * Mock publish content to WordPress
   */
  async publishContent(content: Content, settings: PublishSettings = {}): Promise<PublishResult> {
    // Simulate publishing delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    logger.info(`🧪 Mock publishing content "${content.title}" to ${this.credentials.siteUrl}`);
    
    // Generate mock post ID and URL
    const mockPostId = Math.floor(Math.random() * 1000) + 1;
    const mockUrl = `${this.credentials.siteUrl}/post-${mockPostId}`;
    
    return {
      success: true,
      externalId: mockPostId.toString(),
      externalUrl: mockUrl,
      message: 'Mock content published successfully',
      publishedAt: new Date(),
    };
  }

  /**
   * Mock update existing WordPress post
   */
  async updateContent(postId: string, content: Content, settings: PublishSettings = {}): Promise<PublishResult> {
    await new Promise(resolve => setTimeout(resolve, 150));
    
    logger.info(`🧪 Mock updating WordPress post ${postId}`);
    
    const mockUrl = `${this.credentials.siteUrl}/post-${postId}`;
    
    return {
      success: true,
      externalId: postId,
      externalUrl: mockUrl,
      message: 'Mock content updated successfully',
      publishedAt: new Date(),
    };
  }

  /**
   * Mock upload image to WordPress
   */
  async uploadImageToWordPress(
    imageBuffer: Buffer, 
    filename: string, 
    altText: string, 
    caption?: string
  ): Promise<{ id: number; url: string; }> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mockId = Math.floor(Math.random() * 1000) + 1;
    const mockUrl = `${this.credentials.siteUrl}/wp-content/uploads/mock-${filename}`;
    
    return {
      id: mockId,
      url: mockUrl
    };
  }

  /**
   * Mock get post
   */
  async getPost(postId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      id: parseInt(postId),
      title: { rendered: 'Mock Post Title' },
      content: { rendered: 'Mock post content' },
      link: `${this.credentials.siteUrl}/post-${postId}`,
      status: 'publish'
    };
  }

  /**
   * Mock delete post
   */
  async deletePost(postId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 50));
    logger.info(`🧪 Mock deleting post ${postId}`);
    return true;
  }

  /**
   * Mock get post stats
   */
  async getPostStats(postId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      postId: parseInt(postId),
      views: Math.floor(Math.random() * 1000),
      comments: Math.floor(Math.random() * 10),
      shares: Math.floor(Math.random() * 50)
    };
  }
} 