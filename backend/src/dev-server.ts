// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { HybridAIService } from './services/HybridAIService.js';
import { LinkContentController } from './controllers/LinkContentController.js';
import { WordPressMultiSiteController } from './controllers/WordPressMultiSiteController.js';
import { PhotoGalleryService } from './services/PhotoGalleryService.js';
import { logger } from './utils/logger.js';
import { WordPressMultiSiteService } from './services/WordPressMultiSiteService.js';
import axios from 'axios';
import { ContentController } from './controllers/ContentController.js';
import type { ContentGenerationRequestType } from './types/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
  credentials: true,
}));

app.use(express.json());

// Initialize services
const aiService = new HybridAIService();
// Use real PhotoGalleryService configuration (defaults to PHOTO_GALLERY_API_URL env)
const photoGalleryService = new PhotoGalleryService();
const linkContentController = new LinkContentController();
const wordpressMultiSiteController = new WordPressMultiSiteController();

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: '1.0.0',
    environment: 'development'
  });
});

// AI health check endpoint
app.get('/api/v1/ai/health', async (req, res) => {
  try {
    const availableProviders = aiService.getAvailableProviders();
    const stats = await aiService.getUsageStats();
    
    res.json({
      success: true,
      aiService: {
        status: 'ready',
        currentProvider: 'hybrid',
        availableProviders: availableProviders,
        strategy: 'Intelligent cost optimization',
        limits: {
          requestsPerMinute: 60,
          requestsPerDay: 1000
        }
      },
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'AI service health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// AI models endpoint
app.get('/api/v1/ai/models', (req, res) => {
  const availableProviders = aiService.getAvailableProviders();
  
  const models = [];
  
  // Check if OpenAI is available
  const hasOpenAI = availableProviders.some(p => p.provider === 'openai' && p.available);
  if (hasOpenAI) {
    models.push({
      id: 'gpt-4-turbo-preview',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      status: 'available',
      cost: '$0.01-0.03 per generation',
      description: 'Premium quality, best for complex content'
    });
  }
  
  // Check if Gemini is available
  const hasGemini = availableProviders.some(p => p.provider === 'gemini' && p.available);
  if (hasGemini) {
    models.push({
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'gemini',
      status: 'available',
      cost: 'Free (1,500 requests/day)',
      description: 'Fast generation, good for simple content'
    });
  }

  res.json({
    success: true,
    data: {
      models
    }
  });
});

// AI templates endpoint
app.get('/api/v1/ai/templates', (req, res) => {
  const templates = [
    {
      id: 'blog-post-template',
      name: 'Blog Post Template',
      type: 'blog_post',
      description: 'Professional blog post with SEO optimization'
    },
    {
      id: 'social-media-template',
      name: 'Social Media Template',
      type: 'social_media',
      description: 'Engaging social media content'
    },
    {
      id: 'email-template',
      name: 'Email Template',
      type: 'email',
      description: 'Professional email content'
    }
  ];

  res.json({
    success: true,
    data: {
      templates
    }
  });
});

// AI content generation endpoint
app.post('/api/v1/ai/generate', async (req, res) => {
  try {
    const request: ContentGenerationRequestType = req.body;
    
    console.log('🎯 Content generation request:', {
      type: request.type,
      topic: request.topic,
      provider: request.preferredProvider || 'auto'
    });

    const content = await aiService.generateContent(request);
    
    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('❌ Content generation failed:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Content generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// AI stats endpoint
app.get('/api/v1/ai/stats', async (req, res) => {
  try {
    const stats = await aiService.getUsageStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch AI stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Link-based content endpoints
app.post('/api/v1/link-content/batch', linkContentController.createBatchJob);
app.get('/api/v1/link-content/batch/:jobId', linkContentController.getBatchJobStatus);
app.post('/api/v1/link-content/batch/:jobId/crawl', linkContentController.startCrawling);
app.post('/api/v1/link-content/batch/:jobId/generate', linkContentController.generateContent);
app.post('/api/v1/link-content/batch/:jobId/items/:itemId/approve', linkContentController.approveContentItem);
app.post('/api/v1/link-content/batch/:jobId/items/:itemId/regenerate', linkContentController.regenerateContent);
app.get('/api/v1/link-content/batch/:jobId/approved', linkContentController.getApprovedContent);
app.post('/api/v1/link-content/test-scrape', linkContentController.testScrape);
app.get('/api/v1/link-content/health', linkContentController.healthCheck);

// Enhanced content generation endpoint
app.post('/api/v1/link-content/generate-enhanced', async (req, res) => {
  try {
    console.log('🎯 Enhanced content generation request:', req.body);
    
    // Frontend sends { request: {...} }, so we need to extract the request
    const requestData = req.body.request || req.body;
    
    // Transform request to match HybridAIService expectations
    const transformedRequest = {
      type: requestData.type || 'blog_post',
      topic: requestData.topic,
      targetAudience: requestData.targetAudience,
      keywords: requestData.keywords || [],
      brandVoice: requestData.brandVoice || {
        tone: requestData.tone || 'professional',
        style: 'conversational',
        vocabulary: 'industry-specific',
        length: 'detailed'
      },
      context: requestData.context,
      preferredProvider: requestData.preferredProvider || 'auto',
      imageSettings: requestData.imageSettings
    };
    
    console.log('🔄 Transformed request:', JSON.stringify(transformedRequest, null, 2));
    
    // Call AI service with transformed request
    const content = await aiService.generateContent(transformedRequest);
    
    // Enhanced: Process and insert images if requested
    let finalContent = content;
    if (requestData.imageSettings?.includeImages) {
      try {
        console.log('🖼️ Processing images for enhanced content...');
        finalContent = await insertImagesIntoContent(content, requestData.imageSettings);
      } catch (imageError) {
        console.warn('⚠️ Image processing failed, proceeding without images:', imageError);
        // Don't fail the entire generation, just proceed without images
      }
    }
    
    res.json({
      success: true,
      data: finalContent,
      enhanced: true,
      withImages: !!(requestData.imageSettings?.includeImages),
      message: 'Enhanced content generated successfully'
    });
  } catch (error) {
    console.error('❌ Enhanced content generation failed:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Enhanced content generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Image Gallery endpoints (delegate to LinkContentController for real data)
app.get('/api/v1/link-content/image-categories', linkContentController.getImageCategories);
app.get('/api/v1/link-content/image-folders/:categorySlug', linkContentController.getImageFolders);
app.get('/api/v1/link-content/preview-images', linkContentController.previewImages);

// WordPress Multi-Site endpoints
app.get('/api/v1/wordpress-multisite/sites', wordpressMultiSiteController.getSites);
app.get('/api/v1/wordpress-multisite/sites/:siteId', wordpressMultiSiteController.getSite);
app.put('/api/v1/wordpress-multisite/sites/:siteId', wordpressMultiSiteController.updateSiteConfig);
app.post('/api/v1/wordpress-multisite/test-connections', wordpressMultiSiteController.testConnections);
app.post('/api/v1/wordpress-multisite/smart-publish', wordpressMultiSiteController.smartPublish);
app.post('/api/v1/wordpress-multisite/cross-post', wordpressMultiSiteController.crossPost);
app.post('/api/v1/wordpress-multisite/preview-routing', wordpressMultiSiteController.previewRouting);
app.get('/api/v1/wordpress-multisite/stats', wordpressMultiSiteController.getPublishingStats);
app.get('/api/v1/wordpress-multisite/routing-rules', wordpressMultiSiteController.getRoutingRules);
app.post('/api/v1/wordpress-multisite/bulk', wordpressMultiSiteController.bulkOperations);
app.get('/api/v1/wordpress-multisite/health', wordpressMultiSiteController.healthCheck);

// WordPress sites endpoints - Mock data for development
app.get('/api/v1/wordpress-sites/available-for-publishing', (req, res) => {
  res.json({
    success: true,
    data: {
      sites: [
        {
          id: 'site_1',
          name: 'My WordPress Blog',
          url: 'https://myblog.com',
          isActive: true,
          lastTested: new Date().toISOString()
        },
        {
          id: 'site_2',
          name: 'Tech News Site',
          url: 'https://technews.example.com',
          isActive: true,
          lastTested: new Date().toISOString()
        }
      ]
    },
    message: 'Mock WordPress sites for development'
  });
});

/**
 * Enhanced function to insert images into generated content using placeholders
 */
async function insertImagesIntoContent(content: any, imageSettings: any): Promise<any> {
  try {
    const placeholder = '[INSERT_IMAGE]';
    const body: string = content.body || '';

    // 1. Count placeholders to determine how many images are needed
    const requiredImages = (body.match(new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;
    
    if (requiredImages === 0) {
      console.log('✅ No image placeholders found. Skipping image insertion.');
      return content;
    }

    console.log(`🖼️ Found ${requiredImages} image placeholders. Fetching images...`);

    // 2. Fetch images using the PhotoGalleryService with enhanced options
    let selectedImages: string[] = [];
    console.log('🔍 Image Selection Details:', JSON.stringify(imageSettings, null, 2));
    
    const imageOptions = {
      ensureAlbumConsistency: imageSettings.ensureAlbumConsistency || false,
      preferPortrait: imageSettings.preferPortrait || false,
      categorySlug: imageSettings.imageCategory
    };
    
    if ((imageSettings.imageSelection === 'folder' || imageSettings.imageSelection === 'specific-folder') && imageSettings.specificFolder) {
      console.log(`📁 Using specific folder: ${imageSettings.specificFolder}`);
      console.log(`🎯 Options: Album consistency: ${imageOptions.ensureAlbumConsistency}, Portrait: ${imageOptions.preferPortrait}`);
      selectedImages = await photoGalleryService.getImagesFromFolder(
        imageSettings.specificFolder, 
        requiredImages,
        {
          categorySlug: imageOptions.categorySlug,
          preferPortrait: imageOptions.preferPortrait
        }
      );
    } else if ((imageSettings.imageSelection === 'category' || imageSettings.imageSelection === 'auto-category') && imageSettings.imageCategory) {
      console.log(`📂 Using category: ${imageSettings.imageCategory}`);
      console.log(`🎯 Options: Album consistency: ${imageOptions.ensureAlbumConsistency}, Portrait: ${imageOptions.preferPortrait}`);
      selectedImages = await photoGalleryService.getImagesByCategory(
        imageSettings.imageCategory, 
        requiredImages,
        {
          ensureAlbumConsistency: imageOptions.ensureAlbumConsistency,
          preferPortrait: imageOptions.preferPortrait
        }
      );
    } else {
      console.log('⚠️ No valid category or folder specified. Skipping image selection.');
      console.log('📋 Available options:');
      console.log('  - Set imageCategory to a valid category slug');
      console.log('  - Set specificFolder with a folder path');
      selectedImages = [];
    }

    if (selectedImages.length === 0) {
      console.warn('⚠️ Could not fetch any images. Proceeding without them.');
      // Remove placeholders if no images are found
      const finalBody = body.replace(new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
      return { ...content, body: finalBody };
    }
    
    console.log(`📸 Fetched ${selectedImages.length} images. Starting replacement...`);

    // 3. Replace each placeholder with an image tag
    let enhancedBody = body;
    let imageIndex = 0;
    
    // Use a function with replace to handle multiple occurrences
    enhancedBody = enhancedBody.replace(new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), () => {
      if (imageIndex < selectedImages.length) {
        const imageUrl = selectedImages[imageIndex];
        imageIndex++;
        // Derive fallback original image URL if thumbnail fails
        const fallbackUrl = imageUrl.includes('get_thumbnail')
          ? imageUrl.replace('get_thumbnail', 'get_image').replace(/&size=\d+/i, '')
          : imageUrl;

        const onLoadCheck = `if(this.naturalWidth<500){this.src='${fallbackUrl}';}`;

        const imageHtml = `

<figure class="wp-block-image size-large" style="text-align:center">
  <img src="${imageUrl}" alt="${content.title || 'Content Image'}" style="max-width:750px;height:auto" onerror="this.onerror=null;this.src='${fallbackUrl}';this.style.maxWidth='750px';" onload="${onLoadCheck}" />
  <figcaption>${content.title || 'Beautiful photography by Guu Studio'}</figcaption>
</figure>

`;
        return imageHtml;
      }
      // If we run out of images for some reason, return an empty string
      return ''; 
    });

    console.log(`✅ Successfully inserted ${imageIndex} images into the content.`);

    return {
      ...content,
      body: enhancedBody,
      metadata: {
        ...content.metadata,
        imagesInserted: imageIndex,
        imageUrls: selectedImages.slice(0, imageIndex)
      }
    };

  } catch (error) {
    console.error('❌ Image insertion failed:', error);
    return content; // Return original content on failure
  }
}

// Start server
app.listen(PORT, async () => {
  logger.info(`🚀 Development server running on http://localhost:${PORT}`);
  
  try {
    // Note: This service is initialized but methods are private.
    // To use it, methods would need to be exposed or called from within the class.
    const multiSiteService = new WordPressMultiSiteService();
    // await multiSiteService.initializeSites(); // This is private
    logger.info('WordPressMultiSiteService instance created.');
  } catch (error) {
    logger.error('Failed to instantiate WordPressMultiSiteService:', error);
  }
}); 