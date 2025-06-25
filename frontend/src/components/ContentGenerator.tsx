import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { Button } from './ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { aiApi } from '../services/api';
import type { ContentGenerationRequest, GeneratedContent } from '../types/api';

const ContentGenerator: React.FC = () => {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [formData, setFormData] = useState({
    type: 'blog_post' as const,
    topic: '',
    targetAudience: '',
    keywords: '',
    brandVoice: {
      tone: 'professional' as const,
      style: 'conversational' as const,
      vocabulary: 'industry-specific' as const,
      length: 'detailed' as const,
    },
    requirements: {
      wordCount: '1000-1500',
      includeHeadings: true,
      includeCTA: true,
      seoOptimized: true,
    },
    context: '',
    preferredProvider: 'auto' as const,
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.topic.trim()) {
      toast.error('Topic is required');
      return;
    }
    
    if (!formData.targetAudience.trim()) {
      toast.error('Target audience is required');
      return;
    }
    
    if (!formData.keywords.trim()) {
      toast.error('Keywords are required');
      return;
    }

    const keywords = formData.keywords.split(',').map(k => k.trim()).filter(Boolean);
    
    const request: ContentGenerationRequest = {
      ...formData,
      keywords,
    };

    generateMutation.mutate(request);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBrandVoiceChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      brandVoice: {
        ...prev.brandVoice,
        [field]: value
      }
    }));
  };

  const handleRequirementsChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        [field]: value
      }
    }));
  };

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
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* AI Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Provider
                </label>
                <select
                  value={formData.preferredProvider}
                  onChange={(e) => handleInputChange('preferredProvider', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">🤖 Auto Selection (Intelligent)</option>
                  <option value="openai">🧠 OpenAI GPT-4 Turbo (Premium)</option>
                  <option value="gemini">⚡ Google Gemini Flash (Free)</option>
                </select>
                
                {/* Provider Info */}
                <div className="mt-2 text-xs text-gray-500">
                  {formData.preferredProvider === 'auto' && (
                    <div className="flex items-center gap-1">
                      <span>🎯</span>
                      <span>Automatically selects best provider based on content complexity</span>
                    </div>
                  )}
                  {formData.preferredProvider === 'openai' && (
                    <div className="flex items-center gap-1">
                      <span>💰</span>
                      <span>Premium quality, ~$0.01-0.03 per generation</span>
                    </div>
                  )}
                  {formData.preferredProvider === 'gemini' && (
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
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="blog_post">Blog Post</option>
                  <option value="social_media">Social Media</option>
                  <option value="email">Email</option>
                  <option value="ad_copy">Ad Copy</option>
                </select>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Topic
                </label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => handleInputChange('topic', e.target.value)}
                  placeholder="e.g., AI in Marketing Automation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={formData.targetAudience}
                  onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                  placeholder="e.g., Marketing professionals"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords
                </label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => handleInputChange('keywords', e.target.value)}
                  placeholder="e.g., AI, marketing, automation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separate keywords with commas</p>
              </div>

              {/* Brand Voice */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Brand Voice</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Tone</label>
                    <select
                      value={formData.brandVoice.tone}
                      onChange={(e) => handleBrandVoiceChange('tone', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="friendly">Friendly</option>
                      <option value="authoritative">Authoritative</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Style</label>
                    <select
                      value={formData.brandVoice.style}
                      onChange={(e) => handleBrandVoiceChange('style', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="conversational">Conversational</option>
                      <option value="formal">Formal</option>
                      <option value="technical">Technical</option>
                      <option value="creative">Creative</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={generateMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {generateMutation.isPending ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </div>
                ) : (
                  'Generate Content'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Generated Content Display */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
          </CardHeader>
          <CardContent>
            {generateMutation.isPending ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p>Generating your content...</p>
              </div>
            ) : generatedContent ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {generatedContent.title}
                  </h3>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    {generatedContent.body.split('\n').map((paragraph, index) => (
                      paragraph.trim() && (
                        <p key={index} className="mb-3">
                          {paragraph}
                        </p>
                      )
                    ))}
                  </div>
                </div>
                
                {/* Metadata */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Word Count:</span> {generatedContent.metadata.wordCount}
                    </div>
                    <div>
                      <span className="font-medium">Provider:</span> {generatedContent.metadata.provider || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">SEO Score:</span> {generatedContent.metadata.seoScore}/100
                    </div>
                    <div>
                      <span className="font-medium">Readability:</span> {generatedContent.metadata.readabilityScore}/100
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-4">✨</div>
                  <p>Fill out the form and click "Generate Content" to get started</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContentGenerator; 