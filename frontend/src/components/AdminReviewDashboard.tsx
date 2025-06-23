import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ContentReader } from './ContentReader';

interface ReviewQueueItem {
  id: string;
  content: {
    id: string;
    title: string;
    body: string;
    excerpt: string;
    type: string;
    metadata: {
      keywords: string[];
      seoTitle: string;
      seoDescription: string;
      wordCount: number;
      readingTime: number;
    };
  };
  qualityScore: number;
  priority: number;
  preview: string;
  estimatedReadTime: number;
  createdAt: string;
  batchJobId?: string;
}

interface AdminReviewDashboardProps {
  onApprove: (contentId: string, options?: any) => Promise<void>;
  onReject: (contentId: string, reason: string) => Promise<void>;
  onEdit: (contentId: string, edits: any) => Promise<void>;
}

export const AdminReviewDashboard: React.FC<AdminReviewDashboardProps> = ({
  onApprove,
  onReject,
  onEdit,
}) => {
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<ReviewQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{
    status: string;
    priority: string;
    sortBy: string;
  }>({
    status: 'pending',
    priority: 'all',
    sortBy: 'priority_desc',
  });
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  useEffect(() => {
    fetchReviewQueue();
  }, [filter]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts if user is typing in input/textarea
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
      return;
    }

    switch (event.key) {
      case 'ArrowRight':
      case 'j':
        event.preventDefault();
        handleNextContent();
        break;
      case 'ArrowLeft':
      case 'k':
        event.preventDefault();
        handlePreviousContent();
        break;
      case 'a':
        if (selectedContent && !isFocusMode) {
          event.preventDefault();
          handleApprove(selectedContent.id);
        }
        break;
      case 'r':
        if (selectedContent && !isFocusMode) {
          event.preventDefault();
          // Trigger reject modal
          const rejectButton = document.querySelector('[data-action="reject"]') as HTMLButtonElement;
          rejectButton?.click();
        }
        break;
      case 'f':
        event.preventDefault();
        // Trigger focus mode
        const focusButton = document.querySelector('[data-action="focus"]') as HTMLButtonElement;
        focusButton?.click();
        break;
      case '?':
        event.preventDefault();
        setShowKeyboardHelp(!showKeyboardHelp);
        break;
      case 'Escape':
        if (isFocusMode) {
          setIsFocusMode(false);
        } else if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        }
        break;
    }
  }, [selectedContent, isFocusMode, showKeyboardHelp]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const fetchReviewQueue = async () => {
    try {
      setLoading(true);
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/review/pending?` + new URLSearchParams({
        status: filter.status,
        priority: filter.priority !== 'all' ? filter.priority : '',
        sortBy: filter.sortBy,
        limit: '20',
      }));

      if (!response.ok) {
        throw new Error('Failed to fetch review queue');
      }

      const data = await response.json();
      setReviewQueue(data.items || []);
      
      // Auto-select first item if none selected
      if (!selectedContent && data.items?.length > 0) {
        setSelectedContent(data.items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (contentId: string) => {
    try {
      await onApprove(contentId, {
        autoPublish: false,
        qualityRating: selectedContent?.qualityScore ? Math.round(selectedContent.qualityScore / 10) : 5,
      });
      
      // Remove from queue and select next
      const updatedQueue = reviewQueue.filter(item => item.id !== contentId);
      setReviewQueue(updatedQueue);
      
      if (selectedContent?.id === contentId) {
        setSelectedContent(updatedQueue[0] || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve content');
    }
  };

  const handleReject = async (contentId: string, reason: string) => {
    try {
      await onReject(contentId, reason);
      
      // Remove from queue and select next
      const updatedQueue = reviewQueue.filter(item => item.id !== contentId);
      setReviewQueue(updatedQueue);
      
      if (selectedContent?.id === contentId) {
        setSelectedContent(updatedQueue[0] || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject content');
    }
  };

  const handleBulkApprove = async () => {
    if (bulkSelected.length === 0) return;
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/review/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentIds: bulkSelected,
          action: 'approve',
          autoPublish: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Bulk approval failed');
      }

      // Refresh queue
      await fetchReviewQueue();
      setBulkSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk approval failed');
    }
  };

  const handleEditContent = async (contentId: string, edits: any) => {
    try {
      await onEdit(contentId, edits);
      
      // Update local state
      if (selectedContent && selectedContent.id === contentId) {
        setSelectedContent({
          ...selectedContent,
          content: {
            ...selectedContent.content,
            ...edits,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save edits');
    }
  };

  const handleToggleFocus = (focusMode: boolean) => {
    setIsFocusMode(focusMode);
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 3) return { label: 'High', color: 'bg-red-100 text-red-800' };
    if (priority >= 2) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Low', color: 'bg-green-100 text-green-800' };
  };

  const handleNextContent = () => {
    if (!selectedContent) return;
    const currentIndex = reviewQueue.findIndex(item => item.id === selectedContent.id);
    const nextIndex = (currentIndex + 1) % reviewQueue.length;
    setSelectedContent(reviewQueue[nextIndex]);
  };

  const handlePreviousContent = () => {
    if (!selectedContent) return;
    const currentIndex = reviewQueue.findIndex(item => item.id === selectedContent.id);
    const prevIndex = currentIndex === 0 ? reviewQueue.length - 1 : currentIndex - 1;
    setSelectedContent(reviewQueue[prevIndex]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading review queue...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800 font-medium">Error</div>
        <div className="text-red-600">{error}</div>
        <Button onClick={fetchReviewQueue} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  // Focus mode - show only content reader
  if (isFocusMode) {
    return selectedContent ? (
      <div className="h-screen">
        <ContentReader
          content={selectedContent.content}
          qualityScore={selectedContent.qualityScore}
          onEdit={handleEditContent}
          onApprove={handleApprove}
          onReject={handleReject}
          onToggleFocus={handleToggleFocus}
        />
      </div>
    ) : null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Admin Review Dashboard</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {reviewQueue.length} items pending
                </span>
                {bulkSelected.length > 0 && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    {bulkSelected.length} selected
                  </span>
                )}
              </div>
            </div>
            
            {/* Navigation & Bulk Actions */}
            <div className="flex items-center space-x-3">
              {/* Keyboard Help */}
              <Button
                onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                variant="outline"
                size="sm"
                className="flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Shortcuts (?)</span>
              </Button>

              {/* Content Navigation */}
              {selectedContent && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Button
                    onClick={handlePreviousContent}
                    variant="outline"
                    size="sm"
                    disabled={reviewQueue.length <= 1}
                    title="Previous content (← or K)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Button>
                  <span className="px-2">
                    {reviewQueue.findIndex(item => item.id === selectedContent.id) + 1} of {reviewQueue.length}
                  </span>
                  <Button
                    onClick={handleNextContent}
                    variant="outline"
                    size="sm"
                    disabled={reviewQueue.length <= 1}
                    title="Next content (→ or J)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              )}

              {/* Bulk Actions */}
              {bulkSelected.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Button onClick={handleBulkApprove} className="bg-green-600 hover:bg-green-700">
                    Approve Selected ({bulkSelected.length})
                  </Button>
                  <Button 
                    onClick={() => setBulkSelected([])} 
                    variant="outline"
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Navigate content</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">← → or J K</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Approve content</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">A</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reject content</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">R</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Focus mode</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">F</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Show/hide shortcuts</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">?</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Exit focus/modal</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">ESC</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Shortcuts work when not typing in input fields
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Status:</label>
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Priority:</label>
                <select
                  value={filter.priority}
                  onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="3">High</option>
                  <option value="2">Medium</option>
                  <option value="1">Low</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={filter.sortBy}
                  onChange={(e) => setFilter({ ...filter, sortBy: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="priority_desc">Priority (High to Low)</option>
                  <option value="quality_desc">Quality Score (High to Low)</option>
                  <option value="created_desc">Newest First</option>
                  <option value="created_asc">Oldest First</option>
                </select>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>High Quality: {reviewQueue.filter(item => item.qualityScore >= 85).length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                <span>Medium Quality: {reviewQueue.filter(item => item.qualityScore >= 70 && item.qualityScore < 85).length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span>Low Quality: {reviewQueue.filter(item => item.qualityScore < 70).length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Content List - Optimized for better visibility */}
          <div className="xl:col-span-1">
            <Card className="h-full">
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Review Queue</h2>
                  <Button
                    onClick={fetchReviewQueue}
                    variant="outline"
                    size="sm"
                    className="p-2"
                    title="Refresh queue"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-gray-200 max-h-[calc(100vh-350px)] overflow-y-auto">
                {reviewQueue.map((item) => {
                  const priorityInfo = getPriorityLabel(item.priority);
                  const isSelected = selectedContent?.id === item.id;
                  const isBulkSelected = bulkSelected.includes(item.id);
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedContent(item)}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={isBulkSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setBulkSelected([...bulkSelected, item.id]);
                            } else {
                              setBulkSelected(bulkSelected.filter(id => id !== item.id));
                            }
                          }}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityInfo.color}`}>
                              {priorityInfo.label}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getQualityScoreColor(item.qualityScore)}`}>
                              {Math.round(item.qualityScore)}%
                            </span>
                          </div>
                          
                          <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                            {item.content.title}
                          </h3>
                          
                          <p className="text-xs text-gray-500 mt-1 line-clamp-3 leading-relaxed">
                            {item.preview}
                          </p>
                          
                          <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                            <span>{item.content.metadata.wordCount} words</span>
                            <span>{item.estimatedReadTime} min read</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Content Preview - Enhanced Reading Experience */}
          <div className="xl:col-span-3">
            {selectedContent ? (
              <ContentReader
                content={selectedContent.content}
                qualityScore={selectedContent.qualityScore}
                onEdit={handleEditContent}
                onApprove={handleApprove}
                onReject={handleReject}
                onToggleFocus={handleToggleFocus}
              />
            ) : (
              <Card className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xl font-medium mb-2">Select content to review</p>
                  <p className="text-sm">Choose an item from the queue to start reviewing</p>
                  <div className="mt-4 text-xs text-gray-400">
                    Tip: Use keyboard shortcuts ← → to navigate between content
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 