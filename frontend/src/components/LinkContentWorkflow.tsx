import React, { useState } from 'react';
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
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';
import { linkContentApi, aiApi } from '../services/api';

// REDESIGNED: Simplified 3-step workflow based on UX best practices
const WORKFLOW_STEPS = [
  { id: 'urls', title: 'URLs & Crawler', icon: GlobeAltIcon, description: 'Input URLs and crawl content' },
  { id: 'settings', title: 'Content Settings', icon: CogIcon, description: 'Configure AI generation settings' },
  { id: 'generation', title: 'Generate & Review', icon: SparklesIcon, description: 'Generate and review content' },
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
  preferredProvider: 'auto' | 'openai' | 'gemini';
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative';
  language: 'vietnamese' | 'english';
  targetAudience: string;
  brandName: string;
  keywords: string;
  specialRequest: string;
}

// Generated content interface
interface GeneratedContentItem {
  id: string;
  sourceUrl: string;
  title: string;
  body: string;
  status: 'generating' | 'generated' | 'approved' | 'failed' | 'queued';
  metadata?: {
    qualityScore: number;
    wordCount: number;
  };
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
  });

  // Get crawled items
  const crawledItems = urlItems.filter(item => item.status === 'crawled');
  const totalProgress = ((currentStep + 1) / WORKFLOW_STEPS.length) * 100;

  // Get approved content count for fine-tuning progress
  const getApprovedContentStats = () => {
    const approvedContent = JSON.parse(localStorage.getItem('approvedContent') || '[]');
    return {
      totalApproved: approvedContent.length,
      readyForFineTuning: approvedContent.length >= 10, // Need 10+ approvals for fine-tuning
      progress: Math.min(approvedContent.length / 10 * 100, 100)
    };
  };

  const approvedStats = getApprovedContentStats();

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
    const maxRetries = 2; // Allow up to 2 retries
    const sourceContent = sourceItem.crawledContent?.content || '';
    const sourceTitle = sourceItem.crawledContent?.title || 'Untitled';
    const sourceUrl = sourceItem.url;

    const {
      contentType, 
      language, 
      tone, 
      targetAudience, 
      brandName, 
      keywords, 
      specialRequest
    } = settings;

    let finalPrompt = '';

    const wordpressPrompt = `You are an expert content writer specializing in WordPress blog content. Your task is to transform the 'SOURCE ARTICLE' into high-quality WordPress-ready content.

### CRITICAL RULES (Follow Strictly):

1.  **OUTPUT FORMAT**: The ENTIRE output must be valid HTML ready for WordPress editor. Use proper HTML tags for structure and formatting. DO NOT include <html>, <head>, <body> tags - only provide the content HTML that goes directly into WordPress post editor.
2.  **HTML STRUCTURE**:
    - Use <h2> for main section titles
    - Use <h3> for subsections
    - Use <p> tags for all paragraphs
    - Use <strong> for bolding important keywords
    - Use <ul> and <li> for bullet points
    - Use <ol> and <li> for numbered lists
    - Use <blockquote> for quotes
    - Use <br> sparingly, prefer proper paragraph tags
    - DO NOT include any backticks, code blocks, or markdown syntax
    - Content must be completely clean and ready for copy-paste to WordPress
3.  **STRUCTURAL MIRRORING (MOST IMPORTANT)**: You MUST mirror the exact structure of the source article. If the source has 5 sections and 2 lists, your output MUST have the same.
4.  **LENGTH REQUIREMENT (NON-NEGOTIABLE)**: The final article MUST contain at least 1000 words. COUNT EVERY WORD. This is MANDATORY and NON-NEGOTIABLE. If your output has fewer than 1000 words, it will be automatically rejected and you must try again. To meet this requirement:
    - Expand each section with detailed explanations and examples
    - Add comprehensive background information  
    - Include practical tips and actionable advice
    - Provide case studies or real-world applications
    - Add thorough analysis and insights
    - NEVER use filler content - every word must add value
    - The 1000-word minimum is just the START - aim for 1500-2000 words for best results
5.  **LANGUAGE**: Write exclusively in ${language === 'vietnamese' ? 'VIETNAMESE' : 'ENGLISH'}.
6.  **CONTENT FIDELITY**: Base the content EXCLUSIVELY on the 'SOURCE ARTICLE'.
7.  **COMPLETE REWRITING**: Rewrite every sentence. No verbatim copying.
8.  **BRAND INTEGRATION**: Replace competing brands with "${brandName}".
9.  **AUDIENCE/TONE**: Write for "${targetAudience}" with a ${tone} tone.
10. **KEYWORD INTEGRATION (MANDATORY)**: You MUST strategically weave the following keywords throughout the article. They must be part of the natural sentence flow and not feel forced. Keywords: "${keywords}".
11. **SPECIAL INSTRUCTIONS**: ${specialRequest ? `Follow: "${specialRequest}"` : 'None.'}

### HTML FORMAT EXAMPLE:
<h2>Main Section Title</h2>
<p>This is a paragraph with <strong>important keywords</strong> highlighted properly for WordPress.</p>

<h3>Subsection Title</h3>
<p>Another paragraph with proper HTML formatting.</p>

<ul>
<li>Bullet point one with valuable information</li>
<li>Bullet point two with additional details</li>
</ul>

<blockquote>
<p>This is a quote or important statement formatted properly.</p>
</blockquote>`;

    const facebookPrompt = `You are an expert social media manager. Your task is to transform the 'SOURCE ARTICLE' into a highly engaging Facebook post.

### CRITICAL RULES (Follow Strictly):

1.  **HOOK**: Start with a compelling question or a bold statement to grab attention.
2.  **READABILITY**: Use short paragraphs (1-3 sentences). Use line breaks to create white space.
3.  **EMOJIS**: Sprinkle relevant emojis (2-4) throughout the post to make it visually appealing and convey emotion.
4.  **VALUE**: Summarize the most important point from the source article in a clear and concise way.
5.  **CALL-TO-ACTION (CTA)**: End with a clear CTA. Ask a question to encourage comments, or suggest clicking a link (you can use a placeholder like "[Link in Bio]").
6.  **HASHTAGS**: Include 3-5 relevant hashtags at the end. Use a mix of broad and niche tags.
7.  **LENGTH**: The entire post should be between 400 and 800 characters. DO NOT exceed this.
8.  **LANGUAGE**: Write exclusively in ${language === 'vietnamese' ? 'VIETNAMESE' : 'ENGLISH'}.
9.  **TONE**: Write for "${targetAudience}" with a ${tone} tone.
10. **BRAND REPLACEMENT (MANDATORY)**: You MUST replace any brand name found in the source article with "${brandName}". This is a critical instruction. Do not mention the original brand.
11. **KEYWORD INTEGRATION (MANDATORY)**: You MUST integrate the following keywords naturally into the body of the post. Do not just list them as hashtags. Keywords: "${keywords}".
12. **SPECIAL INSTRUCTIONS**: ${specialRequest ? `Follow: "${specialRequest}"` : 'None.'}`;
    
    if (contentType === 'wordpress_blog') {
      finalPrompt = wordpressPrompt;
    } else { // facebook_post
      finalPrompt = facebookPrompt;
    }

    const fullContext = `${finalPrompt}

### SOURCE ARTICLE TO TRANSFORM:
---
**Original Title:** ${sourceTitle}
**Source URL:** ${sourceUrl}

**Complete Source Content:**
${sourceContent}
---

### OUTPUT REQUIREMENTS:
Provide ONLY the final content based on the specified format (HTML for WordPress, plain text with emojis for Facebook). Do not add any meta-commentary, explanations, or notes. The HTML should be ready for direct copy-paste into WordPress editor.`;

    try {
      // Create content generation request with timeout
      const request = {
        type: 'blog_post' as const, 
        topic: sourceTitle,
        targetAudience: targetAudience,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        brandVoice: {
          tone: tone,
          style: 'conversational' as const,
          vocabulary: 'industry-specific' as const,
          length: 'detailed' as const,
        },
        context: fullContext,
        preferredProvider: settings.preferredProvider,
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

      const generatedContent = await Promise.race([
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

    } catch (error) {
      console.error(`❌ AI API Error (attempt ${retryCount + 1}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRetryableError = 
        errorMessage.includes('timeout') || 
        errorMessage.includes('rate limit') ||
        errorMessage.includes('network') ||
        errorMessage.includes('503') ||
        errorMessage.includes('502') ||
        errorMessage.includes('500');
      
      // Retry logic for retryable errors
      if (isRetryableError && retryCount < maxRetries) {
        console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`);
        
        // Exponential backoff: 2s, 4s, 8s
        const delayMs = Math.pow(2, retryCount + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        return generateContentWithSettings(sourceItem, settings, retryCount + 1);
      }
      
      // Final failure - no more retries
      throw new Error(`AI content generation failed after ${retryCount + 1} attempts: ${errorMessage}. ${isRetryableError ? 'All retries exhausted.' : 'Not retryable.'}`);
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

    // Store approved content for future fine-tuning
    const approvedData = {
      contentId,
      sourceUrl: content.sourceUrl,
      originalTitle: content.title, // Use the actual content title
      generatedTitle: content.title,
      generatedContent: content.body,
      settings: llmSettings, // Use current LLM settings
      approvedAt: new Date().toISOString(),
      wordCount: content.metadata?.wordCount,
      qualityScore: 'approved' // User approved indicates high quality
    };

    // Store in localStorage for now (in production, this would go to backend for fine-tuning)
    const existingApprovals = JSON.parse(localStorage.getItem('approvedContent') || '[]');
    existingApprovals.push(approvedData);
    localStorage.setItem('approvedContent', JSON.stringify(existingApprovals));

    console.log('✅ Content approved and stored for fine-tuning:', approvedData);
    toast.success('Content approved! This will help improve future AI generations.');
  };

  const handleRegenerate = async (contentId: string) => {
    const contentToRegenerate = generatedContent.find(c => c.id === contentId);
    if (!contentToRegenerate) return;

    const sourceItem = urlItems.find(item => item.url === contentToRegenerate.sourceUrl);
    if (!sourceItem?.crawledContent) {
      toast.error('Source content not found. Please re-crawl the URL first.');
      return;
    }

    // Update status to generating
    setGeneratedContent(prev => prev.map(item => 
      item.id === contentId 
        ? { ...item, status: 'generating' as const, title: 'Regenerating content...', body: 'Creating new content with improved settings...' }
        : item
    ));

    try {
      console.log('🔄 Regenerating content for:', contentToRegenerate.sourceUrl);
      
      // Generate new content with retry logic
      const regeneratedData = await generateContentWithSettings(sourceItem, llmSettings);

      setGeneratedContent(prev => prev.map(item => 
        item.id === contentId ? {
          ...item,
          status: 'generated' as const,
          title: regeneratedData.title,
          body: regeneratedData.body,
          metadata: {
            qualityScore: regeneratedData.metadata?.qualityScore || 0,
            wordCount: regeneratedData.metadata?.wordCount || 0
          }
        } : item
      ));

      const retryInfo = regeneratedData.metadata?.retryCount ? ` (${regeneratedData.metadata.retryCount + 1} attempts)` : '';
      toast.success(`Content regenerated successfully!${retryInfo}`);
      
    } catch (error) {
      console.error('❌ Regeneration failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setGeneratedContent(prev => prev.map(item => 
        item.id === contentId 
          ? { 
              ...item, 
              status: 'failed' as const, 
              title: 'Regeneration Failed', 
              body: `❌ Failed to regenerate content: ${errorMessage}\n\nYou can try regenerating again or check your AI provider settings.`
            }
          : item
      ));
      
      toast.error(`Regeneration failed: ${errorMessage.split(':')[0]}`);
    }
  };

  const closePreview = () => {
    setPreviewContent(null);
    setCopySuccess(false);
  };

  const handleCopyContent = async () => {
    if (!previewContent) return;
    
    try {
      const contentToCopy = `${previewContent.title}\n\n${previewContent.body}`;
      await navigator.clipboard.writeText(contentToCopy);
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
            crawledItems={crawledItems}
            llmSettings={llmSettings}
            approvedStats={approvedStats}
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
        <p className="text-lg text-gray-600">Transform web content into optimized articles in 3 simple steps</p>
        
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
              <h2 className="text-xl font-semibold">Content Preview</h2>
              <Button variant="outline" onClick={closePreview}>
                ✕
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{previewContent.title}</h3>
                <p className="text-sm text-gray-500 mt-1">Source: {previewContent.sourceUrl}</p>
              </div>
              
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">
                  {previewContent.body}
                </div>
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
                  {copySuccess ? 'Copied!' : 'Copy Content'}
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
  crawledItems 
}: {
  llmSettings: LLMSettings;
  onSettingsChange: (settings: LLMSettings) => void;
  crawledItems: URLItem[];
}) {
  const updateSetting = (key: keyof LLMSettings, value: string) => {
    console.log('🔧 Settings Update Debug:');
    console.log('- Key:', key);
    console.log('- New Value:', value);
    console.log('- Current Settings BEFORE:', JSON.stringify(llmSettings, null, 2));
    
    const newSettings: LLMSettings = { 
      ...llmSettings, 
      [key]: value 
    };
    
    console.log('- Updated Settings AFTER:', JSON.stringify(newSettings, null, 2));
    
    // Force re-render with new settings
    onSettingsChange(newSettings);
    
    // Verify state update after next render
    setTimeout(() => {
      console.log('✅ State verification after update:');
      console.log('- Should be:', value);
      console.log('- Current state:', llmSettings[key]);
      console.log('- Settings object:', JSON.stringify(llmSettings, null, 2));
    }, 200);
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
                AI Provider
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
                <option value="openai">🧠 OpenAI GPT-4</option>
                <option value="gemini">⚡ Google Gemini</option>
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
                Language
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
                <option value="english">🇸 English</option>
              </select>
            </div>
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
                Special Request
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
  crawledItems,
  llmSettings,
  approvedStats
}: { 
  generatedContent: GeneratedContentItem[];
  isGenerating: boolean;
  onGenerate: () => void;
  onPreview: (contentId: string) => void;
  onApprove: (contentId: string) => void;
  onRegenerate: (contentId: string) => void;
  crawledItems: URLItem[];
  llmSettings: LLMSettings;
  approvedStats: {
    totalApproved: number;
    readyForFineTuning: boolean;
    progress: number;
  };
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
          </div>
        </div>

        {/* Fine-tuning Progress Display */}
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
          <h4 className="font-medium text-green-900 mb-2">🤖 AI Learning Progress</h4>
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
              ? 'Great! You have enough approved content. Future feature: auto-generation without links!'
              : `Approve ${10 - approvedStats.totalApproved} more pieces to unlock auto-generation feature.`}
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
  };

  const Icon = icons[status as keyof typeof icons] || ClockIcon;

  return (
    <Badge className={`${statusClasses[status as keyof typeof statusClasses]} flex items-center space-x-1`}>
      <Icon className="w-3 h-3" />
      <span className="capitalize">{status}</span>
    </Badge>
  );
} 