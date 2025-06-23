import React, { useState, useEffect } from 'react';

interface SettingsProps {
  authToken: string | null;
  onLogout: () => void;
}

interface SystemSettings {
  defaultAiProvider: 'openai' | 'gemini' | 'auto';
  defaultContentType: 'blog_post' | 'social_media' | 'email' | 'ad_copy';
  defaultWordCount: string;
  defaultBrandVoice: {
    tone: 'professional' | 'casual' | 'friendly' | 'authoritative';
    style: 'formal' | 'conversational' | 'technical' | 'creative';
    vocabulary: 'simple' | 'advanced' | 'industry-specific';
    length: 'concise' | 'detailed' | 'comprehensive';
  };
  autoApproveThreshold: number;
  enableNotifications: boolean;
  notificationEmail: string;
}

interface SystemStats {
  totalContent: number;
  approvedContent: number;
  publishedContent: number;
  totalWords: number;
  averageQuality: number;
  lastActivity: string;
}

const Settings: React.FC<SettingsProps> = ({ authToken, onLogout }) => {
  const [settings, setSettings] = useState<SystemSettings>({
    defaultAiProvider: 'auto',
    defaultContentType: 'blog_post',
    defaultWordCount: '1000-1500',
    defaultBrandVoice: {
      tone: 'professional',
      style: 'conversational',
      vocabulary: 'industry-specific',
      length: 'detailed',
    },
    autoApproveThreshold: 85,
    enableNotifications: true,
    notificationEmail: 'admin@aicontentagent.com',
  });

  const [stats, setStats] = useState<SystemStats>({
    totalContent: 0,
    approvedContent: 0,
    publishedContent: 0,
    totalWords: 0,
    averageQuality: 0,
    lastActivity: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = () => {
    const saved = localStorage.getItem('systemSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  };

  const loadStats = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics/overview`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        // Mock stats for demo
        const mockStats: SystemStats = {
          totalContent: 42,
          approvedContent: 38,
          publishedContent: 35,
          totalWords: 52780,
          averageQuality: 87.5,
          lastActivity: new Date().toISOString(),
        };
        setStats(mockStats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      // Save to localStorage
      localStorage.setItem('systemSettings', JSON.stringify(settings));
      
      // In a real app, you would also save to backend
      // const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      // await fetch(`${API_BASE_URL}/api/v1/settings`, { ... });

      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings({
      defaultAiProvider: 'auto',
      defaultContentType: 'blog_post',
      defaultWordCount: '1000-1500',
      defaultBrandVoice: {
        tone: 'professional',
        style: 'conversational',
        vocabulary: 'industry-specific',
        length: 'detailed',
      },
      autoApproveThreshold: 85,
      enableNotifications: true,
      notificationEmail: 'admin@aicontentagent.com',
    });
  };

  const exportData = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/finetuning/dataset`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-content-agent-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Failed to export data:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">⚙️ Settings</h2>
        <p className="mt-2 text-gray-600">
          Configure system defaults and manage your AI Content Agent
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Statistics */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Statistics</h3>
            
            {isLoadingStats ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Content</span>
                  <span className="text-lg font-semibold text-gray-900">{stats.totalContent}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Approved</span>
                  <span className="text-lg font-semibold text-green-600">{stats.approvedContent}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Published</span>
                  <span className="text-lg font-semibold text-blue-600">{stats.publishedContent}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Words</span>
                  <span className="text-lg font-semibold text-gray-900">{stats.totalWords.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Quality</span>
                  <span className="text-lg font-semibold text-purple-600">{stats.averageQuality}%</span>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    Last activity: {new Date(stats.lastActivity).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <button
                onClick={exportData}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                📥 Export Training Data
              </button>
              
              <button
                onClick={onLogout}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-red-700"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>

        {/* Settings Configuration */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">System Configuration</h3>
              
              {saveMessage && (
                <div className={`px-3 py-1 rounded-md text-sm ${
                  saveMessage.includes('success') 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {saveMessage}
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Default AI Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default AI Provider
                </label>
                <select
                  value={settings.defaultAiProvider}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    defaultAiProvider: e.target.value as any 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="auto">🤖 Auto Selection (Recommended)</option>
                  <option value="openai">🧠 OpenAI GPT-4 (Premium)</option>
                  <option value="gemini">⚡ Google Gemini (Free)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Auto selection balances quality and cost based on content complexity
                </p>
              </div>

              {/* Default Content Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Content Type
                </label>
                <select
                  value={settings.defaultContentType}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    defaultContentType: e.target.value as any 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="blog_post">📄 Blog Post</option>
                  <option value="social_media">📱 Social Media</option>
                  <option value="email">📧 Email</option>
                  <option value="ad_copy">📢 Ad Copy</option>
                </select>
              </div>

              {/* Default Word Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Word Count
                </label>
                <select
                  value={settings.defaultWordCount}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    defaultWordCount: e.target.value 
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="500-800">500-800 words</option>
                  <option value="800-1200">800-1200 words</option>
                  <option value="1000-1500">1000-1500 words</option>
                  <option value="1500-2000">1500-2000 words</option>
                  <option value="2000+">2000+ words</option>
                </select>
              </div>

              {/* Default Brand Voice */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Default Brand Voice
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Tone</label>
                    <select
                      value={settings.defaultBrandVoice.tone}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        defaultBrandVoice: { 
                          ...prev.defaultBrandVoice, 
                          tone: e.target.value as any 
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                      value={settings.defaultBrandVoice.style}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        defaultBrandVoice: { 
                          ...prev.defaultBrandVoice, 
                          style: e.target.value as any 
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="conversational">Conversational</option>
                      <option value="formal">Formal</option>
                      <option value="technical">Technical</option>
                      <option value="creative">Creative</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Vocabulary</label>
                    <select
                      value={settings.defaultBrandVoice.vocabulary}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        defaultBrandVoice: { 
                          ...prev.defaultBrandVoice, 
                          vocabulary: e.target.value as any 
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="simple">Simple</option>
                      <option value="advanced">Advanced</option>
                      <option value="industry-specific">Industry-specific</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Length</label>
                    <select
                      value={settings.defaultBrandVoice.length}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        defaultBrandVoice: { 
                          ...prev.defaultBrandVoice, 
                          length: e.target.value as any 
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="concise">Concise</option>
                      <option value="detailed">Detailed</option>
                      <option value="comprehensive">Comprehensive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Auto Approve Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auto Approve Threshold ({settings.autoApproveThreshold}%)
                </label>
                <input
                  type="range"
                  min="70"
                  max="95"
                  value={settings.autoApproveThreshold}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    autoApproveThreshold: parseInt(e.target.value) 
                  }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>70% (More content)</span>
                  <span>95% (Higher quality)</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Content with quality score above this threshold will be auto-approved
                </p>
              </div>

              {/* Notifications */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Email Notifications
                  </label>
                  <button
                    onClick={() => setSettings(prev => ({ 
                      ...prev, 
                      enableNotifications: !prev.enableNotifications 
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.enableNotifications ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.enableNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {settings.enableNotifications && (
                  <input
                    type="email"
                    value={settings.notificationEmail}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      notificationEmail: e.target.value 
                    }))}
                    placeholder="Enter notification email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <button
                  onClick={resetSettings}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Reset to Defaults
                </button>
                
                <button
                  onClick={saveSettings}
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </div>
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 