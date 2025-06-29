import axios from 'axios';
import type { 
  ApiResponse, 
  ContentGenerationRequest, 
  GeneratedContent, 
  AIModel, 
  HealthStatus
} from '../types/api';

// API Configuration
const isProduction = import.meta.env.PROD;
const API_BASE_URL = isProduction 
  ? 'https://be-agent.guustudio.vn' 
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001');

// Cache-busting comment: 2025-06-25 18:08 UTC

// Debug logging for environment variables
console.log('🔧 API Configuration Debug:');
console.log('  VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('  API_BASE_URL:', API_BASE_URL);
console.log('  Environment:', import.meta.env.MODE);

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000, // 30 seconds for regular API calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate API instance for AI generation with longer timeout
const aiGenerationApi = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 120000, // 2 minutes for AI generation
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate API instance for web scraping with longer timeout
const scrapingApi = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 60000, // 60 seconds for web scraping
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate API instance for WordPress publishing with extended timeout
const publishingApi = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 90000, // 90 seconds for WordPress publishing (image uploads can be slow)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens (future)
api.interceptors.request.use((config) => {
  // Add auth token when available
  // const token = localStorage.getItem('authToken');
  // if (token) {
  //   config.headers.Authorization = `Bearer ${token}`;
  // }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Health Check API
export const healthApi = {
  checkHealth: async (): Promise<HealthStatus> => {
    const response = await api.get<HealthStatus>('/health');
    return response.data;
  },

  checkAIHealth: async (): Promise<HealthStatus> => {
    const response = await api.get<HealthStatus>('/ai/health');
    return response.data;
  },
};

// AI Content Generation API
export const aiApi = {
  generateContent: async (request: ContentGenerationRequest): Promise<GeneratedContent> => {
    const response = await aiGenerationApi.post<ApiResponse<GeneratedContent>>('/ai/generate', request);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Content generation failed');
    }
    return response.data.data!;
  },

  getModels: async (): Promise<AIModel[]> => {
    const response = await api.get<ApiResponse<{ models: AIModel[] }>>('/ai/models');
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch AI models');
    }
    return response.data.data!.models;
  },
};

// Link-Based Content API endpoints
export const linkContentApi = {
  // Test scrape single URL
  testScrape: async (url: string): Promise<ApiResponse<{ title: string; content: string; wordCount: number; qualityScore: number }>> => {
    const response = await scrapingApi.post('/link-content/test-scrape', { url });
    
    // Debug response format
    console.log('API Response:', response.data);
    console.log('Response success:', response.data.success);
    console.log('Response data:', response.data.data);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || response.data.message || 'Failed to scrape URL');
    }
    return response.data;
  },

  // Generate enhanced content with images
  generateEnhancedContent: async (request: any): Promise<GeneratedContent> => {
    const response = await aiGenerationApi.post<ApiResponse<GeneratedContent>>('/link-content/generate-enhanced', { request });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Enhanced content generation failed');
    }
    return response.data.data!;
  },

  // Health check
  healthCheck: async (): Promise<{ status: string; message: string }> => {
    const response = await api.get<ApiResponse<{ status: string; message: string }>>('/link-content/health');
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Health check failed');
    }
    return response.data.data!;
  }
};

// Debug function to test API connectivity
export const debugApi = {
  testConnection: async (): Promise<void> => {
    console.log('🧪 Testing API Connection...');
    console.log('  Base URL:', API_BASE_URL);
    console.log('  Full Health URL:', `${API_BASE_URL}/api/v1/health`);
    
    try {
      const response = await api.get('/health');
      console.log('✅ API Connection Success:', response.data);
    } catch (error) {
      console.error('❌ API Connection Failed:', error);
      if (axios.isAxiosError(error)) {
        console.error('  Error Details:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          baseURL: error.config?.baseURL
        });
      }
    }
  }
};

// Auto-test connection when module loads (in development)
if (import.meta.env.MODE === 'development') {
  setTimeout(() => {
    debugApi.testConnection();
  }, 2000);
}

// WordPress Multi-site API
export const wordpressMultiSiteApi = {
  // Get all sites configuration
  getSites: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/wordpress-multisite/sites`);
    if (!response.ok) throw new Error('Failed to fetch sites');
    return response.json();
  },

  // Test all site connections
  testConnections: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/wordpress-multisite/test-connections`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to test connections');
    return response.json();
  },

  // Preview smart routing decision
  previewRouting: async (content: { title: string; content: string }) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/wordpress-multisite/preview-routing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
    if (!response.ok) throw new Error('Failed to preview routing');
    return response.json();
  },

  // Cross-post to multiple sites
  crossPost: async (data: { title: string; content: string; siteIds: string[] }) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/wordpress-multisite/cross-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to cross-post');
    return response.json();
  },

  // Smart publish with auto-routing
  smartPublish: async (data: { 
    title: string; 
    content: string; 
    targetSiteId?: string;
    status?: 'publish' | 'draft' | 'pending';
    categories?: string[];
    tags?: string[];
    contentType?: string;
    featuredImageUrl?: string;
    metadata?: any;
  }) => {
    console.log('🚀 Smart publish API called with:', data);
    
    // Using publishingApi instance with extended timeout for WordPress operations
    const response = await publishingApi.post<ApiResponse<{
      url: string;
      siteName: string;
      postId: number | string;
    }>>('/wordpress-multisite/smart-publish', data);

    console.log('📥 Smart publish API response:', response.data);

    if (!response.data.success) {
      const errorMsg = response.data.error?.message || response.data.message || 'Failed to smart publish';
      throw new Error(errorMsg);
    }
    
    return response.data; // The whole data object is returned now { success, message, url, siteName, postId }
  },

  // Get publishing statistics
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/wordpress-multisite/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  // Check service health
  checkHealth: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/wordpress-multisite/health`);
    if (!response.ok) throw new Error('Failed to check health');
    return response.json();
  },
};

export default api; 