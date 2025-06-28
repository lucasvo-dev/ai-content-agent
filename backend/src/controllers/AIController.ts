import { Request, Response } from 'express';
import { HybridAIService } from '../services/HybridAIService.js';
import type { ContentGenerationRequest } from '../types/index.js';

export class AIController {
  private aiService: HybridAIService;

  constructor() {
    this.aiService = new HybridAIService();
  }

  // Health check for AI service
  async checkHealth(req: Request, res: Response): Promise<void> {
    try {
      console.log('📞 AI Health endpoint called');
      
      const availableProviders = this.aiService.getAvailableProviders();
      const currentProvider = this.aiService.getCurrentProvider();
      
      const healthStatus = {
        success: true,
        message: 'Hybrid AI service is operational',
        timestamp: new Date().toISOString(),
        aiService: {
          status: 'ready',
          currentProvider: currentProvider,
          availableProviders: availableProviders,
          features: [
            'content-generation',
            'content-analysis', 
            'seo-optimization',
            'brand-voice-adaptation',
            'intelligent-provider-selection',
            'cost-optimization'
          ],
          strategy: currentProvider === 'hybrid' ? 'Intelligent selection based on complexity' : `Fixed: ${currentProvider}`,
        }
      };

      res.json(healthStatus);
    } catch (error) {
      console.error('AI health check failed:', error);
      res.status(503).json({
        success: false,
        message: 'AI service unavailable',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Health check endpoint
   * GET /api/v1/ai/health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        service: 'AI Content Service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  }

  /**
   * Generate content using AI
   * POST /api/v1/ai/generate
   */
  async generateContent(req: Request, res: Response): Promise<void> {
    try {
      console.log('📞 AI Generate endpoint called');
      console.log('Request body:', JSON.stringify(req.body, null, 2));

      const request: ContentGenerationRequest = req.body;

      // Validate required fields
      if (!request.type || !request.topic || !request.targetAudience || !request.keywords) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: type, topic, targetAudience, keywords',
          },
        });
        return;
      }

      // Generate content using Hybrid AI Service
      const generatedContent = await this.aiService.generateContent(request);

      res.json({
        success: true,
        data: generatedContent,
        message: `Content generated successfully with ${generatedContent.metadata.provider}`,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Content generation failed:', error);
      
      // Parse error details for better user feedback
      const errorMessage = error instanceof Error ? error.message : 'Content generation failed';
      let errorCode = 'AI_GENERATION_ERROR';
      let statusCode = 500;
      let details = '';
      let suggestions: string[] = [];
      
      // Analyze error message for specific issues
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        errorCode = 'QUOTA_EXCEEDED';
        statusCode = 429;
        details = 'AI provider quota has been exceeded';
        suggestions = [
          'Wait a few minutes and try again',
          'Switch to a different AI provider',
          'For OpenAI: Check your billing and add credits',
          'For Gemini: Wait until quota resets (daily limit: 1,500 requests)'
        ];
      } else if (errorMessage.includes('rate limit')) {
        errorCode = 'RATE_LIMITED';
        statusCode = 429;
        details = 'Too many requests in a short time';
        suggestions = [
          'Wait 1-2 minutes before trying again',
          'Reduce the frequency of requests'
        ];
      } else if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
        errorCode = 'AUTH_ERROR';
        statusCode = 401;
        details = 'AI provider authentication failed';
        suggestions = [
          'Check your API keys in environment variables',
          'Ensure API keys are valid and active'
        ];
      } else if (errorMessage.includes('timeout')) {
        errorCode = 'TIMEOUT_ERROR';
        statusCode = 504;
        details = 'Request timed out';
        suggestions = [
          'Try again with a shorter content request',
          'Check your internet connection'
        ];
      } else if (errorMessage.includes('No AI providers available')) {
        errorCode = 'NO_PROVIDERS';
        statusCode = 503;
        details = 'No AI providers are configured or available';
        suggestions = [
          'Check your environment variables for API keys',
          'Ensure at least one AI provider is configured'
        ];
      }
      
      // Extract provider-specific error info
      const providerErrors: any = {};
      if (errorMessage.includes('Primary') && errorMessage.includes('Alternative')) {
        const primaryMatch = errorMessage.match(/Primary \(([^)]+)\): ([^.]+)/);
        const altMatch = errorMessage.match(/Alternative \(([^)]+)\): ([^.]+)/);
        
        if (primaryMatch) {
          providerErrors[primaryMatch[1]] = primaryMatch[2].trim();
        }
        if (altMatch) {
          providerErrors[altMatch[1]] = altMatch[2].trim();
        }
      }
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: 'Content generation failed',
          details: details || errorMessage,
          providerErrors: Object.keys(providerErrors).length > 0 ? providerErrors : undefined,
          suggestions,
          canRetry: errorCode === 'RATE_LIMITED' || errorCode === 'TIMEOUT_ERROR',
          retryAfter: errorCode === 'RATE_LIMITED' ? 60 : undefined, // seconds
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Analyze existing content
   * POST /api/v1/ai/analyze/:contentId
   */
  async analyzeContent(req: Request, res: Response): Promise<void> {
    try {
      console.log('📞 AI Analyze endpoint called');
      
      const { contentId } = req.params;
      
      if (!contentId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Content ID is required',
          },
        });
        return;
      }

      const analysis = await this.aiService.analyzeContent(contentId);

      res.json({
        success: true,
        data: analysis,
        message: 'Content analysis completed',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Content analysis failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AI_ANALYSIS_ERROR',
          message: error instanceof Error ? error.message : 'Content analysis failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get AI models and capabilities
   * GET /api/v1/ai/models
   */
  async getModels(req: Request, res: Response): Promise<void> {
    try {
      console.log('📞 AI Models endpoint called');
      
      const models = await this.aiService.getAvailableModels();

      res.json({
        success: true,
        data: { models },
        message: 'AI models retrieved successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Failed to get AI models:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AI_MODELS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve AI models',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get content generation templates
   * GET /api/v1/ai/templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      console.log('📞 AI Templates endpoint called');
      
      const templates = [
        {
          id: 'blog-post-template-1',
          name: 'Marketing Blog Post',
          type: 'blog_post',
          description: 'Template for marketing-focused blog posts with AI optimization',
          structure: {
            sections: ['introduction', 'main-points', 'conclusion', 'cta'],
            requiredElements: ['title', 'meta-description', 'headers'],
          },
          brandVoice: {
            tone: 'professional',
            style: 'conversational',
          },
          provider: 'hybrid',
          model: 'intelligent-selection',
        },
        {
          id: 'social-media-template-1',
          name: 'Engagement Post',
          type: 'social_media',
          description: 'Template for social media engagement posts with emojis and hashtags',
          structure: {
            sections: ['hook', 'content', 'cta'],
            requiredElements: ['hashtags', 'mention'],
          },
          brandVoice: {
            tone: 'casual',
            style: 'friendly',
          },
          provider: 'hybrid',
          model: 'intelligent-selection',
        },
        {
          id: 'email-template-1',
          name: 'Newsletter Template',
          type: 'email',
          description: 'Professional email newsletter template',
          structure: {
            sections: ['subject', 'greeting', 'content', 'cta', 'signature'],
            requiredElements: ['subject-line', 'personalization'],
          },
          brandVoice: {
            tone: 'professional',
            style: 'conversational',
          },
          provider: 'hybrid',
          model: 'intelligent-selection',
        },
        {
          id: 'ad-copy-template-1',
          name: 'Conversion Ad Copy',
          type: 'ad_copy',
          description: 'High-converting advertisement copy template',
          structure: {
            sections: ['headline', 'benefits', 'social-proof', 'cta'],
            requiredElements: ['compelling-headline', 'clear-cta'],
          },
          brandVoice: {
            tone: 'persuasive',
            style: 'direct',
          },
          provider: 'hybrid',
          model: 'intelligent-selection',
        },
      ];

      res.json({
        success: true,
        data: { templates },
        message: 'Content templates retrieved successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Failed to get templates:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TEMPLATES_ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve templates',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get AI usage statistics
   * GET /api/v1/ai/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      console.log('📞 AI Stats endpoint called');
      
      const stats = await this.aiService.getUsageStats();

      res.json({
        success: true,
        data: stats,
        message: 'AI usage statistics retrieved successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Failed to get AI stats:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AI_STATS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve AI statistics',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Regenerate content with new parameters
   * POST /api/v1/ai/regenerate
   */
  async regenerateContent(req: Request, res: Response): Promise<void> {
    try {
      console.log('📞 AI Regenerate endpoint called');
      
      const regenerationParams = req.body;

      // Validate required fields
      if (!regenerationParams.type || !regenerationParams.topic) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: type, topic',
          },
        });
        return;
      }

      // Create a new generation request with updated parameters
      const request: ContentGenerationRequest = {
        type: regenerationParams.type,
        topic: regenerationParams.topic,
        targetAudience: regenerationParams.targetAudience || 'General audience',
        keywords: regenerationParams.keywords || [],
        brandVoice: regenerationParams.brandVoice || {
          tone: 'professional',
          style: 'conversational',
          vocabulary: 'simple',
          length: 'medium'
        },
        context: regenerationParams.context,
        preferredProvider: regenerationParams.preferredProvider || 'auto',
        language: regenerationParams.language || 'vietnamese',
        specialInstructions: regenerationParams.specialInstructions || 'Please create fresh, unique content different from previous versions.',
      };

      // Add retry instruction to special instructions
      if (request.specialInstructions) {
        request.specialInstructions += ' This is a regeneration request - please ensure the content is different from previous versions.';
      }

      // Generate new content
      const generatedContent = await this.aiService.generateContent(request);
      
      res.json({
        success: true,
        data: generatedContent,
        message: `Content regenerated successfully with ${generatedContent.metadata.provider}`,
        regenerated: true,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Content regeneration failed:', error);
      
      // Use same error handling as generateContent
      const errorMessage = error instanceof Error ? error.message : 'Content regeneration failed';
      let errorCode = 'AI_REGENERATION_ERROR';
      let statusCode = 500;
      let details = '';
      let suggestions: string[] = [];
      
      // Analyze error message for specific issues
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        errorCode = 'QUOTA_EXCEEDED';
        statusCode = 429;
        details = 'AI provider quota has been exceeded';
        suggestions = [
          'Wait a few minutes and try again',
          'Try switching to a different AI provider in the request',
          'For OpenAI: Check your billing and add credits',
          'For Gemini: Wait until quota resets (daily limit: 1,500 requests)'
        ];
      } else if (errorMessage.includes('rate limit')) {
        errorCode = 'RATE_LIMITED';
        statusCode = 429;
        details = 'Too many requests in a short time';
        suggestions = [
          'Wait 1-2 minutes before trying again',
          'Reduce the frequency of regeneration requests'
        ];
      }
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: 'Content regeneration failed',
          details: details || errorMessage,
          suggestions,
          canRetry: true,
          retryAfter: errorCode === 'RATE_LIMITED' ? 60 : undefined,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
} 