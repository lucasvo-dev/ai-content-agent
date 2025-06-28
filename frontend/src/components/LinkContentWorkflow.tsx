import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  GlobeAltIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ClockIcon,
  TrashIcon,
  PlusIcon,
  CogIcon,
  SparklesIcon,
  EyeIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';

import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';
import { linkContentApi, aiApi, wordpressMultiSiteApi } from '../services/api';
import { photoGalleryApi, type PhotoGalleryCategory } from '../services/photoGalleryApi';

// ENHANCED: 4-step workflow with management
const getWorkflowSteps = () => [
  { id: 'urls', title: 'URLs & Crawler', icon: GlobeAltIcon, description: 'Input URLs and crawl content' },
  { id: 'settings', title: 'Content Settings', icon: CogIcon, description: 'Configure AI generation settings' },
  { id: 'generation', title: 'Generate & Review', icon: SparklesIcon, description: 'Generate and review content' },
  { id: 'management', title: 'Content Management', icon: ChartBarIcon, description: 'Manage approved content & auto-generation' },
];

// Simplified URL Item interface
interface URLItem {
  id: string;
  url: string;
  status: 'pending' | 'crawling' | 'crawled' | 'failed';
  crawledContent?: {
    title: string;
    content: string;
    wordCount: number;
    qualityScore: number;
  };
  errorMessage?: string;
}

// Simplified LLM Settings interface based on best practices
interface LLMSettings {
  contentType: 'wordpress_blog' | 'facebook_post';
  preferredProvider: 'auto' | 'openai' | 'gemini' | 'claude';
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative';
  language: 'vietnamese' | 'english';
  targetAudience: string;
  brandName: string;
  keywords: string;
  specialRequest: string;
  wordCount: number; // Add word count
  // Image settings
  includeImages: boolean;
  imageSelection: 'category' | 'folder';
  imageCategory: string;
  specificFolder: string;
  folderSuggestions?: string[];
  maxImages: number | 'auto';
  ensureConsistency: boolean;
  ensureAlbumConsistency: boolean; // NEW: Đảm bảo ảnh từ cùng 1 album
  preferPortrait: boolean; // NEW: Ưu tiên ảnh chân dung
  // WordPress Multi-site settings  
  wordpressSiteTarget?: 'wedding' | 'yearbook' | 'general';
}

// Generated content interface
interface GeneratedContentItem {
  id: string;
  sourceUrl: string;
  title: string;
  body: string;
  status: 'generating' | 'generated' | 'approved' | 'failed' | 'queued' | 'published';
  metadata?: {
    qualityScore: number;
    wordCount: number;
    aiModel?: string;
  };
  publishedAt?: string;
  publishedUrl?: string;
  publishedSite?: string; // Thêm thông tin site đã publish
}

