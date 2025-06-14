import axios from 'axios';
import type { 
  ApiResponse, 
  ContentGenerationRequest, 
  GeneratedContent, 
  AIModel, 
  ContentTemplate, 
  AIStats, 
  HealthStatus 
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

export default api; 