import React, { useState, useEffect } from 'react';

interface PublisherProps {
  authToken: string | null;
}

interface ApprovedContent {
  id: string;
  title: string;
  excerpt: string;
  status: 'approved' | 'publishing' | 'published' | 'failed';
  metadata: {
    seoTitle: string;
    seoDescription: string;
    keywords: string[];
    wordCount: number;
    readingTime: number;
    qualityScore: number;
  };
  approvedAt: string;
  publishedAt?: string;
  publishedUrl?: string;
  wordpressId?: string;
  publishError?: string;
}

interface WordPressSettings {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  defaultStatus: 'draft' | 'publish';
  defaultCategory: string;
  defaultTags: string[];
}

const Publisher: React.FC<PublisherProps> = ({ authToken }) => {
  const [approvedContent, setApprovedContent] = useState<ApprovedContent[]>([]);
  const [wpSettings, setWpSettings] = useState<WordPressSettings>({
    siteUrl: '',
    username: '',
    applicationPassword: '',
    defaultStatus: 'draft',
    defaultCategory: '',
    defaultTags: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [error, setError] = useState('');
  const [selectedContent, setSelectedContent] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    fetchApprovedContent();
    loadWpSettings();
  }, []);

  const fetchApprovedContent = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/review/pending?status=approved`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Mock approved content for demo
        const mockContent: ApprovedContent[] = [
          {
            id: 'content-1',
            title: 'AI-Powered Marketing: The Future is Here',
            excerpt: 'Discover how AI is revolutionizing marketing strategies and customer engagement.',
            status: 'approved',
            metadata: {
              seoTitle: 'AI Marketing: Complete Guide to Future Strategies',
              seoDescription: 'Learn how AI transforms marketing with automation, personalization, and data insights.',
              keywords: ['AI marketing', 'automation', 'digital strategy'],
              wordCount: 1245,
              readingTime: 6,
              qualityScore: 92,
            },
            approvedAt: '2024-01-15T10:30:00Z',
          },
          {
            id: 'content-2',
            title: 'Content Creation Automation with AI',
            excerpt: 'Streamline your content workflow with intelligent automation tools.',
            status: 'published',
            metadata: {
              seoTitle: 'AI Content Creation: Automation Guide 2024',
              seoDescription: 'Master AI-powered content creation with our comprehensive automation guide.',
              keywords: ['content automation', 'AI writing', 'productivity'],
              wordCount: 1567,
              readingTime: 7,
              qualityScore: 88,
            },
            approvedAt: '2024-01-14T15:20:00Z',
            publishedAt: '2024-01-14T16:45:00Z',
            publishedUrl: 'https://example.com/ai-content-automation',
            wordpressId: '142',
          },
          {
            id: 'content-3',
            title: 'SEO Optimization Using Machine Learning',
            excerpt: 'Advanced SEO techniques powered by machine learning algorithms.',
            status: 'failed',
            metadata: {
              seoTitle: 'ML-Powered SEO: Advanced Optimization Techniques',
              seoDescription: 'Boost your SEO with machine learning insights and automated optimization.',
              keywords: ['SEO', 'machine learning', 'optimization'],
              wordCount: 1890,
              readingTime: 9,
              qualityScore: 85,
            },
            approvedAt: '2024-01-13T09:15:00Z',
            publishError: 'WordPress connection timeout',
          },
        ];
        setApprovedContent(mockContent);
      }
    } catch (err) {
      console.error('Failed to fetch approved content:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWpSettings = () => {
    const saved = localStorage.getItem('wpSettings');
    if (saved) {
      setWpSettings(JSON.parse(saved));
    }
  };

  const saveWpSettings = () => {
    localStorage.setItem('wpSettings', JSON.stringify(wpSettings));
  };

  const testWordPressConnection = async () => {
    if (!wpSettings.siteUrl || !wpSettings.username || !wpSettings.applicationPassword) {
      setError('Please fill in all WordPress credentials');
      return;
    }

    setIsTestingConnection(true);
    setError('');

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/publishing/wordpress/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          siteUrl: wpSettings.siteUrl,
          username: wpSettings.username,
          applicationPassword: wpSettings.applicationPassword,
        }),
      });

      if (response.ok) {
        setConnectionStatus('connected');
        saveWpSettings();
      } else {
        setConnectionStatus('error');
        setError('Failed to connect to WordPress');
      }
    } catch (err) {
      setConnectionStatus('error');
      setError('Connection test failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSelectContent = (contentId: string) => {
    setSelectedContent(prev => 
      prev.includes(contentId)
        ? prev.filter(id => id !== contentId)
        : [...prev, contentId]
    );
  };

  const handleSelectAll = () => {
    const publishableContent = approvedContent
      .filter(content => content.status === 'approved')
      .map(content => content.id);
    
    setSelectedContent(
      selectedContent.length === publishableContent.length ? [] : publishableContent
    );
  };

  const publishToWordPress = async (contentIds: string[]) => {
    if (!contentIds.length) {
      setError('Please select content to publish');
      return;
    }

    if (connectionStatus !== 'connected') {
      setError('Please test WordPress connection first');
      return;
    }

    setIsPublishing(true);
    setError('');

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      for (const contentId of contentIds) {
        // Update status to publishing
        setApprovedContent(prev => 
          prev.map(content => 
            content.id === contentId 
              ? { ...content, status: 'publishing' }
              : content
          )
        );

        const response = await fetch(`${API_BASE_URL}/api/v1/publishing/wordpress/publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            contentId,
            wpCredentials: {
              siteUrl: wpSettings.siteUrl,
              username: wpSettings.username,
              applicationPassword: wpSettings.applicationPassword,
            },
            settings: {
              status: wpSettings.defaultStatus,
              category: wpSettings.defaultCategory,
              tags: wpSettings.defaultTags,
            },
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setApprovedContent(prev => 
            prev.map(content => 
              content.id === contentId 
                ? { 
                    ...content, 
                    status: 'published',
                    publishedAt: new Date().toISOString(),
                    publishedUrl: result.data?.url || '#',
                    wordpressId: result.data?.externalId || 'unknown',
                  }
                : content
            )
          );
        } else {
          setApprovedContent(prev => 
            prev.map(content => 
              content.id === contentId 
                ? { 
                    ...content, 
                    status: 'failed',
                    publishError: 'Publishing failed',
                  }
                : content
            )
          );
        }

        // Delay between publishes
        if (contentIds.indexOf(contentId) < contentIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setSelectedContent([]);
    } catch (err) {
      setError('Publishing failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const retryPublish = async (contentId: string) => {
    await publishToWordPress([contentId]);
  };

  const getStatusColor = (status: ApprovedContent['status']) => {
    switch (status) {
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'publishing': return 'bg-yellow-100 text-yellow-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: ApprovedContent['status']) => {
    switch (status) {
      case 'approved': return '✅';
      case 'publishing': return '🔄';
      case 'published': return '🚀';
      case 'failed': return '❌';
      default: return '📝';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading approved content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">🚀 Publisher</h2>
        <p className="mt-2 text-gray-600">
          Publish approved content to WordPress and manage your publications
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* WordPress Settings */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">WordPress Settings</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Site URL
              </label>
              <input
                type="url"
                value={wpSettings.siteUrl}
                onChange={(e) => setWpSettings(prev => ({ ...prev, siteUrl: e.target.value }))}
                placeholder="https://yoursite.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={wpSettings.username}
                onChange={(e) => setWpSettings(prev => ({ ...prev, username: e.target.value }))}
                placeholder="admin"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Application Password
              </label>
              <input
                type="password"
                value={wpSettings.applicationPassword}
                onChange={(e) => setWpSettings(prev => ({ ...prev, applicationPassword: e.target.value }))}
                placeholder="xxxx xxxx xxxx xxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Status
              </label>
              <select
                value={wpSettings.defaultStatus}
                onChange={(e) => setWpSettings(prev => ({ ...prev, defaultStatus: e.target.value as 'draft' | 'publish' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="draft">Draft</option>
                <option value="publish">Publish</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Category
              </label>
              <input
                type="text"
                value={wpSettings.defaultCategory}
                onChange={(e) => setWpSettings(prev => ({ ...prev, defaultCategory: e.target.value }))}
                placeholder="Uncategorized"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <button
              onClick={testWordPressConnection}
              disabled={isTestingConnection}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isTestingConnection ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Testing...
                </div>
              ) : (
                'Test Connection'
              )}
            </button>

            {connectionStatus !== 'unknown' && (
              <div className={`p-3 rounded-md ${
                connectionStatus === 'connected' 
                  ? 'bg-green-50 text-green-800' 
                  : 'bg-red-50 text-red-800'
              }`}>
                <div className="flex items-center">
                  <span className="mr-2">
                    {connectionStatus === 'connected' ? '✅' : '❌'}
                  </span>
                  <span className="text-sm font-medium">
                    {connectionStatus === 'connected' 
                      ? 'Connected successfully' 
                      : 'Connection failed'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Content List */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow">
            {/* Content Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Approved Content ({approvedContent.length})
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {approvedContent.filter(c => c.status === 'published').length} published, 
                    {' '}{approvedContent.filter(c => c.status === 'approved').length} ready to publish
                  </p>
                </div>
                
                {approvedContent.filter(c => c.status === 'approved').length > 0 && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {selectedContent.length === approvedContent.filter(c => c.status === 'approved').length 
                        ? 'Deselect All' 
                        : 'Select All'}
                    </button>
                    
                    {selectedContent.length > 0 && (
                      <button
                        onClick={() => publishToWordPress(selectedContent)}
                        disabled={isPublishing || connectionStatus !== 'connected'}
                        className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        {isPublishing ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Publishing...
                          </div>
                        ) : (
                          `Publish Selected (${selectedContent.length})`
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content Items */}
            <div className="divide-y divide-gray-200">
              {approvedContent.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No approved content</h3>
                  <p className="text-gray-600">
                    Approved content from the Content Creator will appear here.
                  </p>
                </div>
              ) : (
                approvedContent.map((content) => (
                  <div key={content.id} className="px-6 py-4">
                    <div className="flex items-start space-x-4">
                      {/* Checkbox */}
                      {content.status === 'approved' && (
                        <div className="flex-shrink-0 pt-1">
                          <input
                            type="checkbox"
                            checked={selectedContent.includes(content.id)}
                            onChange={() => handleSelectContent(content.id)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </div>
                      )}

                      {/* Content Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-lg font-medium text-gray-900 truncate">
                            {content.title}
                          </h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(content.status)}`}>
                            {getStatusIcon(content.status)} {content.status.charAt(0).toUpperCase() + content.status.slice(1)}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-3">{content.excerpt}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 mb-3">
                          <div>Words: <span className="font-medium">{content.metadata.wordCount}</span></div>
                          <div>Reading: <span className="font-medium">{content.metadata.readingTime}min</span></div>
                          <div>Quality: <span className="font-medium">{content.metadata.qualityScore}/100</span></div>
                          <div>Keywords: <span className="font-medium">{content.metadata.keywords.length}</span></div>
                        </div>

                        {content.status === 'published' && content.publishedUrl && (
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-gray-600">Published:</span>
                            <a 
                              href={content.publishedUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              View on WordPress
                            </a>
                            <span className="text-gray-500">
                              {new Date(content.publishedAt!).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {content.status === 'failed' && content.publishError && (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-red-600">
                              Error: {content.publishError}
                            </div>
                            <button
                              onClick={() => retryPublish(content.id)}
                              className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Publisher; 