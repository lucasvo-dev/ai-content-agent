import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface ContentReaderProps {
  content: {
    id: string;
    title: string;
    body: string;
    excerpt?: string;
    metadata: {
      keywords: string[];
      seoTitle?: string;
      seoDescription?: string;
      wordCount: number;
      readingTime: number;
    };
  };
  qualityScore?: number;
  onEdit?: (contentId: string, edits: any) => void;
  onApprove?: (contentId: string) => void;
  onReject?: (contentId: string, reason: string) => void;
  readOnly?: boolean;
  onToggleFocus?: (isFocused: boolean) => void;
}

export const ContentReader: React.FC<ContentReaderProps> = ({
  content,
  qualityScore,
  onEdit,
  onApprove,
  onReject,
  readOnly = false,
  onToggleFocus,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState(content.body);
  const [fontSize, setFontSize] = useState(19);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [fontFamily, setFontFamily] = useState('serif');
  const [backgroundColor, setBackgroundColor] = useState('cream');
  const [showMetadata, setShowMetadata] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // Reading preferences from localStorage
  useEffect(() => {
    const savedPrefs = localStorage.getItem('contentReaderPrefs');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      setFontSize(prefs.fontSize || 19);
      setLineHeight(prefs.lineHeight || 1.8);
      setFontFamily(prefs.fontFamily || 'serif');
      setBackgroundColor(prefs.backgroundColor || 'cream');
      setFocusMode(prefs.focusMode || false);
    }
  }, []);

  // Reading progress tracking
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = (scrollTop / scrollHeight) * 100;
      setReadingProgress(Math.min(progress, 100));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const savePreferences = (prefs: any) => {
    localStorage.setItem('contentReaderPrefs', JSON.stringify(prefs));
  };

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    savePreferences({ fontSize: size, lineHeight, fontFamily, backgroundColor, focusMode });
  };

  const handleLineHeightChange = (height: number) => {
    setLineHeight(height);
    savePreferences({ fontSize, lineHeight: height, fontFamily, backgroundColor, focusMode });
  };

  const handleFontFamilyChange = (family: string) => {
    setFontFamily(family);
    savePreferences({ fontSize, lineHeight, fontFamily: family, backgroundColor, focusMode });
  };

  const handleBackgroundChange = (bg: string) => {
    setBackgroundColor(bg);
    savePreferences({ fontSize, lineHeight, fontFamily, backgroundColor: bg, focusMode });
  };

  const handleToggleFocusMode = () => {
    const newFocusMode = !focusMode;
    setFocusMode(newFocusMode);
    savePreferences({ fontSize, lineHeight, fontFamily, backgroundColor, focusMode: newFocusMode });
    if (onToggleFocus) {
      onToggleFocus(newFocusMode);
    }
  };

  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit(content.id, { body: editedContent });
      setEditMode(false);
    }
  };

  const handleApprove = () => {
    if (onApprove) {
      onApprove(content.id);
    }
  };

  const handleReject = () => {
    if (onReject && rejectReason.trim()) {
      onReject(content.id, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
    }
  };

  const formatContentForDisplay = (text: string) => {
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/## (.*)/g, '<h2 style="font-size: 1.5em; font-weight: bold; margin: 2em 0 1em 0; color: #1f2937; line-height: 1.3;">$1</h2>')
      .replace(/### (.*)/g, '<h3 style="font-size: 1.3em; font-weight: bold; margin: 1.5em 0 0.75em 0; color: #374151; line-height: 1.3;">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: #f3f4f6; padding: 0.125em 0.25em; border-radius: 0.25em; font-family: monospace; font-size: 0.9em;">$1</code>');
  };

  const getBackgroundStyle = () => {
    const backgrounds = {
      white: '#ffffff',
      cream: '#fefdf8',
      sepia: '#f7f3e9',
      dark: '#1f2937',
      paper: '#fdfdfd',
    };
    return backgrounds[backgroundColor as keyof typeof backgrounds] || '#fefdf8';
  };

  const getTextColor = () => {
    return backgroundColor === 'dark' ? '#f9fafb' : '#1f2937';
  };

  const getFontFamilyStyle = () => {
    const fonts = {
      serif: 'Georgia, "Times New Roman", serif',
      sans: '"Inter", "Helvetica Neue", Arial, sans-serif', 
      mono: '"JetBrains Mono", "Fira Code", monospace',
      charter: '"Charter", Georgia, serif',
    };
    return fonts[fontFamily as keyof typeof fonts] || fonts.serif;
  };

  return (
    <div className={`h-full flex flex-col ${focusMode ? 'fixed inset-0 z-50' : ''}`}>
      {/* Reading Progress Bar */}
      <div className="w-full h-1 bg-gray-200">
        <div 
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Reading Controls */}
      <div className="bg-gray-50 border-b p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            {/* Font Size Controls */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Font Size:</label>
              <div className="flex items-center space-x-1">
                {[16, 18, 19, 20, 22, 24, 26].map((size) => (
                  <button
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      fontSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Height Controls */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Line Height:</label>
              <div className="flex items-center space-x-1">
                {[1.5, 1.6, 1.8, 2.0, 2.2].map((height) => (
                  <button
                    key={height}
                    onClick={() => handleLineHeightChange(height)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      lineHeight === height
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {height}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family Controls */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Font:</label>
              <select
                value={fontFamily}
                onChange={(e) => handleFontFamilyChange(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
              >
                <option value="serif">Serif</option>
                <option value="charter">Charter</option>
                <option value="sans">Sans-serif</option>
                <option value="mono">Monospace</option>
              </select>
            </div>

            {/* Theme Controls */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Theme:</label>
              <div className="flex items-center space-x-1">
                {[
                  { key: 'white', label: '☀️', title: 'Light' },
                  { key: 'cream', label: '🌅', title: 'Cream' },
                  { key: 'paper', label: '📄', title: 'Paper' },
                  { key: 'sepia', label: '📜', title: 'Sepia' },
                  { key: 'dark', label: '🌙', title: 'Dark' },
                ].map((theme) => (
                  <button
                    key={theme.key}
                    onClick={() => handleBackgroundChange(theme.key)}
                    title={theme.title}
                    className={`px-2 py-1 text-sm rounded transition-colors ${
                      backgroundColor === theme.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              {showMetadata ? 'Hide' : 'Show'} Metadata
            </button>
            
            <button
              onClick={handleToggleFocusMode}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
              data-action="focus"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d={focusMode ? "M6 18L18 6M6 6l12 12" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"} />
              </svg>
              <span>{focusMode ? 'Exit Focus' : 'Focus Mode'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div 
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: getBackgroundStyle() }}
      >
        <div className={`mx-auto px-8 py-12 ${focusMode ? 'max-w-5xl' : 'max-w-6xl'}`}>
          {/* Metadata Section */}
          {showMetadata && (
            <div className="mb-10 p-8 bg-opacity-60 backdrop-blur-sm rounded-xl border shadow-sm"
                 style={{ 
                   backgroundColor: backgroundColor === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(249, 250, 251, 0.9)',
                   borderColor: backgroundColor === 'dark' ? '#374151' : '#e5e7eb'
                 }}>
              <h3 className="text-xl font-semibold mb-6" style={{ color: getTextColor() }}>
                Content Metadata
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="space-y-3">
                  <div>
                    <span className="font-medium" style={{ color: getTextColor() }}>Word Count:</span>
                    <span className="ml-2 text-lg font-semibold" style={{ color: getTextColor() }}>{content.metadata.wordCount}</span>
                  </div>
                  <div>
                    <span className="font-medium" style={{ color: getTextColor() }}>Reading Time:</span>
                    <span className="ml-2 text-lg font-semibold" style={{ color: getTextColor() }}>{content.metadata.readingTime} min</span>
                  </div>
                </div>
                
                {qualityScore && (
                  <div>
                    <span className="font-medium" style={{ color: getTextColor() }}>Quality Score:</span>
                    <div className="mt-1">
                      <span className="inline-block px-3 py-2 rounded-lg text-sm font-semibold"
                            style={{
                              backgroundColor: qualityScore >= 85 ? '#dcfce7' : qualityScore >= 70 ? '#fef3c7' : '#fee2e2',
                              color: qualityScore >= 85 ? '#166534' : qualityScore >= 70 ? '#92400e' : '#991b1b'
                            }}>
                        {Math.round(qualityScore)}%
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-500">
                  Progress: {Math.round(readingProgress)}%
                </div>
              </div>

              {content.metadata.seoTitle && (
                <div className="mt-6">
                  <span className="font-medium" style={{ color: getTextColor() }}>SEO Title:</span>
                  <p className="mt-2 text-base font-medium" style={{ color: getTextColor() }}>{content.metadata.seoTitle}</p>
                </div>
              )}

              {content.metadata.seoDescription && (
                <div className="mt-4">
                  <span className="font-medium" style={{ color: getTextColor() }}>SEO Description:</span>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: getTextColor() }}>{content.metadata.seoDescription}</p>
                </div>
              )}

              {content.metadata.keywords.length > 0 && (
                <div className="mt-4">
                  <span className="font-medium" style={{ color: getTextColor() }}>Keywords:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {content.metadata.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-block px-3 py-1 text-sm rounded-full"
                        style={{
                          backgroundColor: backgroundColor === 'dark' ? '#374151' : '#e5e7eb',
                          color: getTextColor()
                        }}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <h1 
            className="font-bold mb-8 leading-tight"
            style={{ 
              fontSize: `${fontSize + 10}px`,
              lineHeight: lineHeight - 0.2,
              fontFamily: getFontFamilyStyle(),
              color: getTextColor()
            }}
          >
            {content.title}
          </h1>

          {/* Excerpt */}
          {content.excerpt && (
            <div 
              className="mb-10 p-6 border-l-4 border-blue-400 rounded-r-lg"
              style={{ 
                backgroundColor: backgroundColor === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(219, 234, 254, 0.5)',
                color: getTextColor()
              }}
            >
              <p 
                className="font-medium italic"
                style={{ 
                  fontSize: `${fontSize + 3}px`,
                  lineHeight: lineHeight + 0.1,
                  fontFamily: getFontFamilyStyle()
                }}
              >
                {content.excerpt}
              </p>
            </div>
          )}

          {/* Main Content */}
          {editMode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium" style={{ color: getTextColor() }}>
                  Edit Content
                </h3>
                <div className="flex items-center space-x-2">
                  <Button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                    Save Changes
                  </Button>
                  <Button 
                    onClick={() => setEditMode(false)} 
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-[600px] p-6 border border-gray-300 rounded-lg font-mono text-sm resize-none"
                style={{ 
                  backgroundColor: getBackgroundStyle(),
                  color: getTextColor(),
                  fontSize: `${fontSize - 1}px`,
                  lineHeight: lineHeight
                }}
                placeholder="Edit content here..."
              />
            </div>
          ) : (
            <div 
              className="prose prose-xl max-w-none"
              style={{ 
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight,
                fontFamily: getFontFamilyStyle(),
                color: getTextColor()
              }}
              dangerouslySetInnerHTML={{ 
                __html: formatContentForDisplay(content.body)
              }}
            />
          )}
        </div>
      </div>

      {/* Action Bar */}
      {!readOnly && (
        <div 
          className="border-t p-6 flex-shrink-0"
          style={{ 
            backgroundColor: backgroundColor === 'dark' ? '#374151' : '#f9fafb',
            borderColor: backgroundColor === 'dark' ? '#4b5563' : '#e5e7eb'
          }}
        >
          <div className={`flex items-center justify-between mx-auto ${focusMode ? 'max-w-5xl' : 'max-w-6xl'}`}>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => setEditMode(true)}
                variant="outline"
                disabled={editMode}
                className="flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Content</span>
              </Button>
              
              <Button 
                onClick={() => setShowRejectModal(true)}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 flex items-center space-x-2"
                data-action="reject"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Reject</span>
              </Button>
            </div>
            
            <Button 
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700 flex items-center space-x-2 px-6 py-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Approve & Publish</span>
            </Button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reject Content
            </h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting this content:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none"
              placeholder="Enter rejection reason..."
            />
            <div className="flex items-center justify-end space-x-2 mt-4">
              <Button 
                onClick={() => setShowRejectModal(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleReject}
                className="bg-red-600 hover:bg-red-700"
                disabled={!rejectReason.trim()}
              >
                Reject Content
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 