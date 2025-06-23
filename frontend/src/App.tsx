import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

import ContentGenerator from './components/ContentGenerator';
import { LinkContentWorkflow } from './components/LinkContentWorkflow';
import './App.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  const [currentView, setCurrentView] = useState<'workflow' | 'generator'>('workflow');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">
                  AI Content Agent
                </h1>
                <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  v2.0.0
                </span>
              </div>
              <div className="flex items-center space-x-4">
                {/* Navigation */}
                <nav className="flex space-x-4">
                  <button
                    onClick={() => setCurrentView('workflow')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      currentView === 'workflow'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🔗 Link Content Workflow
                  </button>
                  <button
                    onClick={() => setCurrentView('generator')}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      currentView === 'generator'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    ✨ AI Content Generator
                  </button>
                </nav>
                <div className="flex items-center text-sm text-gray-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  Backend Connected
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="py-8">
          {currentView === 'workflow' ? <LinkContentWorkflow /> : <ContentGenerator />}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-sm text-gray-500">
              <p>
                AI Content Agent - Link-based content generation and publishing workflow
              </p>
              <p className="mt-1">
                Powered by Hybrid AI: OpenAI GPT-4 Turbo + Google Gemini Flash
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* React Query Devtools */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
