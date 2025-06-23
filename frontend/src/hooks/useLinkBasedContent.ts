import { useState, useCallback } from 'react';
import { linkContentApi as linkBasedContentApi, type CreateBatchJobRequest, type BatchJob, type BatchJobStatus } from '../services/api';

export interface LinkBasedContentState {
  currentBatch: BatchJob | null;
  batchItems: any[];
  isCreatingBatch: boolean;
  isCrawling: boolean;
  isGenerating: boolean;
  error: string | null;
  progress: {
    total: number;
    crawled: number;
    generated: number;
    failed: number;
  };
}

export const useLinkBasedContent = () => {
  const [state, setState] = useState<LinkBasedContentState>({
    currentBatch: null,
    batchItems: [],
    isCreatingBatch: false,
    isCrawling: false,
    isGenerating: false,
    error: null,
    progress: {
      total: 0,
      crawled: 0,
      generated: 0,
      failed: 0
    }
  });

  const createBatchJob = useCallback(async (request: CreateBatchJobRequest) => {
    setState(prev => ({ ...prev, isCreatingBatch: true, error: null }));
    
    try {
      const response = await linkBasedContentApi.createBatchJob(request);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          currentBatch: response.data.job,
          batchItems: response.data.items,
          progress: {
            total: response.data.summary.total,
            crawled: response.data.summary.crawled,
            generated: response.data.summary.generated,
            failed: response.data.summary.failed
          },
          isCreatingBatch: false
        }));
        
        return response.data.job;
      } else {
        throw new Error(response.message || 'Failed to create batch job');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create batch job',
        isCreatingBatch: false
      }));
      throw error;
    }
  }, []);

  const startCrawling = useCallback(async (batchId: string) => {
    setState(prev => ({ ...prev, isCrawling: true, error: null }));
    
    try {
      const response = await linkBasedContentApi.startCrawling(batchId);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          currentBatch: response.data.job,
          batchItems: response.data.items,
          isCrawling: false
        }));
        
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to start crawling');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start crawling',
        isCrawling: false
      }));
      throw error;
    }
  }, []);

  const getBatchStatus = useCallback(async (batchId: string) => {
    try {
      const response = await linkBasedContentApi.getBatchJobStatus(batchId);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          currentBatch: response.data.job,
          batchItems: response.data.items,
          progress: {
            total: response.data.summary.total,
            crawled: response.data.summary.crawled,
            generated: response.data.summary.generated,
            failed: response.data.summary.failed
          }
        }));
        
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to get batch status');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get batch status';
      
      // Auto-reset state if batch job not found (backend restart scenario)
      if (errorMessage.includes('not found') || errorMessage.includes('NOT_FOUND')) {
        console.log(`🔄 Batch job ${batchId} not found. Resetting state...`);
        setState({
          currentBatch: null,
          batchItems: [],
          isCreatingBatch: false,
          isCrawling: false,
          isGenerating: false,
          error: 'Batch job not found. Please create a new batch job.',
          progress: {
            total: 0,
            crawled: 0,
            generated: 0,
            failed: 0
          }
        });
        return null;
      }
      
      setState(prev => ({
        ...prev,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const generateContent = useCallback(async (batchId: string) => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    try {
      const response = await linkBasedContentApi.generateContent(batchId);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          currentBatch: response.data.job,
          batchItems: response.data.items,
          isGenerating: false
        }));
        
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to generate content');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to generate content',
        isGenerating: false
      }));
      throw error;
    }
  }, []);

  const resetState = useCallback(() => {
    setState({
      currentBatch: null,
      batchItems: [],
      isCreatingBatch: false,
      isCrawling: false,
      isGenerating: false,
      error: null,
      progress: {
        total: 0,
        crawled: 0,
        generated: 0,
        failed: 0
      }
    });
  }, []);

  return {
    ...state,
    createBatchJob,
    startCrawling,
    getBatchStatus,
    generateContent,
    resetState
  };
}; 