import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  GlobeAltIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
  ServerIcon
} from '@heroicons/react/24/outline';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { wordpressMultiSiteApi } from '../services/api';

interface WordPressSite {
  id: string;
  name: string;
  url: string;
  categories: string[];
  keywords: string[];
  priority: number;
  isActive: boolean;
  lastConnectionTest?: {
    success: boolean;
    message: string;
    timestamp: string;
  };
}

interface SmartRoutingPreview {
  title: string;
  recommendedSite: {
    id: string;
    name: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
  };
  alternativeSites: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
}

export function WordPressMultiSiteManager() {
  const [sites, setSites] = useState<WordPressSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingConnections, setTestingConnections] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [routingPreview, setRoutingPreview] = useState<SmartRoutingPreview | null>(null);
  const [crossPostSites, setCrossPostSites] = useState<string[]>([]);

  // Load sites on mount
  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const response = await wordpressMultiSiteApi.getSites();
      if (response.success && response.data && response.data.sites) {
        setSites(response.data.sites);
      } else {
        console.error('Invalid response structure:', response);
        toast.error('Cấu trúc dữ liệu không hợp lệ');
      }
    } catch (error) {
      toast.error('Không thể tải danh sách sites');
      console.error('Load sites error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testAllConnections = async () => {
    setTestingConnections(true);
    try {
      const results = await wordpressMultiSiteApi.testConnections();
      
      // Update sites with test results
      setSites(prevSites => 
        prevSites.map(site => {
          const testResult = results[site.id];
          return {
            ...site,
            lastConnectionTest: {
              success: testResult?.success || false,
              message: testResult?.message || 'No result',
              timestamp: new Date().toISOString(),
            },
          };
        })
      );

      const successCount = Object.values(results).filter((r: any) => r.success).length;
      toast.success(`Kiểm tra hoàn tất: ${successCount}/${Object.keys(results).length} sites kết nối thành công`);
    } catch (error) {
      toast.error('Lỗi khi kiểm tra kết nối');
      console.error(error);
    } finally {
      setTestingConnections(false);
    }
  };

  const previewSmartRouting = async () => {
    if (!previewContent.trim()) {
      toast.error('Vui lòng nhập nội dung để preview');
      return;
    }

    try {
      const data = await wordpressMultiSiteApi.previewRouting({ 
        title: previewContent,
        content: previewContent 
      });
      setRoutingPreview(data);
    } catch (error) {
      toast.error('Lỗi khi preview routing');
      console.error(error);
    }
  };

  const handleCrossPost = async () => {
    if (crossPostSites.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 site');
      return;
    }

    if (!previewContent.trim()) {
      toast.error('Vui lòng nhập nội dung để đăng');
      return;
    }

    try {
      const results = await wordpressMultiSiteApi.crossPost({
        title: `Test Cross-Post: ${previewContent}`,
        content: `<p>${previewContent}</p>`,
        siteIds: crossPostSites,
      });
      
      const successCount = results.filter((r: any) => r.success).length;
      toast.success(`Đăng thành công lên ${successCount}/${results.length} sites`);
      
      // Reset form
      setCrossPostSites([]);
      setPreviewContent('');
    } catch (error) {
      toast.error('Lỗi khi cross-post');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">WordPress Multi-Site Manager</h2>
          <p className="text-gray-600 mt-1">Quản lý và kiểm tra 3 WordPress sites</p>
        </div>
        <Button 
          onClick={testAllConnections}
          disabled={testingConnections}
          className="flex items-center gap-2"
        >
          {testingConnections ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <ServerIcon className="h-4 w-4" />
          )}
          Test All Connections
        </Button>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sites.map((site) => (
          <Card key={site.id} className={`${!site.isActive && 'opacity-60'}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GlobeAltIcon className="h-5 w-5" />
                    {site.name}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{site.url}</p>
                </div>
                <Badge variant={site.isActive ? 'success' : 'secondary'}>
                  {site.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Categories */}
              <div>
                <Label className="text-xs text-gray-600">Categories</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {site.categories.map((cat) => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div>
                <Label className="text-xs text-gray-600">Keywords</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {site.keywords.slice(0, 5).map((keyword) => (
                    <span key={keyword} className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {keyword}
                    </span>
                  ))}
                  {site.keywords.length > 5 && (
                    <span className="text-xs text-gray-500">+{site.keywords.length - 5} more</span>
                  )}
                </div>
              </div>

              {/* Connection Status */}
              {site.lastConnectionTest && (
                <div className={`p-2 rounded ${
                  site.lastConnectionTest.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {site.lastConnectionTest.success ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    ) : (
                      <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-xs ${
                      site.lastConnectionTest.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {site.lastConnectionTest.message}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Tested: {new Date(site.lastConnectionTest.timestamp).toLocaleString('vi-VN')}
                  </p>
                </div>
              )}

              {/* Priority */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Priority</span>
                <Badge variant="outline">{site.priority}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Smart Routing Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            Smart Routing Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nhập tiêu đề hoặc nội dung để test</Label>
            <Input
              value={previewContent}
              onChange={(e) => setPreviewContent(e.target.value)}
              placeholder="VD: Chụp ảnh cưới tại Đà Lạt..."
              className="mt-1"
            />
          </div>

          <Button 
            onClick={previewSmartRouting}
            disabled={!previewContent.trim()}
            className="w-full"
          >
            Preview Routing Decision
          </Button>

          {routingPreview && (
            <div className="mt-4 space-y-3">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Recommended Site</h4>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{routingPreview.recommendedSite.name}</span>
                  <Badge variant={
                    routingPreview.recommendedSite.confidence === 'high' ? 'success' :
                    routingPreview.recommendedSite.confidence === 'medium' ? 'warning' : 'secondary'
                  }>
                    {routingPreview.recommendedSite.confidence} confidence
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{routingPreview.recommendedSite.reason}</p>
              </div>

              {routingPreview.alternativeSites.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2">Alternative Sites</h4>
                  {routingPreview.alternativeSites.map((alt) => (
                    <div key={alt.id} className="text-sm mb-1">
                      <span className="font-medium">{alt.name}:</span> {alt.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cross-Post Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DocumentDuplicateIcon className="h-5 w-5" />
            Cross-Post Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Chọn sites để đăng</Label>
            <div className="flex gap-4 mt-2">
              {sites.filter(s => s.isActive).map((site) => (
                <label key={site.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crossPostSites.includes(site.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCrossPostSites([...crossPostSites, site.id]);
                      } else {
                        setCrossPostSites(crossPostSites.filter(id => id !== site.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{site.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleCrossPost}
            disabled={crossPostSites.length === 0 || !previewContent.trim()}
            className="w-full"
          >
            Cross-Post to {crossPostSites.length} Sites
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 