export function LinkContentWorkflow() {
  // Core state
  const [currentStep, setCurrentStep] = useState(0);
  const [urlItems, setUrlItems] = useState<URLItem[]>([{ id: '1', url: '', status: 'pending' }]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentItem[]>([]);
  const [previewContent, setPreviewContent] = useState<GeneratedContentItem | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Simplified settings with defaults
  const [llmSettings, setLlmSettings] = useState<LLMSettings>({
    contentType: 'wordpress_blog',
    preferredProvider: 'auto',
    tone: 'professional',
    language: 'vietnamese',
    targetAudience: '',
    brandName: '',
    keywords: '',
    specialRequest: '',
    wordCount: 1200, // Default word count
    // Image settings
    includeImages: true,
    imageSelection: 'category',
    imageCategory: '',
    specificFolder: '',
    folderSuggestions: [],
    maxImages: 'auto',
    ensureConsistency: true,
    ensureAlbumConsistency: false, // NEW: Default false
    preferPortrait: false, // NEW: Default false
    // WordPress Multi-site settings
    wordpressSiteTarget: 'wedding',
  });

  // Get crawled items
  const crawledItems = urlItems.filter(item => item.status === 'crawled');
  const WORKFLOW_STEPS = getWorkflowSteps();
  const totalProgress = ((currentStep + 1) / WORKFLOW_STEPS.length) * 100;

  // Get approved content count for fine-tuning progress (riêng cho từng WordPress site)
  const getApprovedContentStats = () => {
    try {
      const currentSite = llmSettings.wordpressSiteTarget || 'auto';
      const approvedContentBySite = JSON.parse(localStorage.getItem('approvedContentBySite') || '{}');
      const siteApprovedContent = approvedContentBySite[currentSite] || [];
      
      console.log(`📊 Approved content for site "${currentSite}":`, siteApprovedContent);
      
      // Ensure we have an array
      const validApprovedContent = Array.isArray(siteApprovedContent) ? siteApprovedContent : [];
      
      return {
        totalApproved: validApprovedContent.length,
        readyForFineTuning: validApprovedContent.length >= 10, // Need 10+ approvals for fine-tuning
        progress: Math.min(validApprovedContent.length / 10 * 100, 100),
        currentSite: currentSite
      };
    } catch (error) {
      console.error('Error reading approved content:', error);
      return {
        totalApproved: 0,
        readyForFineTuning: false,
        progress: 0,
        currentSite: llmSettings.wordpressSiteTarget || 'auto'
      };
    }
  };

  const approvedStats = getApprovedContentStats();

  // Debug function to clear localStorage (cho site hiện tại)
  const clearApprovedContent = () => {
    const currentSite = llmSettings.wordpressSiteTarget || 'auto';
    try {
      const approvedContentBySite = JSON.parse(localStorage.getItem('approvedContentBySite') || '{}');
      delete approvedContentBySite[currentSite];
      localStorage.setItem('approvedContentBySite', JSON.stringify(approvedContentBySite));
      
      console.log(`🗑️ Cleared approved content for site "${currentSite}"`);
      toast.success(`Approved content cleared for ${currentSite} site`);
    } catch (error) {
      console.error('Error clearing approved content:', error);
      toast.error('Failed to clear approved content');
    }
    // Force re-render by updating state
    setGeneratedContent(prev => [...prev]);
  };

  // URL management functions
  const handleUrlChange = (id: string, url: string) => {
    setUrlItems(prev => prev.map(item => 
      item.id === id ? { ...item, url, status: 'pending' as const } : item
    ));
  };

  const addUrlField = () => {
    const newId = Date.now().toString();
    setUrlItems(prev => [...prev, { id: newId, url: '', status: 'pending' }]);
  };

  const removeUrlItem = (id: string) => {
    if (urlItems.length > 1) {
      setUrlItems(prev => prev.filter(item => item.id !== id));
    }
  };

  // URL crawling - immediate crawling without batch step
  const handleCrawlUrl = async (urlId: string) => {
    const urlItem = urlItems.find(item => item.id === urlId);
    if (!urlItem || !urlItem.url.trim()) return;

    setUrlItems(prev => prev.map(item => 
      item.id === urlId 
        ? { ...item, status: 'crawling' as const, errorMessage: undefined }
        : item
    ));

    try {
      const result = await linkContentApi.testScrape(urlItem.url);

      if (result.success && result.data) {
        setUrlItems(prev => prev.map(item => 
          item.id === urlId 
            ? { ...item, status: 'crawled' as const, crawledContent: result.data }
            : item
        ));
        toast.success(`Successfully crawled: ${result.data.title}`);
      } else {
        throw new Error(result.message || 'Failed to crawl URL');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Crawling failed';
      setUrlItems(prev => prev.map(item => 
        item.id === urlId 
          ? { ...item, status: 'failed' as const, errorMessage }
          : item
      ));
      toast.error(`Failed to crawl: ${urlItem.url}`);
    }
  };

  // REAL AI Integration - Call actual API like ContentGenerator
  const generateContentWithSettings = async (
    sourceItem: URLItem, 
    settings: LLMSettings,
    retryCount: number = 0
  ): Promise<{
    title: string;
    body: string;
    sourceUrl: string;
    metadata?: {
      sourceTitle: string;
      settings: LLMSettings;
      wordCount?: number;
      qualityScore?: number;
      aiModel?: string;
      retryCount?: number;
    };
  }> => {
    console.log('📝 generateContentWithSettings called with:', {
      sourceUrl: sourceItem.url,
      settings: settings,
      imageSettings: {
        includeImages: settings.includeImages,
        imageCategory: settings.imageCategory,
        ensureAlbumConsistency: settings.ensureAlbumConsistency
      }
    });
    const maxRetries = 2; // Allow up to 2 retries
    const sourceContent = sourceItem.crawledContent?.content || '';
    const sourceTitle = sourceItem.crawledContent?.title || 'Untitled';
    const sourceUrl = sourceItem.url;

    const {
      contentType, 
      tone, 
      targetAudience, 
      brandName, 
      keywords, 
    } = settings;

    try {
      // The request object now sends raw data, not a pre-built prompt.
      // The backend's HybridAIService will be responsible for building the prompt.
      const request = {
        type: contentType === 'wordpress_blog' ? 'blog_post' as const : 'social_media' as const, 
        topic: sourceTitle,
        context: sourceContent, // Send the raw crawled content as context
        targetAudience: targetAudience,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        brandVoice: {
          tone: tone,
          style: 'conversational' as const,
          vocabulary: 'industry-specific' as const,
          length: 'detailed' as const,
          brandName: brandName,
        },
        preferredProvider: settings.preferredProvider,
        wordCount: settings.wordCount, // Pass word count
        imageSettings: settings.includeImages ? {
          includeImages: settings.includeImages,
          imageSelection: settings.imageSelection,
          imageCategory: settings.imageCategory,
          specificFolder: settings.specificFolder,
          maxImages: settings.maxImages,
          ensureConsistency: settings.ensureConsistency,
          ensureAlbumConsistency: settings.ensureAlbumConsistency,
          preferPortrait: settings.preferPortrait,
        } : undefined,
        // Pass language and special request directly
        language: settings.language,
        specialInstructions: settings.specialRequest,
      };

      console.log(`🚀 Calling AI API (attempt ${retryCount + 1}/${maxRetries + 1}):`, { 
        provider: request.preferredProvider,
        topic: request.topic,
        retryCount 
      });

      // Add client-side timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout after 90 seconds'));
        }, 90000); // 90 second client timeout
      });

      // Use enhanced content generation if images are included
      const generatedContent = settings.includeImages 
        ? await Promise.race([
            linkContentApi.generateEnhancedContent(request),
            timeoutPromise
          ])
        : await Promise.race([
        aiApi.generateContent(request),
        timeoutPromise
      ]);
      
      console.log('✅ AI API response:', {
        title: generatedContent.title?.substring(0, 50),
        wordCount: generatedContent.metadata?.wordCount,
        provider: generatedContent.metadata?.provider,
        model: generatedContent.metadata?.aiModel
      });
      
      return {
        title: generatedContent.title,
        body: generatedContent.body,
        sourceUrl: sourceUrl,
        metadata: {
          sourceTitle: sourceTitle,
          settings: settings,
          wordCount: generatedContent.metadata?.wordCount,
          qualityScore: generatedContent.metadata?.seoScore,
          aiModel: generatedContent.metadata?.aiModel,
          retryCount: retryCount
        }
      };

    } catch (error: any) {
      console.error(`❌ AI API Error (attempt ${retryCount + 1}):`, error);
      
      const errorData = error.response?.data?.error || {};
      const errorMessage = errorData.details || errorData.message || error.message || 'Unknown error';
      
      // Display detailed error info
      if (errorData.providerErrors) {
        console.error('Provider-specific errors:', errorData.providerErrors);
      }
      
      if (errorData.suggestions && errorData.suggestions.length > 0) {
        console.log('Suggestions:', errorData.suggestions);
      }
      
      // Check if we can retry with different provider
      if (errorData.code === 'QUOTA_EXCEEDED' && retryCount < 1) {
        console.log('Quota exceeded, trying with different provider...');
        
        // Switch provider for retry
        const alternativeProvider = settings.preferredProvider === 'openai' ? 'gemini' : 
                                   settings.preferredProvider === 'gemini' ? 'claude' : 'openai';
        const retrySettings = {
          ...settings,
          preferredProvider: alternativeProvider as 'auto' | 'openai' | 'gemini' | 'claude'
        };
        
        // Retry with alternative provider
        return generateContentWithSettings(sourceItem, retrySettings, retryCount + 1);
      }
      
      // Build comprehensive error message
      let detailedError = errorMessage;
      
      if (errorData.code === 'QUOTA_EXCEEDED') {
        detailedError = `AI Quota Exceeded: ${errorMessage}`;
        if (errorData.providerErrors) {
          detailedError += '\n\nProvider Details:';
          Object.entries(errorData.providerErrors).forEach(([provider, err]) => {
            detailedError += `\n- ${provider}: ${err}`;
          });
        }
        if (errorData.suggestions) {
          detailedError += '\n\nSuggestions:';
          errorData.suggestions.forEach((suggestion: string) => {
            detailedError += `\n• ${suggestion}`;
          });
        }
      } else if (errorData.code === 'RATE_LIMITED') {
        detailedError = `Rate Limited: Please wait ${errorData.retryAfter || 60} seconds before trying again.`;
      }
      
      throw new Error(detailedError);
    }
  };

  // Enhanced content generation with real settings application
  const handleGenerateContent = async () => {
    if (crawledItems.length === 0) {
      toast.error('Please crawl at least one URL first');
      return;
    }

    setIsGenerating(true);

    // 1. Initialize the entire queue in the UI
    const initialJobs: GeneratedContentItem[] = crawledItems.map(sourceItem => ({
      id: sourceItem.id, // Use source item ID for stable key
      sourceUrl: sourceItem.url,
      title: sourceItem.crawledContent?.title || 'Queued for generation...',
      body: 'This item is waiting to be processed.',
      status: 'queued' as const,
      metadata: { qualityScore: 0, wordCount: 0 }
    }));
    setGeneratedContent(initialJobs);

    // 2. Process all jobs in parallel, updating UI as each one completes
    const generationPromises = crawledItems.map(sourceItem => {
      // Mark this specific job as 'generating'
      setGeneratedContent(prev => prev.map(job => 
        job.sourceUrl === sourceItem.url ? { ...job, status: 'generating' } : job
      ));

      return generateContentWithSettings(sourceItem, llmSettings)
        .then(generatedData => {
          // Success for this job
          setGeneratedContent(prev => prev.map(item =>
            item.sourceUrl === sourceItem.url ? {
              ...item,
              title: generatedData.title,
              body: generatedData.body,
              status: 'generated' as const,
              metadata: {
                qualityScore: generatedData.metadata?.qualityScore || 0,
                wordCount: generatedData.metadata?.wordCount || 0
              }
            } : item
          ));
          toast.success(`Generated: ${sourceItem.crawledContent?.title}`);
        })
        .catch(error => {
          // Failure for this job
          setGeneratedContent(prev => prev.map(item =>
            item.sourceUrl === sourceItem.url ? {
              ...item,
              title: 'Generation Failed',
              body: `Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`,
              status: 'failed' as const
            } : item
          ));
          toast.error(`Failed for: ${sourceItem.crawledContent?.title || sourceItem.url}`);
        });
    });

    try {
      await Promise.all(generationPromises);
      toast.success('All generation jobs have been processed!');
    } catch {
      toast.error('An unexpected error occurred during batch generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Preview, Approve, Regenerate handlers
  const handlePreview = (contentId: string) => {
    const content = generatedContent.find(item => item.id === contentId);
    if (content) {
      setPreviewContent(content);
    }
  };

  const handleApprove = (contentId: string) => {
    const content = generatedContent.find(item => item.id === contentId);
    if (!content) return;

    // Update status to approved
    setGeneratedContent(prev => prev.map(item => 
      item.id === contentId 
        ? { ...item, status: 'approved' as const, approvedAt: new Date().toISOString() }
        : item
    ));

    // Store approved content for future fine-tuning (PREVENT DUPLICATES) - riêng cho từng site
    const currentSite = llmSettings.wordpressSiteTarget || 'auto';
    const approvedData = {
      contentId,
      sourceUrl: content.sourceUrl,
      originalTitle: content.title,
      generatedTitle: content.title,
      generatedContent: content.body,
      settings: llmSettings,
      approvedAt: new Date().toISOString(),
      wordCount: content.metadata?.wordCount,
      qualityScore: 'approved',
      wordpressSite: currentSite
    };

    // Get approved content by site structure
    const approvedContentBySite = JSON.parse(localStorage.getItem('approvedContentBySite') || '{}');
    const existingApprovals = approvedContentBySite[currentSite] || [];
    
    // Enhanced duplicate detection with better logging
    console.log(`🔍 Checking for duplicates in site "${currentSite}"...`);
    console.log('Current contentId:', contentId);
    console.log('Current sourceUrl:', content.sourceUrl);
    console.log('Existing approvals for this site:', existingApprovals.length);
    console.log('Existing contentIds:', existingApprovals.map((a: any) => a.contentId));
    
    // FIXED: Only check for exact contentId match, not sourceUrl
    // This ensures each unique content generation is counted separately
    const isDuplicate = existingApprovals.some((approval: any) => {
      return approval.contentId === contentId;
    });

    if (!isDuplicate) {
      // Add to site-specific approved content
      existingApprovals.push(approvedData);
      approvedContentBySite[currentSite] = existingApprovals;
      localStorage.setItem('approvedContentBySite', JSON.stringify(approvedContentBySite));
      
      console.log(`✅ Content approved and stored for site "${currentSite}" (total for this site: ${existingApprovals.length})`);
      console.log('Updated storage:', { currentSite, totalApprovals: existingApprovals.length });
      toast.success(`Content approved for ${currentSite}! Total: ${existingApprovals.length}`);
      
      // Force UI update for approved stats with delay to ensure localStorage is updated
      setTimeout(() => {
        setGeneratedContent(prev => [...prev]);
      }, 100); 
    } else {
      console.log(`ℹ️ Content already approved for site "${currentSite}", skipping duplicate storage`);
      toast.success('Content approved! (already tracked for this site)');
    }
  };

  const handleRegenerate = async (contentId: string) => {
    const content = generatedContent.find(item => item.id === contentId);
    if (!content) return;

    const sourceItem = urlItems.find(item => item.url === content.sourceUrl);
    if (!sourceItem || !sourceItem.crawledContent) return;

    // Update status to generating
    setGeneratedContent(prev => prev.map(item => 
      item.id === contentId ? { ...item, status: 'generating' as const } : item
    ));

    try {
      // IMPORTANT: Use the LATEST settings, not captured closure values
      console.log('🔄 Regenerating with current settings:', llmSettings);
      
      const newContent = await generateContentWithSettings(sourceItem, llmSettings);

      setGeneratedContent(prev => prev.map(item => 
        item.id === contentId 
          ? {
          ...item,
              title: newContent.title,
              body: newContent.body,
          status: 'generated' as const,
          metadata: {
                qualityScore: newContent.metadata?.qualityScore || 0,
                wordCount: newContent.metadata?.wordCount || 0
          }
            }
          : item
      ));

      toast.success('Content regenerated successfully!');
    } catch (error) {
      setGeneratedContent(prev => prev.map(item => 
        item.id === contentId 
          ? {
              ...item,
              status: 'failed' as const,
              body: `Failed to regenerate: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          : item
      ));
      toast.error('Failed to regenerate content');
    }
  };

  const handlePublish = async (contentId: string) => {
    const content = generatedContent.find(item => item.id === contentId);
    if (!content) return;

    // Only allow publishing approved content
    if (content.status !== 'approved') {
      toast.error('Please approve the content before publishing');
      return;
    }

    try {
      // Show loading state
      toast.loading('Publishing to WordPress...', { id: 'publishing' });

      // Prepare the publish data
      const publishData = {
        title: content.title,
        content: content.body,
        targetSiteId: llmSettings.wordpressSiteTarget,
        status: 'publish' as const,
        contentType: llmSettings.contentType,
      };

      // Call the smart publish API
      const result = await wordpressMultiSiteApi.smartPublish(publishData);

      if (result.success) {
        // Update content status
      setGeneratedContent(prev => prev.map(item => 
        item.id === contentId 
          ? { 
              ...item, 
                status: 'published' as const,
                publishedAt: new Date().toISOString(),
                publishedUrl: result.data?.url || '',
                publishedSite: result.data?.siteName || ''
            }
          : item
      ));
      
        toast.success(`Published successfully to ${result.data?.siteName || 'site'}!`, { id: 'publishing' });
        
        // Open the published URL in a new tab
        if (result.data?.url) {
          window.open(result.data.url, '_blank');
        }
      } else {
        throw new Error(result.message || 'Publishing failed');
      }
    } catch (error) {
      console.error('Publishing error:', error);
      toast.error(`Failed to publish: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'publishing' });
    }
  };

  const closePreview = () => {
    setPreviewContent(null);
    setCopySuccess(false);
  };

  const handleCopyContent = async () => {
    if (!previewContent) return;
    
    try {
      // Clean and prepare content
      const cleanedBody = previewContent.body
        .replace(/^```html\s*/i, '') // Remove ```html at start
        .replace(/\s*```\s*$/i, '')   // Remove ``` at end
        .replace(/&lt;/g, '<')        // Decode HTML entities
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
      
      // Copy clean HTML code (title + body HTML)
      const htmlContent = `<h1>${previewContent.title}</h1>\n\n${cleanedBody}`;
      await navigator.clipboard.writeText(htmlContent);
      setCopySuccess(true);
      
      // Reset success message after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy content:', error);
    }
  };

  // Navigation with validation
  const canGoNext = () => {
    switch (currentStep) {
      case 0: return crawledItems.length > 0; // URLs step
      case 1: return llmSettings.targetAudience.trim() && llmSettings.brandName.trim(); // Settings step
      case 2: return true; // Generation step (always can navigate)
      default: return false;
    }
  };

  const canGoPrev = () => currentStep > 0;

  const handleNext = () => {
    if (canGoNext() && currentStep < WORKFLOW_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (canGoPrev()) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <URLsStep 
            urlItems={urlItems}
            onUrlChange={handleUrlChange}
            onAddUrl={addUrlField}
            onRemoveUrl={removeUrlItem}
            onCrawlUrl={handleCrawlUrl}
          />
        );
      case 1:
        return (
                      <SettingsStep 
              llmSettings={llmSettings} 
              onSettingsChange={setLlmSettings}
              crawledItems={crawledItems}
              currentLanguage="vietnamese"
            />
        );
      case 2:
        return (
          <GenerationStep 
            generatedContent={generatedContent}
            isGenerating={isGenerating}
            onGenerate={handleGenerateContent}
            onPreview={handlePreview}
            onApprove={handleApprove}
            onRegenerate={handleRegenerate}
            onPublish={handlePublish}
            crawledItems={crawledItems}
            llmSettings={llmSettings}
            approvedStats={approvedStats}
            onClearApprovedContent={clearApprovedContent}
            onSettingsChange={setLlmSettings}
          />
        );
      case 3:
        return (
          <ManagementStep 
            llmSettings={llmSettings}
            approvedStats={approvedStats}
            onClearApprovedContent={clearApprovedContent}
            onSetPreviewContent={setPreviewContent}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with improved progress indicator */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Link-Based Content Generator</h1>
        <p className="text-lg text-gray-600">Transform web content into optimized articles in just 3 simple steps</p>
        
        {/* Progress bar with step indicators */}
        <div className="space-y-3">
          <Progress value={totalProgress} className="w-full h-2" />
          <div className="flex justify-between items-center">
            {WORKFLOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex flex-col items-center space-y-2">
                  <div className={`p-3 rounded-full border-2 ${
                    isActive 
                      ? 'border-blue-500 bg-blue-50 text-blue-600' 
                      : isCompleted 
                        ? 'border-green-500 bg-green-50 text-green-600'
                        : 'border-gray-300 bg-gray-50 text-gray-400'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className={`font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {React.createElement(WORKFLOW_STEPS[currentStep].icon, { className: "w-5 h-5" })}
            <span>{WORKFLOW_STEPS[currentStep].title}</span>
            <Badge variant="default">Step {currentStep + 1} of {WORKFLOW_STEPS.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStepContent()}
          
          {/* Navigation buttons */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={!canGoPrev()}
              className="flex items-center space-x-2"
            >
              <span>Previous</span>
            </Button>

            <Button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="flex items-center space-x-2"
            >
              <span>
                {currentStep === WORKFLOW_STEPS.length - 1 ? 'Finish' : 'Next Step'}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold">Content Preview</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Display as on WordPress • Copy to get HTML
                </p>
              </div>
              <Button variant="outline" onClick={closePreview}>
                ✕
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="border-b pb-4">
                <h3 className="text-lg font-medium text-gray-900">{previewContent.title}</h3>
                <p className="text-sm text-gray-500 mt-1">Source: {previewContent.sourceUrl}</p>
              </div>
              
              {/* Rendered HTML Content - WordPress Style */}
              <div className="prose prose-lg max-w-none">
                <style>
                  {`
                    .wordpress-content figure {
                      text-align: center;
                      margin: 1.5rem 0;
                    }
                    .wordpress-content figure img {
                      max-width: 100%;
                      height: auto;
                      margin: 0 auto;
                      display: block;
                    }
                    .wordpress-content figcaption {
                      text-align: center;
                      font-style: italic;
                      color: #666;
                      font-size: 0.9rem;
                      margin-top: 0.5rem;
                    }
                    .wordpress-content img {
                      max-width: 100%;
                      height: auto;
                      margin: 0 auto;
                      display: block;
                    }
                  `}
                </style>
                <div 
                  className="wordpress-content"
                  style={{
                    lineHeight: '1.6',
                    fontSize: '16px',
                    color: '#333',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: (() => {
                      // Enhanced HTML cleaning for proper preview
                      let cleanedContent = previewContent.body
                        .replace(/^```html\s*/i, '') // Remove ```html at start
                        .replace(/\s*```\s*$/i, '')   // Remove ``` at end
                        .replace(/&lt;/g, '<')        // Decode HTML entities
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&nbsp;/g, ' ');
                      
                      // Additional cleanup for artifacts
                      cleanedContent = cleanedContent
                        .replace(/^\s*`?html`?\s*/i, '') // Remove any remaining html artifacts
                        .replace(/\s*`\s*$/i, '')         // Remove trailing backticks
                        .trim();
                      
                      return cleanedContent;
                    })()
                  }}
                />
              </div>
            </div>
            
            <div className="border-t p-6 flex justify-between">
              <Button variant="outline" onClick={closePreview}>
                Close
              </Button>
              
              <div className="flex space-x-3">
                <Button 
                  variant="outline"
                  onClick={handleCopyContent}
                  className={copySuccess ? 'bg-green-50 border-green-200 text-green-700' : ''}
                >
                  <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
                  {copySuccess ? 'Copied HTML!' : 'Copy HTML'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    handleRegenerate(previewContent.id);
                    closePreview();
                  }}
                >
                  <ArrowPathIcon className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
                <Button 
                  onClick={() => {
                    handleApprove(previewContent.id);
                    closePreview();
                  }}
                >
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Approve Content
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// REDESIGNED: Simplified URLs Step Component
function URLsStep({ 
  urlItems, 
  onUrlChange, 
  onAddUrl, 
  onRemoveUrl, 
  onCrawlUrl
}: {
  urlItems: URLItem[];
  onUrlChange: (id: string, url: string) => void;
  onAddUrl: () => void;
  onRemoveUrl: (id: string) => void;
  onCrawlUrl: (id: string) => void;
}) {
  const crawledCount = urlItems.filter(item => item.status === 'crawled').length;
  const totalCount = urlItems.length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Add URLs to Crawl</h3>
        <p className="text-gray-600 mb-4">Enter the URLs you want to convert into content. Each URL will be crawled individually.</p>
        
        {/* Progress summary */}
        {totalCount > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Progress: {crawledCount} of {totalCount} URLs crawled successfully
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {urlItems.map((item, index) => (
          <div key={item.id} className="flex items-start space-x-3 p-4 border rounded-lg">
            <div className="flex-1 space-y-3">
              <div className="flex items-center space-x-2">
                <Label htmlFor={`url-${item.id}`} className="text-sm font-medium">
                  URL {index + 1}
                </Label>
                <StatusBadge status={item.status} />
              </div>
              
              <Input
                id={`url-${item.id}`}
                type="url"
                placeholder="https://example.com/article"
                value={item.url}
                onChange={(e) => onUrlChange(item.id, e.target.value)}
                className="w-full"
              />

              {item.status === 'failed' && item.errorMessage && (
                <p className="text-sm text-red-600">{item.errorMessage}</p>
              )}

              {item.status === 'crawled' && item.crawledContent && (
                <div className="p-3 bg-green-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-green-800">
                    ✓ Successfully crawled: {item.crawledContent.title}
                  </p>
                  <div className="text-xs text-green-600 space-x-4">
                    <span>Words: {item.crawledContent.wordCount || 0}</span>
                    <span>Quality: {item.crawledContent.qualityScore || 0}/100</span>
                    <span>Status: Analyzed</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCrawlUrl(item.id)}
                disabled={!item.url.trim() || item.status === 'crawling'}
                className="min-w-[80px]"
              >
                {item.status === 'crawling' ? (
                  <ClockIcon className="w-4 h-4 animate-spin" />
                ) : (
                  'Crawl'
                )}
              </Button>

              {urlItems.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveUrl(item.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={onAddUrl}
          className="w-full flex items-center justify-center space-x-2"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Another URL</span>
        </Button>
      </div>
    </div>
  );
}

// REDESIGNED: Simplified Settings Step Component
function SettingsStep({ 
  llmSettings, 
  onSettingsChange,
  crawledItems,
  currentLanguage
}: {
  llmSettings: LLMSettings;
  onSettingsChange: (settings: LLMSettings) => void;
  crawledItems: URLItem[];
  currentLanguage: string;
}) {
  const [categories, setCategories] = useState<PhotoGalleryCategory[]>([]);
  const [folderSuggestions, setFolderSuggestions] = useState<string[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Load photo gallery categories
    photoGalleryApi.getCategories().then(setCategories).catch(console.error);
  }, []);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Load folder suggestions when category changes or imageSelection changes to folder
  useEffect(() => {
    if (llmSettings.imageSelection === 'folder' && llmSettings.imageCategory) {
      console.log('🔍 Loading folders for category:', llmSettings.imageCategory);
      loadFolderSuggestions(llmSettings.imageCategory);
    } else if (llmSettings.imageSelection === 'folder' && !llmSettings.imageCategory) {
      // If folder selection but no category, load a default category to get folders
      console.log('🔍 No category selected, trying wedding category for folders');
      loadFolderSuggestions('wedding');
    }
  }, [llmSettings.imageCategory, llmSettings.imageSelection]);
  
  const loadFolderSuggestions = async (categorySlug: string) => {
    if (!categorySlug) return;
    
    console.log('📁 Fetching folders for category:', categorySlug);
    setIsLoadingFolders(true);
    setFolderSuggestions([]); // Clear previous suggestions
    try {
      // Use hardcoded localhost for development
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const apiUrl = `${baseUrl}/api/v1/link-content/image-folders/${categorySlug}`;
      console.log('📁 API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      console.log('📁 Folder API response:', data);
      console.log('📁 Response status:', response.status);
      console.log('📁 Response ok:', response.ok);
      
      if (data.success && data.data?.folders) {
        setFolderSuggestions(data.data.folders);
        console.log('📁 Loaded folders:', data.data.folders);
        console.log('📁 Number of folders:', data.data.folders.length);
      } else {
        console.log('📁 No folders found in response:', {
          success: data.success,
          hasData: !!data.data,
          hasFolders: !!data.data?.folders,
          foldersLength: data.data?.folders?.length
        });
        setFolderSuggestions([]);
      }
    } catch (error) {
      console.error('Failed to load folder suggestions:', error);
      setFolderSuggestions([]);
    } finally {
      setIsLoadingFolders(false);
    }
  };
  
  const filteredFolders = folderSuggestions.filter(folder =>
    folder.toLowerCase().includes(folderSearchQuery.toLowerCase())
  );
  
  const updateSetting = (key: keyof LLMSettings, value: any) => {
    console.log('🔧 Settings Update Debug:');
    console.log('- Key:', key);
    console.log('- New Value:', value);
    console.log('- Value Type:', typeof value);
    console.log('- Current Settings BEFORE:', JSON.stringify(llmSettings, null, 2));
    
    // Handle type conversions
    let finalValue: any = value;
    
    if (key === 'includeImages' || key === 'ensureConsistency') {
      // Convert string to boolean
      finalValue = value === 'true' || value === true;
    } else if (key === 'maxImages') {
      // Convert string to number
      finalValue = parseInt(value, 10);
    }
    
    const newSettings: LLMSettings = { 
      ...llmSettings, 
      [key]: finalValue 
    };
    
    console.log('- Updated Settings AFTER:', JSON.stringify(newSettings, null, 2));
    console.log('✅ Calling onSettingsChange with new settings');
    
    // Update the settings
    onSettingsChange(newSettings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Content Generation Settings</h3>
        <p className="text-gray-600 mb-4">Configure how AI will generate content from your crawled URLs.</p>
      </div>

      {/* Combined Settings Card */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h4 className="font-semibold text-gray-900 mb-6 flex items-center">
          <span className="mr-2">⚙️</span>
          Content Generation Settings
        </h4>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Basic Settings */}
          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2">Basic Settings</h5>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Type
              </label>
              <select
                value={llmSettings.contentType}
                onChange={(e) => {
                  console.log('📝 Content Type changing to:', e.target.value);
                  updateSetting('contentType', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="wordpress_blog">📄 WordPress Blog</option>
                <option value="facebook_post">📱 Facebook Post</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nhà Cung Cấp AI
              </label>
              <select
                value={llmSettings.preferredProvider}
                onChange={(e) => {
                  console.log('🤖 AI Provider changing to:', e.target.value);
                  updateSetting('preferredProvider', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="auto">🤖 Auto Selection</option>
                <option value="openai">🧠 OpenAI GPT-4o</option>
                <option value="gemini">⚡ Google Gemini Flash</option>
                <option value="claude">🎭 Claude 3 Haiku</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tone
              </label>
              <select
                value={llmSettings.tone}
                onChange={(e) => {
                  console.log('🎭 Tone changing to:', e.target.value);
                  updateSetting('tone', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="professional">👔 Professional</option>
                <option value="casual">😊 Casual</option>
                <option value="friendly">🤝 Friendly</option>
                <option value="authoritative">🎯 Authoritative</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Word Count ({llmSettings.wordCount} words)
              </label>
              <input
                type="range"
                min="500"
                max="3000"
                step="100"
                value={llmSettings.wordCount}
                onChange={(e) => updateSetting('wordCount', parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Language
              </label>
              <select
                value={llmSettings.language}
                onChange={(e) => {
                  console.log('🌐 Language changing to:', e.target.value);
                  updateSetting('language', e.target.value as 'vietnamese' | 'english');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="vietnamese">🇻🇳 Vietnamese</option>
                <option value="english">🇬🇧 English</option>
              </select>
            </div>

            {/* WordPress Multi-site Selection */}
            {llmSettings.contentType === 'wordpress_blog' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target WordPress Site
                </label>
                <select
                  value={llmSettings.wordpressSiteTarget || 'wedding'}
                  onChange={(e) => {
                    console.log('🌐 WordPress Site Target changing to:', e.target.value);
                    updateSetting('wordpressSiteTarget', e.target.value as 'wedding' | 'yearbook' | 'general');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="wedding">💍 Wedding.guustudio.vn (Wedding/Pre-wedding)</option>
                  <option value="yearbook">🎓 Guukyyeu.vn (Yearbook)</option>
                  <option value="general">📸 Guustudio.vn (Other Photos)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choose the site that matches your content type
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Content Customization */}
          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2">Content Customization</h5>
            
            <div>
              <Label htmlFor="targetAudience" className="text-sm font-medium text-gray-700">
                Target Audience
              </Label>
              <Input
                id="targetAudience"
                value={llmSettings.targetAudience}
                onChange={(e) => {
                  console.log('👥 Target Audience changing to:', e.target.value);
                  updateSetting('targetAudience', e.target.value);
                }}
                placeholder="e.g., Marketing professionals, Small business owners"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="brandName" className="text-sm font-medium text-gray-700">
                Brand Name
              </Label>
              <Input
                id="brandName"
                value={llmSettings.brandName}
                onChange={(e) => {
                  console.log('🏢 Brand Name changing to:', e.target.value);
                  updateSetting('brandName', e.target.value);
                }}
                placeholder="e.g., Your Company Name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="keywords" className="text-sm font-medium text-gray-700">
                Keywords
                <span className="text-gray-500 text-xs ml-1">(optional)</span>
              </Label>
              <Input
                id="keywords"
                value={llmSettings.keywords}
                onChange={(e) => {
                  console.log('🔑 Keywords changing to:', e.target.value);
                  updateSetting('keywords', e.target.value);
                }}
                placeholder="e.g., SEO, digital marketing, automation"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Separate multiple keywords with commas</p>
            </div>

            <div>
              <Label htmlFor="specialRequest" className="text-sm font-medium text-gray-700">
                Special Instructions
                <span className="text-gray-500 text-xs ml-1">(optional)</span>
              </Label>
              <Input
                id="specialRequest"
                value={llmSettings.specialRequest}
                onChange={(e) => {
                  console.log('✨ Special Request changing to:', e.target.value);
                  updateSetting('specialRequest', e.target.value);
                }}
                placeholder="e.g., Include more examples, Add call-to-action"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Additional instructions for AI generation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Image Integration Settings */}
      <Card className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h4 className="font-semibold text-gray-900 mb-6 flex items-center">
          <span className="mr-2">📸</span>
          Image Integration Settings
        </h4>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeImages"
              checked={llmSettings.includeImages}
              onChange={(e) => {
                console.log('📸 Include Images:', e.target.checked);
                updateSetting('includeImages', e.target.checked.toString());
              }}
              className="mr-2"
            />
            <label htmlFor="includeImages" className="text-sm font-medium">
              Include images from Photo Gallery
            </label>
          </div>

          {llmSettings.includeImages && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Selection Method
                </label>
                <select
                  value={llmSettings.imageSelection}
                  onChange={(e) => {
                    console.log('🖼️ Image Selection Method:', e.target.value);
                    updateSetting('imageSelection', e.target.value);
                    
                    // Auto-load folders when switching to folder selection
                    if (e.target.value === 'folder') {
                      const categoryToUse = llmSettings.imageCategory || 'wedding';
                      console.log('🔍 Auto-loading folders for category:', categoryToUse);
                      if (!llmSettings.imageCategory) {
                        updateSetting('imageCategory', categoryToUse);
                      }
                      loadFolderSuggestions(categoryToUse);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="category">📂 By Category</option>
                  <option value="folder">🎯 By Specific Folder</option>
                </select>
              </div>

              {llmSettings.imageSelection === 'category' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Category 
                  </label>
                  <select
                    value={llmSettings.imageCategory}
                    onChange={(e) => {
                      console.log('📂 Image Category:', e.target.value);
                      updateSetting('imageCategory', e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">🔍 Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id || cat.category_slug} value={cat.category_slug || cat.id}>
                        {(cat.category_name || cat.name || 'Unnamed')} ({cat.folder_count || cat.count || 0} folders)
                      </option>
                    ))}
                  </select>
                  {llmSettings.imageCategory ? (
                    <div>
                      <p className="text-xs text-gray-500 mt-1">
                        System will automatically select a random folder within category "{llmSettings.imageCategory}"
                      </p>
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-xs text-green-700">
                          ✅ <strong>Category selected:</strong> All images will belong to category "{llmSettings.imageCategory}".
                          <br />
                          Only using real images from Photo Gallery API.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-xs text-red-700">
                        ⚠️ <strong>No category selected!</strong> Please select a category to ensure images match the topic.
                        <br />
                        If not selected, content will be generated without images.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {llmSettings.imageSelection === 'folder' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Category 
                    </label>
                    <select
                      value={llmSettings.imageCategory}
                      onChange={(e) => {
                        console.log('📂 Image Category for Folder Mode:', e.target.value);
                        updateSetting('imageCategory', e.target.value);
                        if (e.target.value) {
                          loadFolderSuggestions(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">🔍 Select category</option>
                      {categories.map((cat) => (
                        <option key={cat.id || cat.category_slug} value={cat.category_slug || cat.id}>
                          {(cat.category_name || cat.name || 'Unnamed')} ({cat.folder_count || 0} folders)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <Label>Specific Folder</Label>
                  <div className="relative" ref={folderDropdownRef}>
                    <Input
                      placeholder={llmSettings.imageCategory ? 
                        "Search for folder..." : 
                        "Select a category first"
                      }
                      value={folderSearchQuery}
                      onChange={(e) => {
                        setFolderSearchQuery(e.target.value);
                        setShowFolderDropdown(true);
                      }}
                      onFocus={() => {
                        setShowFolderDropdown(true);
                        // If no category selected, auto-load wedding folders
                        if (!llmSettings.imageCategory) {
                          updateSetting('imageCategory', 'wedding');
                          loadFolderSuggestions('wedding');
                        }
                      }}
                      disabled={!llmSettings.imageCategory}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    
                    {showFolderDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {isLoadingFolders ? (
                          <div className="p-3 text-sm text-gray-500">
                            Loading folders...
                          </div>
                        ) : folderSuggestions.length > 0 ? (
                          filteredFolders.length > 0 ? (
                            filteredFolders.map((folder, index) => (
                              <button
                                key={index}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                                onClick={() => {
                                  updateSetting('specificFolder', folder);
                                  setFolderSearchQuery(folder);
                                  setShowFolderDropdown(false);
                                }}
                              >
                                {folder}
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-sm text-gray-500">
                              No folders match "{folderSearchQuery}"
                            </div>
                          )
                        ) : (
                          <div className="p-3 text-sm text-gray-500">
                            {folderSearchQuery ? 
                              'No matching folders found' : 
                              'No folders available - waiting for Photo Gallery team to add featured images'
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {llmSettings.specificFolder && (
                    <div className="text-sm text-green-600">
                      ✓ Selected: {llmSettings.specificFolder}
                    </div>
                  )}
                  
                  {llmSettings.imageCategory && folderSuggestions.length === 0 && !isLoadingFolders && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-xs text-amber-700">
                        📁 No folders available for "{llmSettings.imageCategory}" category.
                        <br />
                        Content will be generated without images until Photo Gallery team adds featured images.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Images
                </label>
                <select
                  value={llmSettings.maxImages}
                  onChange={(e) => {
                    console.log('🔢 Max Images:', e.target.value);
                    const value = e.target.value === 'auto' ? 'auto' : parseInt(e.target.value, 10);
                    updateSetting('maxImages', value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="auto">🤖 Auto (let LLM decide)</option>
                  <option value={0}>No images</option>
                  <option value={1}>1 image</option>
                  <option value={2}>2 images</option>
                  <option value={3}>3 images</option>
                  <option value={4}>4 images</option>
                  <option value={5}>5 images</option>
                  <option value={6}>6 images</option>
                  <option value={7}>7 images</option>
                  <option value={8}>8 images</option>
                  <option value={9}>9 images</option>
                  <option value={10}>10 images</option>
                  <option value={12}>12 images</option>
                  <option value={15}>15 images (maximum)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {llmSettings.maxImages === 'auto' 
                    ? 'LLM will decide the appropriate number of images for the content'
                    : `LLM will calculate distribution of ${llmSettings.maxImages} images in the article`
                  }
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ensureConsistency"
                    checked={llmSettings.ensureConsistency}
                    onChange={(e) => {
                      console.log('🔒 Ensure Consistency:', e.target.checked);
                      updateSetting('ensureConsistency', e.target.checked);
                    }}
                    className="mr-2"
                  />
                  <label htmlFor="ensureConsistency" className="text-sm">
                    🔒 Ensure all images from same category
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ensureAlbumConsistency"
                    checked={llmSettings.ensureAlbumConsistency}
                    onChange={(e) => {
                      console.log('📁 Ensure Album Consistency:', e.target.checked);
                      updateSetting('ensureAlbumConsistency', e.target.checked);
                    }}
                    className="mr-2"
                  />
                  <label htmlFor="ensureAlbumConsistency" className="text-sm">
                    📁 Ensure all images from same album (recommended)
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="preferPortrait"
                    checked={llmSettings.preferPortrait}
                    onChange={(e) => {
                      console.log('👤 Prefer Portrait:', e.target.checked);
                      updateSetting('preferPortrait', e.target.checked);
                    }}
                    className="mr-2"
                  />
                  <label htmlFor="preferPortrait" className="text-sm">
                    👤 Prefer portrait images
                  </label>
                </div>

                <div className="text-xs text-gray-500 mt-2 pl-6">
                  <p>• Category consistency: All images belong to the same category</p>
                  <p>• Album consistency: All images from the same folder/album</p>
                  <p>• Portrait priority: Prefer portraits, fallback to featured images</p>
                </div>
              </div>

              {llmSettings.imageSelection === 'category' && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Real Images Only:</strong>
                    <br />• Select category → System automatically randomizes 1 folder within category
                    <br />• Only using real images from Photo Gallery API
                    <br />• No images → Content will be generated without images
                  </p>
                </div>
              )}
              
              {llmSettings.imageSelection === 'folder' && (
                <div className="bg-green-50 p-3 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>🎯 Real Images Only:</strong>
                    <br />• Search for specific folder to use
                    <br />• Only using real images from Photo Gallery API
                    <br />• No images → Content will be generated without images
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Source Content Preview List */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">📄</span>
          Source Content Preview ({crawledItems.length} items)
        </h4>
        
        {crawledItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No crawled content yet</p>
            <p className="text-xs">Add and crawl URLs in the previous step</p>
          </div>
        ) : (
          <div className="space-y-3">
            {crawledItems.map((item, index) => (
              <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                        #{index + 1}
                      </span>
                      <h5 className="font-medium text-sm text-gray-900 line-clamp-1">
                        {item.crawledContent?.title || 'Untitled'}
                      </h5>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 truncate">{item.url}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        📝 {item.crawledContent?.wordCount || 0} words
                      </span>
                      <span className="flex items-center">
                        ⭐ {item.crawledContent?.qualityScore || 0}/100 quality
                      </span>
                      <span className="flex items-center text-green-600">
                        ✅ Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 font-medium">
                ✅ Ready to generate {crawledItems.length} content piece{crawledItems.length > 1 ? 's' : ''} with your settings
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// REDESIGNED: Generation Step Component
function GenerationStep({ 
  generatedContent,
  isGenerating,
  onGenerate,
  onPreview,
  onApprove,
  onRegenerate,
  onPublish,
  crawledItems,
  llmSettings,
  approvedStats,
  onClearApprovedContent,
  onSettingsChange
}: { 
  generatedContent: GeneratedContentItem[];
  isGenerating: boolean;
  onGenerate: () => void;
  onPreview: (contentId: string) => void;
  onApprove: (contentId: string) => void;
  onRegenerate: (contentId: string) => void;
  onPublish: (contentId: string) => void;
  crawledItems: URLItem[];
  llmSettings: LLMSettings;
  approvedStats: {
    totalApproved: number;
    readyForFineTuning: boolean;
    progress: number;
    currentSite: string;
  };
  onClearApprovedContent: () => void;
  onSettingsChange: (settings: LLMSettings) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Generate & Review Content</h3>
        <p className="text-gray-600 mb-4">Generate AI content from your crawled URLs and review the results.</p>
        
        {/* Current Settings Display - Enhanced with All 8 Settings */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200 mb-6">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
            <span className="mr-2">⚙️</span>
            Current Generation Settings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">Content Type</span>
              <p className="text-blue-900 font-semibold capitalize">{llmSettings.contentType.replace('_', ' ')}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">AI Provider</span>
              <p className="text-blue-900 font-semibold capitalize">{llmSettings.preferredProvider}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">Tone</span>
              <p className="text-blue-900 font-semibold capitalize">{llmSettings.tone}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">Language</span>
              <p className="text-blue-900 font-semibold capitalize">{llmSettings.language}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">Target Audience</span>
              <p className="text-blue-900 font-semibold">{llmSettings.targetAudience || 'Not set'}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">Brand Name</span>
              <p className="text-blue-900 font-semibold">{llmSettings.brandName || 'Not set'}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">Keywords</span>
              <p className="text-blue-900 font-semibold text-sm">{llmSettings.keywords || 'None'}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">Special Request</span>
              <p className="text-blue-900 font-semibold text-sm">{llmSettings.specialRequest || 'None'}</p>
            </div>
            {llmSettings.contentType === 'wordpress_blog' && (
              <div className="bg-white p-3 rounded-lg border border-blue-100">
                <span className="text-blue-700 font-medium text-xs uppercase tracking-wide">WordPress Site</span>
                <p className="text-blue-900 font-semibold text-sm">
                  {llmSettings.wordpressSiteTarget === 'wedding' && '💍 Wedding'}
                  {llmSettings.wordpressSiteTarget === 'yearbook' && '🎓 Yearbook'}
                  {llmSettings.wordpressSiteTarget === 'general' && '📸 General'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Fine-tuning Progress Display */}
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="font-medium text-green-900">🤖 AI Learning Progress</h4>
              <p className="text-xs text-green-600 mt-1">
                Site: <span className="font-medium">{approvedStats.currentSite}</span>
                {approvedStats.currentSite === 'auto' && ' (Auto-select)'}
                {approvedStats.currentSite === 'wedding' && ' (💍 Wedding)'}
                {approvedStats.currentSite === 'yearbook' && ' (🎓 Yearbook)'}
                {approvedStats.currentSite === 'general' && ' (📸 General)'}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClearApprovedContent}
              className="text-xs px-2 py-1 h-6"
            >
              🗑️ Clear
            </Button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-green-700">Approved Content: </span>
              <span className="font-medium text-green-800">{approvedStats.totalApproved}/10</span>
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-green-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${approvedStats.progress}%` }}
                ></div>
              </div>
            </div>
            <div className="text-xs text-green-600">
              {approvedStats.readyForFineTuning ? '✅ Ready for Auto-Gen' : 'Building training data...'}
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2">
            {approvedStats.readyForFineTuning 
              ? `Great! You have enough approved content for "${approvedStats.currentSite}". Future feature: auto-generation without links!`
              : `Approve ${10 - approvedStats.totalApproved} more pieces for "${approvedStats.currentSite}" to unlock auto-generation feature.`}
          </p>
        </div>
      </div>

      {generatedContent.length === 0 ? (
        <div className="text-center py-8 space-y-4">
          <SparklesIcon className="w-16 h-16 text-blue-500 mx-auto" />
          <div>
            <p className="text-lg font-medium">Ready to generate content!</p>
            <p className="text-gray-600">
              {crawledItems.length} URL{crawledItems.length !== 1 ? 's' : ''} ready for AI content generation
            </p>
          </div>
          <Button
            onClick={onGenerate}
            disabled={isGenerating || crawledItems.length === 0}
            size="lg"
            className="flex items-center space-x-2"
          >
            {isGenerating ? (
              <>
                <ClockIcon className="w-5 h-5 animate-spin" />
                <span>Generating Content...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                <span>Generate Content</span>
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {generatedContent.map((content) => (
            <Card key={content.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{content.title}</CardTitle>
                  <StatusBadge status={content.status} />
                </div>
                <p className="text-sm text-gray-500">Source: {content.sourceUrl}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {content.status === 'generated' && (
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onPreview(content.id)}
                      >
                        <EyeIcon className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => onApprove(content.id)}
                      >
                        <CheckCircleIcon className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onRegenerate(content.id)}
                      >
                        Regenerate
                      </Button>
                    </div>
                  )}

                  {content.status === 'approved' && (
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onPreview(content.id)}
                      >
                        <EyeIcon className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => onPublish(content.id)}
                      >
                        <CloudArrowUpIcon className="w-4 h-4 mr-2" />
                        Publish to WordPress
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onRegenerate(content.id)}
                      >
                        Regenerate
                      </Button>
                    </div>
                  )}

                  {content.status === 'generating' && (
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <ClockIcon className="w-4 h-4 animate-spin" />
                      <span>Regenerating content...</span>
                    </div>
                  )}

                  {content.status === 'published' && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-green-600">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>
                          Published on {new Date(content.publishedAt!).toLocaleString('en-US')}
                          {content.publishedSite && ` • ${content.publishedSite}`}
                        </span>
                      </div>
                      {content.publishedUrl && (
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(content.publishedUrl, '_blank')}
                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                          >
                            <GlobeAltIcon className="w-4 h-4 mr-2" />
                            View Post
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onPreview(content.id)}
                          >
                            <EyeIcon className="w-4 h-4 mr-2" />
                            Preview
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {content.status === 'failed' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <p className="font-medium text-red-800">Content generation failed</p>
                            <div className="text-sm text-red-700 whitespace-pre-wrap">
                              {content.body || 'Unknown error occurred'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          <Button 
                            size="sm"
                            onClick={() => onRegenerate(content.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            <ArrowPathIcon className="w-4 h-4 mr-2" />
                            Try Again
                          </Button>
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Try with different provider
                              const currentProvider = llmSettings.preferredProvider;
                              const alternativeProvider = currentProvider === 'openai' ? 'gemini' : 
                                                          currentProvider === 'gemini' ? 'claude' : 'openai';
                              toast(`Switching to ${alternativeProvider} provider...`);
                              // Update settings and regenerate
                              onSettingsChange?.({
                                ...llmSettings,
                                preferredProvider: alternativeProvider as 'auto' | 'openai' | 'gemini' | 'claude'
                              });
                              setTimeout(() => onRegenerate(content.id), 100);
                            }}
                          >
                            <ArrowsRightLeftIcon className="w-4 h-4 mr-2" />
                            Try Different AI
                          </Button>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {content.metadata?.aiModel && (
                            <span>Failed with: {content.metadata.aiModel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Status badge component
function ManagementStep({ 
  llmSettings,
  approvedStats,
  onClearApprovedContent,
  onSetPreviewContent
}: {
  llmSettings: LLMSettings;
  approvedStats: {
    totalApproved: number;
    readyForFineTuning: boolean;
    progress: number;
    currentSite: string;
  };
  onClearApprovedContent: () => void;
  onSetPreviewContent: (content: GeneratedContentItem | null) => void;
}) {
  const [approvedContentList, setApprovedContentList] = React.useState<any[]>([]);
  const [autoGenerationEnabled, setAutoGenerationEnabled] = React.useState(false);

  // Load approved content cho site hiện tại
  React.useEffect(() => {
    try {
      const approvedContentBySite = JSON.parse(localStorage.getItem('approvedContentBySite') || '{}');
      const siteApprovedContent = approvedContentBySite[llmSettings.wordpressSiteTarget || 'auto'] || [];
      setApprovedContentList(Array.isArray(siteApprovedContent) ? siteApprovedContent : []);
    } catch (error) {
      console.error('Failed to load approved content:', error);
      setApprovedContentList([]);
    }
  }, [llmSettings.wordpressSiteTarget, approvedStats]);

  const handleDeleteApprovedContent = (contentId: string) => {
    try {
      const currentSite = llmSettings.wordpressSiteTarget || 'auto';
      const approvedContentBySite = JSON.parse(localStorage.getItem('approvedContentBySite') || '{}');
      const siteApprovedContent = approvedContentBySite[currentSite] || [];
      
      // Remove the specific content
      const updatedContent = siteApprovedContent.filter((item: any) => item.contentId !== contentId);
      approvedContentBySite[currentSite] = updatedContent;
      localStorage.setItem('approvedContentBySite', JSON.stringify(approvedContentBySite));
      
      setApprovedContentList(updatedContent);
      toast.success('Approved content deleted');
    } catch (error) {
      console.error('Failed to delete approved content:', error);
      toast.error('Failed to delete content');
    }
  };

  const handlePreviewApproved = (content: any) => {
    // Set preview content directly since we have all the data
    const previewItem = {
      id: content.contentId,
      title: content.generatedTitle,
      body: content.generatedContent,
      sourceUrl: content.sourceUrl,
      status: 'approved' as const,
      metadata: {
        qualityScore: 100,
        wordCount: content.wordCount || 0
      }
    };
    
         // We need to trigger preview manually since this content might not be in generatedContent
     onSetPreviewContent(previewItem);
  };

  const getSiteIcon = (siteId: string) => {
    switch (siteId) {
      case 'wedding': return '💒';
      case 'yearbook': return '📚';
      case 'general': return '🏢';
      case 'auto': return '🤖';
      default: return '📄';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Content Management & Auto-Generation</h3>
        <p className="text-gray-600 mb-4">
          Manage your approved content and configure auto-generation settings based on AI learning progress.
        </p>
      </div>

      {/* AI Learning Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ChartBarIcon className="w-5 h-5" />
            <span>AI Learning Progress</span>
            <Badge variant="info">
              {getSiteIcon(approvedStats.currentSite)} {approvedStats.currentSite}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Approved Content</span>
              <span className="text-sm text-gray-600">{approvedStats.totalApproved}/10+</span>
            </div>
            <Progress value={approvedStats.progress} className="w-full h-2" />
          </div>
          
          <div className={`p-4 rounded-lg ${approvedStats.readyForFineTuning ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
            {approvedStats.readyForFineTuning ? (
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">Ready for Auto-Generation!</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <ClockIcon className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">
                  Need {10 - approvedStats.totalApproved} more approvals for auto-generation
                </span>
              </div>
            )}
          </div>

          {/* Auto-Generation Toggle */}
          {approvedStats.readyForFineTuning && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Auto-Generation Mode</p>
                <p className="text-sm text-gray-600">Enable automatic content generation based on learned patterns</p>
              </div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoGenerationEnabled}
                  onChange={(e) => setAutoGenerationEnabled(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{autoGenerationEnabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Content List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DocumentDuplicateIcon className="w-5 h-5" />
              <span>Approved Content ({approvedContentList.length})</span>
            </div>
            <Button variant="outline" size="sm" onClick={onClearApprovedContent}>
              Clear All
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedContentList.length === 0 ? (
            <div className="text-center py-8">
              <DocumentDuplicateIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No approved content yet for this site</p>
              <p className="text-sm text-gray-500 mt-2">Approve content in the Generation step to build training data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvedContentList.map((content, index) => (
                <div key={content.contentId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{content.generatedTitle || 'Untitled'}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Source: {content.sourceUrl}
                    </p>
                    <p className="text-xs text-gray-400">
                      Approved: {new Date(content.approvedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreviewApproved(content)}
                    >
                      <EyeIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteApprovedContent(content.contentId)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future Auto-Generation Settings */}
      {approvedStats.readyForFineTuning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <SparklesIcon className="w-5 h-5" />
              <span>Auto-Generation Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <SparklesIcon className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h4 className="font-medium text-blue-800 mb-2">Auto-Generation Ready!</h4>
              <p className="text-sm text-blue-600">
                With {approvedStats.totalApproved} approved pieces, the AI can now generate content automatically based on learned patterns.
              </p>
              <Button className="mt-4" disabled>
                <SparklesIcon className="w-4 h-4 mr-2" />
                Configure Auto-Generation (Coming Soon)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusClasses = {
    generating: 'bg-yellow-100 text-yellow-800 animate-pulse',
    generated: 'bg-green-100 text-green-800',
    approved: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    crawled: 'bg-green-100 text-green-800',
    crawling: 'bg-yellow-100 text-yellow-800 animate-pulse',
    pending: 'bg-gray-100 text-gray-800',
    queued: 'bg-indigo-100 text-indigo-800',
    published: 'bg-purple-100 text-purple-800',
  };

  const icons = {
    pending: ClockIcon,
    crawling: ClockIcon,
    crawled: CheckCircleIcon,
    failed: ExclamationCircleIcon,
    generating: ClockIcon,
    generated: CheckCircleIcon,
    approved: CheckCircleIcon,
    queued: ClockIcon,
    published: CloudArrowUpIcon,
  };

  const Icon = icons[status as keyof typeof icons] || ClockIcon;

  return (
    <Badge className={`${statusClasses[status as keyof typeof statusClasses]} flex items-center space-x-1`}>
      <Icon className="w-3 h-3" />
      <span className="capitalize">{status}</span>
    </Badge>
  );
} 