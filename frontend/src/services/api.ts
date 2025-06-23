import axios from 'axios';
import type { 
  ApiResponse, 
  ContentGenerationRequest, 
  GeneratedContent, 
  AIModel, 
  ContentTemplate, 
  AIStats, 
  HealthStatus,
  // New types for link-based content
  BatchJob,
  CreateBatchJobRequest,
  BatchJobStatus,
  ContentWorkflowItem,
  WordPressSite,
  WordPressSiteConfig,
  TestConnectionRequest,
  TestConnectionResponse
} from '../types/api';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  getTemplates: async (): Promise<ContentTemplate[]> => {
    const response = await api.get<ApiResponse<{ templates: ContentTemplate[] }>>('/ai/templates');
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch templates');
    }
    return response.data.data!.templates;
  },

  getStats: async (): Promise<AIStats> => {
    const response = await api.get<ApiResponse<AIStats>>('/ai/stats');
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch AI stats');
    }
    return response.data.data!;
  },

  analyzeContent: async (contentId: string): Promise<any> => {
    const response = await api.post<ApiResponse>(`/ai/analyze/${contentId}`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Content analysis failed');
    }
    return response.data.data;
  },

  regenerateContent: async (contentId: string, params?: any): Promise<GeneratedContent> => {
    const response = await api.post<ApiResponse<GeneratedContent>>(`/ai/regenerate/${contentId}`, params);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Content regeneration failed');
    }
    return response.data.data!;
  },
};

// Test API
export const testApi = {
  getTestInfo: async (): Promise<any> => {
    const response = await api.get('/test');
    return response.data;
  },
};

// Link-Based Content Batch Processing
export interface CreateBatchJobRequest {
  projectId: string;
  urls: string[];
  settings: {
    contentType: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
    brandVoice: {
      tone: 'professional' | 'casual' | 'friendly' | 'authoritative';
      style: 'formal' | 'conversational' | 'technical' | 'creative';
      vocabulary: 'simple' | 'advanced' | 'industry-specific';
      length: 'concise' | 'detailed' | 'comprehensive';
    };
    targetAudience: string;
    preferredProvider?: 'openai' | 'gemini' | 'auto';
  };
}

export interface BatchJob {
  id: string;
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    crawled: number;
    generated: number;
    failed: number;
  };
  settings: any;
  createdAt: string;
  updatedAt: string;
}

export interface ContentWorkflowItem {
  id: string;
  sourceUrl: string;
  status: 'pending' | 'crawling' | 'crawled' | 'generating' | 'generated' | 'approved' | 'failed';
  scrapedContent?: {
    title: string;
    content: string;
    wordCount: number;
    qualityScore: number;
    metadata: any;
    scrapedAt: string;
  };
  generatedContent?: {
    title: string;
    body: string;
    excerpt: string;
    metadata: any;
    qualityScore: number;
    seoTitle: string;
    seoDescription: string;
    keywords: string[];
    wordCount: number;
    aiProvider: string;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchJobStatus {
  job: BatchJob;
  items: ContentWorkflowItem[];
  summary: {
    total: number;
    pending: number;
    crawling: number;
    crawled: number;
    generating: number;
    generated: number;
    approved: number;
    failed: number;
  };
}

// Link-Based Content API endpoints
export const linkContentApi = {
  // Create a new batch job
  createBatchJob: async (request: CreateBatchJobRequest): Promise<BatchJob> => {
    const response = await api.post<ApiResponse<BatchJob>>('/link-content/batch', request);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to create batch job');
    }
    return response.data.data!;
  },

  // Get batch job status with items
  getBatchJobStatus: async (jobId: string): Promise<BatchJobStatus> => {
    const response = await api.get<ApiResponse<BatchJobStatus>>(`/link-content/batch/${jobId}`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get batch job status');
    }
    return response.data.data!;
  },

  // Start crawling URLs in batch job
  startCrawling: async (jobId: string): Promise<void> => {
    const response = await api.post<ApiResponse<void>>(`/link-content/batch/${jobId}/crawl`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to start crawling');
    }
  },

  // Generate AI content for batch job
  generateContent: async (jobId: string): Promise<void> => {
    const response = await api.post<ApiResponse<void>>(`/link-content/batch/${jobId}/generate`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to generate content');
    }
  },

  // Generate AI content for batch job with enhanced settings
  generateBatchContent: async (request: { batchId: string; settings: any }): Promise<void> => {
    const response = await api.post<ApiResponse<void>>(`/link-content/batch/${request.batchId}/generate-content`, {
      settings: request.settings
    });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to generate batch content');
    }
  },

  // Approve content item
  approveContentItem: async (jobId: string, itemId: string): Promise<void> => {
    const response = await api.post<ApiResponse<void>>(`/link-content/batch/${jobId}/items/${itemId}/approve`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to approve content item');
    }
  },

  // Regenerate content for item
  regenerateContent: async (jobId: string, itemId: string): Promise<void> => {
    const response = await api.post<ApiResponse<void>>(`/link-content/batch/${jobId}/items/${itemId}/regenerate`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to regenerate content');
    }
  },

  // Get approved content items
  getApprovedContent: async (jobId: string): Promise<{ items: ContentWorkflowItem[]; count: number }> => {
    const response = await api.get<ApiResponse<{ items: ContentWorkflowItem[]; count: number }>>(`/link-content/batch/${jobId}/approved`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get approved content');
    }
    return response.data.data!;
  },

  // Test scrape single URL
  testScrape: async (url: string): Promise<any> => {
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

  // Health check
  healthCheck: async (): Promise<any> => {
    const response = await api.get<ApiResponse<any>>('/link-content/health');
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Health check failed');
    }
    return response.data.data!;
  }
};

// WordPress Sites API
export const wordPressSitesApi = {
  // Add WordPress site
  addSite: async (config: WordPressSiteConfig): Promise<WordPressSite> => {
    const response = await api.post<ApiResponse<WordPressSite>>('/wordpress-sites', config);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to add WordPress site');
    }
    return response.data.data!;
  },

  // Get user's WordPress sites
  getSites: async (): Promise<WordPressSite[]> => {
    const response = await api.get<ApiResponse<{ sites: WordPressSite[] }>>('/wordpress-sites');
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get WordPress sites');
    }
    return response.data.data!.sites;
  },

  // Test WordPress connection
  testConnection: async (request: TestConnectionRequest): Promise<TestConnectionResponse> => {
    const response = await api.post<ApiResponse<TestConnectionResponse>>('/wordpress-sites/test-connection', request);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Connection test failed');
    }
    return response.data.data!;
  },

  // Get available sites for publishing
  getAvailableSites: async (): Promise<WordPressSite[]> => {
    const response = await api.get<ApiResponse<{ sites: WordPressSite[] }>>('/wordpress-sites/available-for-publishing');
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to get available sites');
    }
    return response.data.data!.sites;
  },
};

export default api; 