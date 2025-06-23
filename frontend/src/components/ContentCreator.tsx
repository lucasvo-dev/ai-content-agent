import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface Link {
  id: string;
  url: string;
  title?: string;
  domain?: string;
  wordCount?: number;
  readingTime?: number;
  status: 'pending' | 'processing' | 'processed' | 'error';
  preview?: string;
  qualityScore?: number;
  error?: string;
}

interface GeneratedContent {
  id: string;
  linkId: string;
  title: string;
  body: string;
  excerpt: string;
  qualityScore: number;
  wordCount: number;
  readingTime: number;
  status: 'generated' | 'queued' | 'published';
  createdAt: string;
}

interface LLMSettings {
  brandVoice: {
    tone: string;
    style: string;
    vocabulary: string;
    length: string;
  };
  contentType: string;
  targetAudience: string;
  requirements: {
    wordCount: string;
    includeHeadings: boolean;
    includeCTA: boolean;
    seoOptimized: boolean;
  };
  aiProvider: string;
}

const ContentCreator: React.FC = () => {
  const [links, setLinks] = useState<Link[]>([]);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  
  const [llmSettings, setLLMSettings] = useState<LLMSettings>({
    brandVoice: {
      tone: 'professional',
      style: 'conversational',
      vocabulary: 'advanced',
      length: 'comprehensive'
    },
    contentType: 'blog_post',
    targetAudience: 'Marketing professionals và business owners',
    requirements: {
      wordCount: '1200-1800',
      includeHeadings: true,
      includeCTA: true,
      seoOptimized: true
    },
    aiProvider: 'auto'
  });

  const addLink = async () => {
    if (!newUrl.trim()) return;

    const linkId = Date.now().toString();
    const newLink: Link = {
      id: linkId,
      url: newUrl.trim(),
      status: 'pending'
    };

    setLinks(prev => [...prev, newLink]);
    setNewUrl('');
    
    // Process link immediately
    await processLink(linkId);
  };

  const processLink = async (linkId: string) => {
    setIsProcessing(linkId);
    
    try {
      const link = links.find(l => l.id === linkId);
      if (!link) return;

      // Update status to processing
      setLinks(prev => prev.map(l => 
        l.id === linkId ? { ...l, status: 'processing' } : l
      ));

      const response = await fetch('/api/v1/content/process-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: link.url }),
      });

      const data = await response.json();

      if (data.success) {
        setLinks(prev => prev.map(l => 
          l.id === linkId ? {
            ...l,
            status: 'processed',
            title: data.data.title,
            domain: data.data.domain,
            wordCount: data.data.wordCount,
            readingTime: data.data.readingTime,
            preview: data.data.preview,
            qualityScore: data.data.qualityScore
          } : l
        ));
      } else {
        setLinks(prev => prev.map(l => 
          l.id === linkId ? {
            ...l,
            status: 'error',
            error: data.message || 'Không thể xử lý link này'
          } : l
        ));
      }
    } catch (error) {
      setLinks(prev => prev.map(l => 
        l.id === linkId ? {
          ...l,
          status: 'error',
          error: 'Lỗi kết nối, vui lòng thử lại'
        } : l
      ));
    } finally {
      setIsProcessing(null);
    }
  };

  const generateContent = async (linkId: string) => {
    const link = links.find(l => l.id === linkId);
    if (!link || link.status !== 'processed') return;

    setIsGenerating(linkId);

    try {
      const response = await fetch('/api/v1/content/generate-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: link.url,
          brandVoice: llmSettings.brandVoice,
          contentType: llmSettings.contentType,
          targetAudience: llmSettings.targetAudience,
          requirements: llmSettings.requirements,
          aiProvider: llmSettings.aiProvider
        }),
      });

      const data = await response.json();

      if (data.success) {
        const newContent: GeneratedContent = {
          id: Date.now().toString(),
          linkId: linkId,
          title: data.data.title,
          body: data.data.body,
          excerpt: data.data.excerpt,
          qualityScore: data.data.metadata?.qualityScore || 85,
          wordCount: data.data.metadata?.wordCount || 0,
          readingTime: data.data.metadata?.readingTime || 0,
          status: 'generated',
          createdAt: new Date().toISOString()
        };

        setGeneratedContent(prev => [...prev, newContent]);
      } else {
        alert(`Lỗi tạo content: ${data.message}`);
      }
    } catch (error) {
      alert('Lỗi kết nối, vui lòng thử lại');
    } finally {
      setIsGenerating(null);
    }
  };

  const queueForPublishing = (contentId: string) => {
    setGeneratedContent(prev => prev.map(content =>
      content.id === contentId 
        ? { ...content, status: 'queued' }
        : content
    ));
  };

  const removeContent = (contentId: string) => {
    setGeneratedContent(prev => prev.filter(content => content.id !== contentId));
  };

  const removeLink = (linkId: string) => {
    setLinks(prev => prev.filter(link => link.id !== linkId));
    // Also remove generated content for this link
    setGeneratedContent(prev => prev.filter(content => content.linkId !== linkId));
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Tạo Content từ Links
          </h1>
          <p className="text-gray-600">
            Nhập links, cấu hình LLM, và tạo content tự động
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* LLM Settings - Left Column */}
          <div className="col-span-3">
            <Card className="p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                ⚙️ Cài đặt LLM
              </h2>

              {/* Brand Voice */}
              <div className="mb-6">
                <h3 className="font-medium mb-3 text-gray-800">Brand Voice</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tone
                    </label>
                    <select
                      value={llmSettings.brandVoice.tone}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        brandVoice: { ...prev.brandVoice, tone: e.target.value }
                      }))}
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
                      value={llmSettings.brandVoice.style}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        brandVoice: { ...prev.brandVoice, style: e.target.value }
                      }))}
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
                      value={llmSettings.brandVoice.vocabulary}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        brandVoice: { ...prev.brandVoice, vocabulary: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="simple">Simple</option>
                      <option value="advanced">Advanced</option>
                      <option value="industry-specific">Industry-specific</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Content Settings */}
              <div className="mb-6">
                <h3 className="font-medium mb-3 text-gray-800">Content Settings</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content Type
                    </label>
                    <select
                      value={llmSettings.contentType}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        contentType: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="blog_post">Blog Post</option>
                      <option value="social_media">Social Media</option>
                      <option value="email">Email</option>
                      <option value="ad_copy">Ad Copy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Audience
                    </label>
                    <input
                      type="text"
                      value={llmSettings.targetAudience}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        targetAudience: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Mô tả target audience..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Word Count
                    </label>
                    <select
                      value={llmSettings.requirements.wordCount}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        requirements: { ...prev.requirements, wordCount: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="500-800">500-800 từ</option>
                      <option value="800-1200">800-1200 từ</option>
                      <option value="1200-1800">1200-1800 từ</option>
                      <option value="1800-2500">1800-2500 từ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI Provider
                    </label>
                    <select
                      value={llmSettings.aiProvider}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        aiProvider: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="auto">🤖 Auto Selection</option>
                      <option value="openai">🧠 OpenAI GPT-4</option>
                      <option value="gemini">⚡ Google Gemini</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Requirements */}
              <div className="mb-6">
                <h3 className="font-medium mb-3 text-gray-800">Requirements</h3>
                
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={llmSettings.requirements.includeHeadings}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        requirements: { ...prev.requirements, includeHeadings: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Include Headings</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={llmSettings.requirements.includeCTA}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        requirements: { ...prev.requirements, includeCTA: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Include CTA</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={llmSettings.requirements.seoOptimized}
                      onChange={(e) => setLLMSettings(prev => ({
                        ...prev,
                        requirements: { ...prev.requirements, seoOptimized: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">SEO Optimized</span>
                  </label>
                </div>
              </div>
            </Card>
          </div>

          {/* Links List - Center Column */}
          <div className="col-span-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                🔗 Links ({links.length})
              </h2>

              {/* Add Link Form */}
              <div className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="Nhập URL để phân tích..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addLink()}
                  />
                  <Button
                    onClick={addLink}
                    disabled={!newUrl.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    ➕ Thêm
                  </Button>
                </div>
              </div>

              {/* Links List */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {links.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Chưa có link nào. Thêm link để bắt đầu!</p>
                  </div>
                ) : (
                  links.map((link) => (
                    <div key={link.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {link.title || link.url}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {link.domain || new URL(link.url).hostname}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(link.status)}`}>
                            {link.status === 'pending' && '⏳ Pending'}
                            {link.status === 'processing' && '🔄 Processing'}
                            {link.status === 'processed' && '✅ Processed'}
                            {link.status === 'error' && '❌ Error'}
                          </span>
                          <button
                            onClick={() => removeLink(link.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {link.status === 'processed' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span>📄 {link.wordCount} từ</span>
                            <span>⏱️ {link.readingTime} phút đọc</span>
                            {link.qualityScore && (
                              <span className={`px-2 py-1 rounded ${getQualityColor(link.qualityScore)}`}>
                                {link.qualityScore}/100
                              </span>
                            )}
                          </div>
                          
                          {link.preview && (
                            <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                              {link.preview}
                            </p>
                          )}

                          <Button
                            onClick={() => generateContent(link.id)}
                            disabled={isGenerating === link.id}
                            className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md disabled:opacity-50"
                          >
                            {isGenerating === link.id ? '🔄 Đang tạo content...' : '🚀 Xử lý Link'}
                          </Button>
                        </div>
                      )}

                      {link.status === 'error' && link.error && (
                        <div className="mt-2">
                          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            {link.error}
                          </p>
                          <Button
                            onClick={() => processLink(link.id)}
                            disabled={isProcessing === link.id}
                            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md disabled:opacity-50"
                          >
                            {isProcessing === link.id ? '🔄 Đang thử lại...' : '🔄 Thử lại'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Generated Content - Right Column */}
          <div className="col-span-5">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                📝 Generated Content ({generatedContent.length})
              </h2>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {generatedContent.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Chưa có content nào được tạo.</p>
                    <p className="text-sm">Xử lý links để tạo content!</p>
                  </div>
                ) : (
                  generatedContent.map((content) => (
                    <div key={content.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 mb-1">
                            {content.title}
                          </h3>
                          <p className="text-xs text-gray-600 mb-2">
                            {content.excerpt}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQualityColor(content.qualityScore)}`}>
                            {content.qualityScore}/100
                          </span>
                          <button
                            onClick={() => removeContent(content.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                        <span>📄 {content.wordCount} từ</span>
                        <span>⏱️ {content.readingTime} phút đọc</span>
                        <span>🕒 {new Date(content.createdAt).toLocaleTimeString('vi-VN')}</span>
                      </div>

                      <div className="bg-gray-50 p-3 rounded text-xs text-gray-700 mb-3 max-h-32 overflow-y-auto">
                        {content.body.substring(0, 300)}...
                      </div>

                      <div className="flex gap-2">
                        {content.status === 'generated' && (
                          <Button
                            onClick={() => queueForPublishing(content.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md text-sm"
                          >
                            📤 Đưa vào hàng chờ
                          </Button>
                        )}
                        
                        {content.status === 'queued' && (
                          <div className="flex-1 bg-green-100 text-green-800 py-2 px-3 rounded-md text-sm text-center">
                            ✅ Đã vào hàng chờ
                          </div>
                        )}

                        <Button
                          onClick={() => generateContent(content.linkId)}
                          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm"
                        >
                          🔄
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Queue Summary */}
              {generatedContent.filter(c => c.status === 'queued').length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">
                    📋 Hàng chờ Publishing
                  </h3>
                  <p className="text-sm text-blue-700">
                    {generatedContent.filter(c => c.status === 'queued').length} bài viết đang chờ được đăng
                  </p>
                  <Button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">
                    🚀 Publish All
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentCreator; 