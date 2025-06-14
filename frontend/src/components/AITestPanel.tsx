import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Button from './ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from './ui/Card';
import { healthApi, aiApi } from '../services/api';
import toast from 'react-hot-toast';

export const AITestPanel: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [selectedTestProvider, setSelectedTestProvider] = useState<'auto' | 'openai' | 'gemini'>('auto');

  // Health check query
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: healthApi.checkHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // AI health check query
  const { data: aiHealthData, isLoading: aiHealthLoading } = useQuery({
    queryKey: ['ai-health'],
    queryFn: healthApi.checkAIHealth,
    refetchInterval: 30000,
  });

  // AI models query
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['ai-models'],
    queryFn: aiApi.getModels,
  });

  // AI templates query
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['ai-templates'],
    queryFn: aiApi.getTemplates,
  });

  // Test AI generation mutation
  const testGenerationMutation = useMutation({
    mutationFn: aiApi.generateContent,
    onSuccess: (data) => {
      setTestResults(data);
      toast.success('AI generation test completed successfully!');
    },
    onError: (error: any) => {
      console.error('AI generation test failed:', error);
      toast.error('AI generation test failed');
    },
  });

  const runAITest = () => {
    const testRequest = {
      type: 'blog_post' as const,
      topic: 'Testing Manual AI Provider Selection',
      targetAudience: 'Developers and AI enthusiasts',
      keywords: ['AI', 'provider selection', 'content generation', 'testing'],
      brandVoice: {
        tone: 'professional' as const,
        style: 'conversational' as const,
        vocabulary: 'technical' as const,
        length: 'detailed' as const,
      },
      requirements: {
        wordCount: '500-700',
        includeHeadings: true,
        includeCTA: true,
        seoOptimized: true,
      },
      context: `This is a test of manual AI provider selection. Testing with provider: ${selectedTestProvider}`,
      preferredProvider: selectedTestProvider, // Use selected provider
    };

    testGenerationMutation.mutate(testRequest);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ready':
        return 'text-green-600';
      case 'unhealthy':
      case 'error':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ready':
        return '✅';
      case 'unhealthy':
      case 'error':
        return '❌';
      default:
        return '⚠️';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🧪 AI Content Agent - System Test Panel
        </h2>
        <p className="text-gray-600">
          Monitor system health and test Hybrid AI content generation (OpenAI + Gemini)
        </p>
      </div>

      {/* System Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏥 Backend Server Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="text-gray-500">Checking...</div>
            ) : healthData ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(healthData.success ? 'healthy' : 'unhealthy')}>
                    {getStatusIcon(healthData.success ? 'healthy' : 'unhealthy')} {healthData.success ? 'HEALTHY' : 'UNHEALTHY'}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Version: {healthData.version || '1.0.0'}
                </div>
                <div className="text-sm text-gray-600">
                  Environment: {healthData.environment || 'development'}
                </div>
                <div className="text-sm text-gray-600">
                  Last checked: {new Date().toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="text-red-600">❌ Server unavailable</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Hybrid AI Service
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiHealthLoading ? (
              <div className="text-gray-500">Checking...</div>
            ) : aiHealthData ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(aiHealthData.aiService?.status || 'unknown')}>
                    {getStatusIcon(aiHealthData.aiService?.status || 'unknown')} 
                    {(aiHealthData.aiService?.status || 'UNKNOWN').toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Strategy: {aiHealthData.aiService?.currentProvider || 'Hybrid'}
                </div>
                <div className="text-sm text-gray-600">
                  Available Providers: {aiHealthData.aiService?.availableProviders?.map((p: any) => p.provider).join(', ') || 'OpenAI, Gemini'}
                </div>
                <div className="text-sm text-gray-600">
                  Cost: {aiHealthData.aiService?.strategy || 'Intelligent cost optimization'}
                </div>
                {aiHealthData.aiService?.limits && (
                  <div className="text-xs text-gray-500 mt-2">
                    Limits: {aiHealthData.aiService.limits.requestsPerMinute}/min, 
                    {aiHealthData.aiService.limits.requestsPerDay}/day
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600">❌ AI service unavailable</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Available AI Models */}
      <Card>
        <CardHeader>
          <CardTitle>🧠 Available AI Models</CardTitle>
        </CardHeader>
        <CardContent>
          {modelsLoading ? (
            <div className="text-gray-500">Loading models...</div>
          ) : modelsData?.models ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modelsData.models.map((model: any) => (
                <div
                  key={model.id}
                  className={`p-4 border rounded-lg ${
                    model.recommended ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{model.name}</h3>
                    {model.recommended && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Provider: {model.provider}</div>
                    <div>Cost: {model.costPerToken === 0 ? 'Free' : `$${model.costPerToken}/token`}</div>
                    <div>Max Tokens: {model.maxTokens?.toLocaleString()}</div>
                    <div className="text-xs">{model.description}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No models available</div>
          )}
        </CardContent>
      </Card>

      {/* Content Templates */}
      <Card>
        <CardHeader>
          <CardTitle>📝 Content Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="text-gray-500">Loading templates...</div>
          ) : templatesData?.templates ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templatesData.templates.map((template: any) => (
                <div key={template.id} className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold mb-2">{template.name}</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Type: {template.type.replace('_', ' ')}</div>
                    <div>Provider: {template.provider}</div>
                    <div>Model: {template.model}</div>
                    <div className="text-xs">{template.description}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No templates available</div>
          )}
        </CardContent>
      </Card>

      {/* AI Generation Test */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Test AI Content Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Test the AI integration with manual provider selection or intelligent auto-selection.
            </p>
            
            {/* Provider Selection for Test */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test with Provider:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTestProvider('auto')}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    selectedTestProvider === 'auto'
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🤖 Auto Selection
                </button>
                <button
                  onClick={() => setSelectedTestProvider('openai')}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    selectedTestProvider === 'openai'
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🧠 OpenAI GPT-4
                </button>
                <button
                  onClick={() => setSelectedTestProvider('gemini')}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    selectedTestProvider === 'gemini'
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  ⚡ Gemini Flash
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {selectedTestProvider === 'auto' && 'System will automatically choose the best provider'}
                {selectedTestProvider === 'openai' && 'Force use OpenAI GPT-4 Turbo (premium quality)'}
                {selectedTestProvider === 'gemini' && 'Force use Google Gemini Flash (free tier)'}
              </div>
            </div>
            
            <Button
              onClick={runAITest}
              disabled={testGenerationMutation.isPending}
              className="w-full"
            >
              {testGenerationMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating with {selectedTestProvider === 'auto' ? 'Auto Selection' : selectedTestProvider.toUpperCase()}...
                </>
              ) : (
                `🧪 Run Test with ${selectedTestProvider === 'auto' ? 'Auto Selection' : selectedTestProvider.toUpperCase()}`
              )}
            </Button>

            {testResults && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-3">✅ Test Results</h4>
                
                {/* Provider Selection Results */}
                <div className="mb-4 p-3 bg-white border border-green-200 rounded-md">
                  <h5 className="font-medium text-gray-800 mb-2">🎯 Provider Selection</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <strong>Requested:</strong> 
                      <span className={`ml-1 px-2 py-1 rounded text-xs ${
                        testResults.metadata?.requestedProvider === 'auto' 
                          ? 'bg-blue-100 text-blue-800'
                          : testResults.metadata?.requestedProvider === 'openai'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {testResults.metadata?.requestedProvider || 'auto'}
                      </span>
                    </div>
                    <div>
                      <strong>Selected:</strong>
                      <span className={`ml-1 px-2 py-1 rounded text-xs ${
                        testResults.metadata?.selectedProvider === 'openai'
                          ? 'bg-blue-100 text-blue-800'
                          : testResults.metadata?.selectedProvider === 'gemini'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {testResults.metadata?.selectedProvider || 'unknown'}
                      </span>
                    </div>
                    <div>
                      <strong>Reason:</strong>
                      <span className="ml-1 text-gray-600">
                        {testResults.metadata?.selectionReason === 'manual_selection' 
                          ? 'Manual'
                          : testResults.metadata?.selectionReason === 'intelligent_selection'
                          ? 'Intelligent'
                          : testResults.metadata?.selectionReason === 'error_fallback'
                          ? 'Fallback'
                          : 'Unknown'
                        }
                      </span>
                    </div>
                  </div>
                  
                  {testResults.metadata?.originalError && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      <strong>Error:</strong> {testResults.metadata.originalError}
                    </div>
                  )}
                </div>

                {/* Content Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">
                      {testResults.metadata?.wordCount || 0}
                    </div>
                    <div className="text-xs text-gray-600">Words</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">
                      {testResults.metadata?.seoScore || 0}
                    </div>
                    <div className="text-xs text-gray-600">SEO Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-600">
                      {testResults.metadata?.readabilityScore || 0}
                    </div>
                    <div className="text-xs text-gray-600">Readability</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-orange-600">
                      {testResults.metadata?.engagementScore || 0}
                    </div>
                    <div className="text-xs text-gray-600">Engagement</div>
                  </div>
                </div>

                {/* Additional Test Info */}
                <div className="space-y-2 text-sm">
                  <div><strong>Title:</strong> {testResults.title}</div>
                  <div><strong>Type:</strong> {testResults.type}</div>
                  <div><strong>AI Model:</strong> {testResults.metadata?.aiModel || 'N/A'}</div>
                  <div><strong>Cost:</strong> ${testResults.metadata?.cost || 0}</div>
                  <div><strong>Tokens Used:</strong> {testResults.metadata?.tokensUsed || 'N/A'}</div>
                </div>
                
                <details className="mt-3">
                  <summary className="cursor-pointer text-green-700 font-medium">
                    View Generated Content
                  </summary>
                  <div className="mt-2 p-3 bg-white border rounded text-sm">
                    <div className="whitespace-pre-wrap">{testResults.body}</div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Information */}
      <Card>
        <CardHeader>
          <CardTitle>📡 API Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>Backend URL:</strong> http://localhost:3001</div>
            <div><strong>API Version:</strong> v1</div>
            <div><strong>AI Provider:</strong> Hybrid AI System</div>
            <div><strong>Models:</strong> OpenAI GPT-4 Turbo + Google Gemini Flash</div>
            <div><strong>Features:</strong></div>
            <ul className="list-disc list-inside ml-4 text-gray-600">
              <li>Hybrid AI Content Generation</li>
              <li>Intelligent Provider Selection</li>
              <li>Cost Optimization</li>
              <li>Content Quality Analysis</li>
              <li>SEO Optimization</li>
              <li>Brand Voice Adaptation</li>
              <li>Real-time System Monitoring</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 