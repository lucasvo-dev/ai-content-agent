const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface PhotoGalleryImage {
  id: string;
  source_key: string;
  relative_path: string;
  folder_name: string;
  category: string;
  alt_text: string;
  description: string;
  thumbnail_url: string;
  full_url: string;
  download_url: string;
  priority: number;
  tags: string[];
  wordpress_ready?: boolean;
  facebook_ready?: boolean;
}

export interface PhotoGalleryCategory {
  id: number | string;
  category_name?: string;
  category_slug?: string;
  description?: string;
  color_code?: string;
  folder_count?: number;
  // fallback keys from gallery API
  name?: string;
  slug?: string;
  count?: number;
}

export interface PhotoGalleryFolder {
  folder_name: string;
  folder_path: string;
  category_name: string;
  category_slug: string;
  featured_count: number;
  total_images: number;
}

class PhotoGalleryAPI {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async getCategories(): Promise<PhotoGalleryCategory[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/link-content/image-categories`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch categories');
      }
      
      return result.data.categories;
    } catch (error) {
      console.error('Failed to fetch gallery categories:', error);
      throw error;
    }
  }

  async getFoldersByCategory(categorySlug: string): Promise<PhotoGalleryFolder[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/link-content/image-folders/${categorySlug}`,
        {
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch folders');
      }
      
      return result.data.folders;
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      throw error;
    }
  }

  async getFeaturedImages(options: {
    categorySlug?: string;
    folderName?: string;
    limit?: number;
    format?: string;
    consistentFolder?: boolean;
  }): Promise<PhotoGalleryImage[]> {
    try {
      const params = new URLSearchParams({
        ...(options.categorySlug && { category: options.categorySlug }),
        ...(options.folderName && { folderName: options.folderName }),
        limit: (options.limit || 5).toString(),
        format: options.format || 'wordpress',
        consistentFolder: (options.consistentFolder !== false).toString(),
      });

      const response = await fetch(
        `${API_BASE_URL}/api/v1/link-content/preview-images?${params}`,
        {
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch images');
      }
      
      return result.data.images;
    } catch (error) {
      console.error('Failed to fetch featured images:', error);
      throw error;
    }
  }

  async generateEnhancedContent(request: any): Promise<any> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/link-content/generate-enhanced`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ request })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to generate enhanced content');
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to generate enhanced content:', error);
      throw error;
    }
  }
}

export const photoGalleryApi = new PhotoGalleryAPI(); 