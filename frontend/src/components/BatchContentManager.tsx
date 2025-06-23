import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface BatchGenerationJob {
  id: string;
  projectId: string;
  researchJobId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalContent: number;
  completedContent: number;
  failedContent: number;
  progressData: {
    currentStep: string;
    percentage: number;
    eta: string;
    generatedIds: string[];
    failedIds: string[];
  };
  generationSettings: {
    brandVoice: {
      tone: string;
      style: string;
      vocabulary: string;
    };
    targetAudience: string;
    requirements: {
      wordCount: string;
      includeHeadings: boolean;
      seoOptimized: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface BatchContentManagerProps {
  onStartBatchGeneration: (settings: any) => Promise<string>;
  onCancelJob: (jobId: string) => Promise<void>;
}

export const BatchContentManager: React.FC<BatchContentManagerProps> = ({
  onStartBatchGeneration,
  onCancelJob,
}) => {
  const [jobs, setJobs] = useState<BatchGenerationJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<BatchGenerationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [newJobSettings, setNewJobSettings] = useState({
    researchJobId: '',
    targetCount: 10,
    brandVoice: {
      tone: 'professional',
      style: 'conversational',
      vocabulary: 'industry-specific',
    },
    targetAudience: 'Marketing professionals',
    requirements: {
      wordCount: '1000-1500',
      includeHeadings: true,
      seoOptimized: true,
    },
  });

  useEffect(() => {
    fetchJobs();
    
    // Poll for job updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/v1/batch/jobs`);
      if (!response.ok) {
        throw new Error('Failed to fetch batch jobs');
      }
      
      const data = await response.json();
      setJobs(data.jobs || []);
      
      // Update selected job if it exists
      if (selectedJob) {
        const updatedJob = data.jobs?.find((job: BatchGenerationJob) => job.id === selectedJob.id);
        if (updatedJob) {
          setSelectedJob(updatedJob);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBatchGeneration = async () => {
    try {
      const jobId = await onStartBatchGeneration(newJobSettings);
      setShowNewJobForm(false);
      
      // Reset form
      setNewJobSettings({
        researchJobId: '',
        targetCount: 10,
        brandVoice: {
          tone: 'professional',
          style: 'conversational',
          vocabulary: 'industry-specific',
        },
        targetAudience: 'Marketing professionals',
        requirements: {
          wordCount: '1000-1500',
          includeHeadings: true,
          seoOptimized: true,
        },
      });
      
      // Refresh jobs
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start batch generation');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await onCancelJob(jobId);
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading batch jobs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Batch Content Generation</h2>
          <p className="text-gray-600">Manage and monitor batch content generation jobs</p>
        </div>
        
        <Button 
          onClick={() => setShowNewJobForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Batch Job
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium">Error</div>
          <div className="text-red-600">{error}</div>
        </div>
      )}

      {/* New Job Form */}
      {showNewJobForm && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create New Batch Generation Job</h3>
              <Button 
                onClick={() => setShowNewJobForm(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Research Job ID (Optional)
                </label>
                <input
                  type="text"
                  value={newJobSettings.researchJobId}
                  onChange={(e) => setNewJobSettings({ ...newJobSettings, researchJobId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter research job ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Content Count
                </label>
                <input
                  type="number"
                  value={newJobSettings.targetCount}
                  onChange={(e) => setNewJobSettings({ ...newJobSettings, targetCount: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  min="1"
                  max="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand Voice Tone
                </label>
                <select
                  value={newJobSettings.brandVoice.tone}
                  onChange={(e) => setNewJobSettings({
                    ...newJobSettings,
                    brandVoice: { ...newJobSettings.brandVoice, tone: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="friendly">Friendly</option>
                  <option value="authoritative">Authoritative</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Writing Style
                </label>
                <select
                  value={newJobSettings.brandVoice.style}
                  onChange={(e) => setNewJobSettings({
                    ...newJobSettings,
                    brandVoice: { ...newJobSettings.brandVoice, style: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="conversational">Conversational</option>
                  <option value="formal">Formal</option>
                  <option value="technical">Technical</option>
                  <option value="creative">Creative</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={newJobSettings.targetAudience}
                  onChange={(e) => setNewJobSettings({ ...newJobSettings, targetAudience: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Marketing professionals"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Word Count Range
                </label>
                <select
                  value={newJobSettings.requirements.wordCount}
                  onChange={(e) => setNewJobSettings({
                    ...newJobSettings,
                    requirements: { ...newJobSettings.requirements, wordCount: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="500-800">500-800 words</option>
                  <option value="800-1200">800-1200 words</option>
                  <option value="1000-1500">1000-1500 words</option>
                  <option value="1500-2000">1500-2000 words</option>
                  <option value="2000+">2000+ words</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newJobSettings.requirements.includeHeadings}
                  onChange={(e) => setNewJobSettings({
                    ...newJobSettings,
                    requirements: { ...newJobSettings.requirements, includeHeadings: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Include headings</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newJobSettings.requirements.seoOptimized}
                  onChange={(e) => setNewJobSettings({
                    ...newJobSettings,
                    requirements: { ...newJobSettings.requirements, seoOptimized: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">SEO optimized</span>
              </label>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleStartBatchGeneration}
                className="bg-green-600 hover:bg-green-700"
              >
                Start Batch Generation
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Jobs List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {jobs.map((job) => (
          <Card 
            key={job.id} 
            className={`cursor-pointer transition-all ${
              selectedJob?.id === job.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedJob(job)}
          >
            <div className="p-6">
              {/* Job Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Batch Job #{job.id.slice(-8)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
              </div>

              {/* Progress Bar */}
              {job.status === 'processing' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>{job.progressData.currentStep}</span>
                    <span>{job.progressData.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progressData.percentage}%` }}
                    />
                  </div>
                  {job.progressData.eta && (
                    <p className="text-xs text-gray-500 mt-1">
                      ETA: {job.progressData.eta}
                    </p>
                  )}
                </div>
              )}

              {/* Job Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{job.totalContent}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{job.completedContent}</div>
                  <div className="text-xs text-gray-600">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{job.failedContent}</div>
                  <div className="text-xs text-gray-600">Failed</div>
                </div>
              </div>

              {/* Job Settings Preview */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Tone:</span> {job.generationSettings.brandVoice.tone}</div>
                  <div><span className="font-medium">Style:</span> {job.generationSettings.brandVoice.style}</div>
                  <div><span className="font-medium">Audience:</span> {job.generationSettings.targetAudience}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {job.completedAt ? (
                    `Completed ${new Date(job.completedAt).toLocaleString()}`
                  ) : (
                    `Updated ${new Date(job.updatedAt).toLocaleString()}`
                  )}
                </div>
                
                {job.status === 'processing' && (
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelJob(job.id);
                    }}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <Card className="mt-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Job Details - #{selectedJob.id.slice(-8)}
              </h3>
              <Button 
                onClick={() => setSelectedJob(null)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Job Information */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">Job Information</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Status:</span> {selectedJob.status}</div>
                  <div><span className="font-medium">Created:</span> {new Date(selectedJob.createdAt).toLocaleString()}</div>
                  <div><span className="font-medium">Updated:</span> {new Date(selectedJob.updatedAt).toLocaleString()}</div>
                  {selectedJob.completedAt && (
                    <div><span className="font-medium">Completed:</span> {new Date(selectedJob.completedAt).toLocaleString()}</div>
                  )}
                  {selectedJob.researchJobId && (
                    <div><span className="font-medium">Research Job:</span> {selectedJob.researchJobId}</div>
                  )}
                </div>
              </div>

              {/* Generation Settings */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-3">Generation Settings</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Brand Voice:</span></div>
                  <div className="ml-4">
                    <div>- Tone: {selectedJob.generationSettings.brandVoice.tone}</div>
                    <div>- Style: {selectedJob.generationSettings.brandVoice.style}</div>
                    <div>- Vocabulary: {selectedJob.generationSettings.brandVoice.vocabulary}</div>
                  </div>
                  <div><span className="font-medium">Target Audience:</span> {selectedJob.generationSettings.targetAudience}</div>
                  <div><span className="font-medium">Word Count:</span> {selectedJob.generationSettings.requirements.wordCount}</div>
                  <div><span className="font-medium">Include Headings:</span> {selectedJob.generationSettings.requirements.includeHeadings ? 'Yes' : 'No'}</div>
                  <div><span className="font-medium">SEO Optimized:</span> {selectedJob.generationSettings.requirements.seoOptimized ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>

            {/* Progress Details */}
            {selectedJob.status === 'processing' && (
              <div className="mt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Progress Details</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm space-y-2">
                    <div><span className="font-medium">Current Step:</span> {selectedJob.progressData.currentStep}</div>
                    <div><span className="font-medium">Progress:</span> {selectedJob.progressData.percentage}%</div>
                    {selectedJob.progressData.eta && (
                      <div><span className="font-medium">ETA:</span> {selectedJob.progressData.eta}</div>
                    )}
                    <div><span className="font-medium">Generated IDs:</span> {selectedJob.progressData.generatedIds.length} items</div>
                    <div><span className="font-medium">Failed IDs:</span> {selectedJob.progressData.failedIds.length} items</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}; 