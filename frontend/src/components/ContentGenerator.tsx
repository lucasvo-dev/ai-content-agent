import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { Button } from './ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { aiApi } from '../services/api';
import type { ContentGenerationRequest, GeneratedContent } from '../types/api';

// Form validation schema
const contentGenerationSchema = z.object({
  type: z.enum(['blog_post', 'social_media', 'email', 'ad_copy']),
  topic: z.string().min(1, 'Topic is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  keywords: z.string().min(1, 'Keywords are required'),
  brandVoice: z.object({
    tone: z.enum(['professional', 'casual', 'friendly', 'authoritative']),
    style: z.enum(['conversational', 'formal', 'technical', 'creative']),
    vocabulary: z.enum(['simple', 'advanced', 'industry-specific']),
    length: z.enum(['concise', 'detailed', 'comprehensive']),
  }),
  requirements: z.object({
    wordCount: z.string().optional(),
    includeHeadings: z.boolean().optional(),
    includeCTA: z.boolean().optional(),
    seoOptimized: z.boolean().optional(),
  }).optional(),
  context: z.string().optional(),
  preferredProvider: z.enum(['auto', 'openai', 'gemini']).optional(),
});

type FormData = z.infer<typeof contentGenerationSchema>;

const ContentGenerator: React.FC = () => {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(contentGenerationSchema),
    defaultValues: {
      type: 'blog_post',
      brandVoice: {
        tone: 'professional',
        style: 'conversational',
        vocabulary: 'industry-specific',
        length: 'detailed',
      },
      requirements: {
        includeHeadings: true,
        includeCTA: true,
        seoOptimized: true,
      },
      preferredProvider: 'auto',
    },
  });

  // Fetch AI models and templates (for future use)
  // const { data: _models } = useQuery({
  //   queryKey: ['ai-models'],
  //   queryFn: aiApi.getModels,
  // });

  // const { data: _templates } = useQuery({
  //   queryKey: ['ai-templates'],
  //   queryFn: aiApi.getTemplates,
  // });

  // Content generation mutation
  const generateMutation = useMutation({
    mutationFn: (data: ContentGenerationRequest) => aiApi.generateContent(data),
    onSuccess: (content) => {
      setGeneratedContent(content);
      toast.success('Content generated successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate content');
    },
  });

  const onSubmit = (data: FormData) => {
    const keywords = data.keywords.split(',').map(k => k.trim()).filter(Boolean);
    
    const request: ContentGenerationRequest = {
      ...data,
      keywords,
    };

    generateMutation.mutate(request);
  };

  const contentType = watch('type');
  const selectedProvider = watch('preferredProvider');

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AI Content Generator
        </h1>
        <p className="text-gray-600">
          Generate high-quality content with AI-powered tools
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Content Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* AI Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Provider
                </label>
                <select
                  {...register('preferredProvider')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">🤖 Auto Selection (Intelligent)</option>
                  <option value="openai">🧠 OpenAI GPT-4 Turbo (Premium)</option>
                  <option value="gemini">⚡ Google Gemini Flash (Free)</option>
                </select>
                {errors.preferredProvider && (
                  <p className="text-red-500 text-sm mt-1">{errors.preferredProvider.message}</p>
                )}
                
                {/* Provider Info */}
                <div className="mt-2 text-xs text-gray-500">
                  {selectedProvider === 'auto' && (
                    <div className="flex items-center gap-1">
                      <span>🎯</span>
                      <span>Automatically selects best provider based on content complexity</span>
                    </div>
                  )}
                  {selectedProvider === 'openai' && (
                    <div className="flex items-center gap-1">
                      <span>💰</span>
                      <span>Premium quality, ~$0.01-0.03 per generation</span>
                    </div>
                  )}
                  {selectedProvider === 'gemini' && (
                    <div className="flex items-center gap-1">
                      <span>🆓</span>
                      <span>Free tier: 1,500 requests/day, fast generation</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content Type
                </label>
                <select
                  {...register('type')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="blog_post">Blog Post</option>
                  <option value="social_media">Social Media</option>
                  <option value="email">Email</option>
                  <option value="ad_copy">Ad Copy</option>
                </select>
                {errors.type && (
                  <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>
                )}
              </div>

              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic
                </label>
                <input
                  type="text"
                  {...register('topic')}
                  placeholder="e.g., AI in Marketing Automation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.topic && (
                  <p className="text-red-500 text-sm mt-1">{errors.topic.message}</p>
                )}
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  {...register('targetAudience')}
                  placeholder="e.g., Marketing professionals and business owners"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.targetAudience && (
                  <p className="text-red-500 text-sm mt-1">{errors.targetAudience.message}</p>
                )}
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  {...register('keywords')}
                  placeholder="e.g., AI, marketing automation, content strategy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.keywords && (
                  <p className="text-red-500 text-sm mt-1">{errors.keywords.message}</p>
                )}
              </div>

              {/* Brand Voice */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tone
                  </label>
                  <select
                    {...register('brandVoice.tone')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="friendly">Friendly</option>
                    <option value="authoritative">Authoritative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Style
                  </label>
                  <select
                    {...register('brandVoice.style')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="conversational">Conversational</option>
                    <option value="formal">Formal</option>
                    <option value="technical">Technical</option>
                    <option value="creative">Creative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vocabulary
                  </label>
                  <select
                    {...register('brandVoice.vocabulary')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="simple">Simple</option>
                    <option value="advanced">Advanced</option>
                    <option value="industry-specific">Industry-specific</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Length
                  </label>
                  <select
                    {...register('brandVoice.length')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="concise">Concise</option>
                    <option value="detailed">Detailed</option>
                    <option value="comprehensive">Comprehensive</option>
                  </select>
                </div>
              </div>

              {/* Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('requirements.includeHeadings')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include headings</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('requirements.includeCTA')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include call-to-action</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('requirements.seoOptimized')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">SEO optimized</span>
                  </label>
                </div>
              </div>

              {/* Word Count */}
              {contentType === 'blog_post' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Word Count (optional)
                  </label>
                  <input
                    type="text"
                    {...register('requirements.wordCount')}
                    placeholder="e.g., 1500-2000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Context (optional)
                </label>
                <textarea
                  {...register('context')}
                  rows={3}
                  placeholder="Any additional context or specific requirements..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                loading={generateMutation.isPending}
                className="w-full"
                size="lg"
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate Content'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Generated Content */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
          </CardHeader>
          <CardContent>
            {generatedContent ? (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-3">✅ Generated Content</h3>
                
                {/* Provider Selection Info */}
                <div className="mb-4 p-3 bg-white border border-green-200 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-800">AI Provider Used</h4>
                    <div className="flex items-center gap-2">
                      {generatedContent.metadata?.selectedProvider === 'openai' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          🧠 OpenAI GPT-4
                        </span>
                      )}
                      {generatedContent.metadata?.selectedProvider === 'gemini' && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          ⚡ Gemini Flash
                        </span>
                      )}
                      {generatedContent.metadata?.selectedProvider === 'fallback' && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                          📝 Template
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <strong>Requested:</strong> {generatedContent.metadata?.requestedProvider || 'auto'}
                    </div>
                    <div>
                      <strong>Selected:</strong> {generatedContent.metadata?.selectedProvider}
                    </div>
                    <div>
                      <strong>Reason:</strong> {
                        generatedContent.metadata?.selectionReason === 'manual_selection' 
                          ? 'Manual user selection'
                          : generatedContent.metadata?.selectionReason === 'intelligent_selection'
                          ? 'Intelligent auto-selection'
                          : generatedContent.metadata?.selectionReason === 'error_fallback'
                          ? 'Error fallback'
                          : 'Unknown'
                      }
                    </div>
                    {generatedContent.metadata?.originalError && (
                      <div className="text-red-600">
                        <strong>Error:</strong> {generatedContent.metadata.originalError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {generatedContent.metadata?.wordCount || 0}
                    </div>
                    <div className="text-sm text-gray-600">Words</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {generatedContent.metadata?.seoScore || 0}
                    </div>
                    <div className="text-sm text-gray-600">SEO Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {generatedContent.metadata?.readabilityScore || 0}
                    </div>
                    <div className="text-sm text-gray-600">Readability</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {generatedContent.metadata?.engagementScore || 0}
                    </div>
                    <div className="text-sm text-gray-600">Engagement</div>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-1">Title:</h4>
                    <p className="text-gray-700 font-semibold">{generatedContent.title}</p>
                  </div>
                  
                  {generatedContent.excerpt && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-1">Excerpt:</h4>
                      <p className="text-gray-600 text-sm">{generatedContent.excerpt}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium text-gray-800 mb-1">Content:</h4>
                    <div className="max-h-64 overflow-y-auto p-3 bg-white border rounded text-sm">
                      <div className="whitespace-pre-wrap">{generatedContent.body}</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => navigator.clipboard.writeText(generatedContent.body)}
                    variant="outline"
                    size="sm"
                  >
                    📋 Copy Content
                  </Button>
                  <Button
                    onClick={() => setGeneratedContent(null)}
                    variant="outline"
                    size="sm"
                  >
                    🔄 Generate New
                  </Button>
                  <Button
                    onClick={() => {
                      // TODO: Implement save functionality
                      toast.success('Save functionality coming soon!');
                    }}
                    variant="outline"
                    size="sm"
                  >
                    💾 Save & Publish
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500">
                  Generated content will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContentGenerator; 