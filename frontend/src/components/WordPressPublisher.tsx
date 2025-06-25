import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from './ui/Card';
import WordPressSetupGuide from './WordPressSetupGuide';

interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

interface PublishSettings {
  status: 'draft' | 'publish' | 'private';
  categories: string[];
  tags: string[];
  scheduledDate?: string;
  featuredImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
}

interface WordPressPublisherProps {
  className?: string;
}

interface ConnectionTest {
  success: boolean;
  message: string;
  details?: {
    siteTitle?: string;
    siteUrl?: string;
    wordpressVersion?: string;
    availableCategories?: Array<{ id: number; name: string }>;
    availableTags?: Array<{ id: number; name: string }>;
  };
}

interface PublishResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  message: string;
  publishedAt?: Date;
}

export const WordPressPublisher: React.FC<WordPressPublisherProps> = ({ className }) => {
  // State for credentials
  const [credentials, setCredentials] = useState<WordPressCredentials>({
    siteUrl: '',
    username: '',
    applicationPassword: '',
  });

  // State for publish settings
  const [settings, setSettings] = useState<PublishSettings>({
    status: 'draft',
    categories: [],
    tags: [],
    scheduledDate: '',
    featuredImageUrl: '',
    seoTitle: '',
    seoDescription: '',
  });

  // State for UI
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionTest | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Validation
  const validateCredentials = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!credentials.siteUrl) {
      newErrors.siteUrl = 'Site URL is required';
    } else if (!credentials.siteUrl.startsWith('http')) {
      newErrors.siteUrl = 'Site URL must start with http:// or https://';
    }

    if (!credentials.username) {
      newErrors.username = 'Username is required';
    }

    if (!credentials.applicationPassword) {
      newErrors.applicationPassword = 'Application Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Test WordPress connection
  const testConnection = async () => {
    if (!validateCredentials()) return;

    setIsTestingConnection(true);
    setConnectionResult(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/publishing/wordpress/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success) {
        setConnectionResult(data.data);
      } else {
        const errorMessage = data.error?.message || data.data?.message || 'Connection test failed';
        setConnectionResult({
          success: false,
          message: errorMessage,
        });
        
        // Auto-show setup guide for Application Password errors
        if (errorMessage.includes('Application Password') || errorMessage.includes('incorrect_password')) {
          setShowSetupGuide(true);
        }
      }
    } catch {
      setConnectionResult({
        success: false,
        message: 'Network error occurred during connection test',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Publish to WordPress
  const publishToWordPress = async () => {
    if (!validateCredentials()) return;

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/publishing/wordpress/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...credentials,
          settings: {
            ...settings,
            categories: settings.categories.filter(cat => cat.trim()),
            tags: settings.tags.filter(tag => tag.trim()),
            scheduledDate: settings.scheduledDate ? new Date(settings.scheduledDate) : undefined,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPublishResult(data.data);
      } else {
        setPublishResult({
          success: false,
          message: data.error?.message || 'Publishing failed',
        });
      }
    } catch {
      setPublishResult({
        success: false,
        message: 'Network error occurred during publishing',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle array input changes
  const handleArrayInput = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item);
    setter(items);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">WordPress Publisher</h2>
        <p className="text-gray-600">
          Publish your AI-generated content directly to WordPress sites using the REST API.
        </p>
      </div>

      {/* WordPress Credentials */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">WordPress Credentials</h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="siteUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Site URL *
            </label>
            <input
              type="url"
              id="siteUrl"
              value={credentials.siteUrl}
              onChange={(e) => setCredentials(prev => ({ ...prev, siteUrl: e.target.value }))}
              placeholder="https://yoursite.com"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.siteUrl ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.siteUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.siteUrl}</p>
            )}
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username *
            </label>
            <input
              type="text"
              id="username"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              placeholder="admin"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.username ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="applicationPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Application Password *
            </label>
            <input
              type="password"
              id="applicationPassword"
              value={credentials.applicationPassword}
              onChange={(e) => setCredentials(prev => ({ ...prev, applicationPassword: e.target.value }))}
              placeholder="xxxx xxxx xxxx xxxx"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.applicationPassword ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.applicationPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.applicationPassword}</p>
            )}
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">
                Generate an Application Password in your WordPress admin under Users → Profile
              </p>
              <button
                type="button"
                onClick={() => setShowSetupGuide(true)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Setup Guide
              </button>
            </div>
          </div>

          <Button
            onClick={testConnection}
            disabled={isTestingConnection}
            variant="outline"
            className="w-full"
          >
            {isTestingConnection ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                Testing Connection...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
        </div>

        {/* Connection Result */}
        {connectionResult && (
          <div className={`mt-4 p-4 rounded-md ${
            connectionResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {connectionResult.success ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h4 className={`text-sm font-medium ${
                  connectionResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {connectionResult.success ? 'Connection Successful' : 'Connection Failed'}
                </h4>
                <p className={`text-sm ${
                  connectionResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {connectionResult.message}
                </p>
                {connectionResult.details && (
                  <div className="mt-2 text-sm text-green-700">
                    <p><strong>Site:</strong> {connectionResult.details.siteTitle}</p>
                    <p><strong>Version:</strong> {connectionResult.details.wordpressVersion}</p>
                    {connectionResult.details.availableCategories && (
                      <p><strong>Categories:</strong> {connectionResult.details.availableCategories.length} available</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Publishing Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Publishing Settings</h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Post Status
            </label>
            <select
              id="status"
              value={settings.status}
              onChange={(e) => setSettings(prev => ({ ...prev, status: e.target.value as 'draft' | 'publish' | 'private' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="publish">Publish</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div>
            <label htmlFor="categories" className="block text-sm font-medium text-gray-700 mb-1">
              Categories
            </label>
            <input
              type="text"
              id="categories"
              value={settings.categories.join(', ')}
              onChange={(e) => handleArrayInput(e.target.value, (items) => setSettings(prev => ({ ...prev, categories: items })))}
              placeholder="Marketing, AI, Technology"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Separate multiple categories with commas</p>
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              value={settings.tags.join(', ')}
              onChange={(e) => handleArrayInput(e.target.value, (items) => setSettings(prev => ({ ...prev, tags: items })))}
              placeholder="automation, artificial intelligence, content marketing"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Separate multiple tags with commas</p>
          </div>

          <div>
            <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Date (Optional)
            </label>
            <input
              type="datetime-local"
              id="scheduledDate"
              value={settings.scheduledDate}
              onChange={(e) => setSettings(prev => ({ ...prev, scheduledDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Leave empty to publish immediately</p>
          </div>

          <div>
            <label htmlFor="featuredImageUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Featured Image URL (Optional)
            </label>
            <input
              type="url"
              id="featuredImageUrl"
              value={settings.featuredImageUrl}
              onChange={(e) => setSettings(prev => ({ ...prev, featuredImageUrl: e.target.value }))}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="seoTitle" className="block text-sm font-medium text-gray-700 mb-1">
              SEO Title (Optional)
            </label>
            <input
              type="text"
              id="seoTitle"
              value={settings.seoTitle}
              onChange={(e) => setSettings(prev => ({ ...prev, seoTitle: e.target.value }))}
              placeholder="Custom SEO title for search engines"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="seoDescription" className="block text-sm font-medium text-gray-700 mb-1">
              SEO Description (Optional)
            </label>
            <textarea
              id="seoDescription"
              value={settings.seoDescription}
              onChange={(e) => setSettings(prev => ({ ...prev, seoDescription: e.target.value }))}
              placeholder="Custom meta description for search engines"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* Publish Button */}
      <div className="flex justify-center">
        <Button
          onClick={publishToWordPress}
          disabled={isPublishing || !connectionResult?.success}
          className="px-8 py-3 text-lg"
        >
          {isPublishing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Publishing...
            </>
          ) : (
            'Publish to WordPress'
          )}
        </Button>
      </div>

      {/* Publish Result */}
      {publishResult && (
        <Card className={`p-6 ${
          publishResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {publishResult.success ? (
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h4 className={`text-lg font-medium ${
                publishResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {publishResult.success ? 'Published Successfully!' : 'Publishing Failed'}
              </h4>
              <p className={`text-sm ${
                publishResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {publishResult.message}
              </p>
              {publishResult.success && publishResult.externalUrl && (
                <div className="mt-2">
                  <a
                    href={publishResult.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    View Published Post
                    <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* WordPress Setup Guide Modal */}
      {showSetupGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <WordPressSetupGuide onClose={() => setShowSetupGuide(false)} />
          </div>
        </div>
      )}
    </div>
  );
}; 