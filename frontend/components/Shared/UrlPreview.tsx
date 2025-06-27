import React, { useState, useEffect } from 'react';
import { extractTitleFromText, UrlTitleResult } from '../../utils/urlService';
import { LinkIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface UrlPreviewProps {
  text: string;
  onPreviewChange?: (preview: UrlTitleResult | null) => void;
}

const UrlPreview: React.FC<UrlPreviewProps> = ({ text, onPreviewChange }) => {
  const [preview, setPreview] = useState<UrlTitleResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const extractPreview = async () => {
      if (!text.trim()) {
        setPreview(null);
        onPreviewChange?.(null);
        return;
      }

      setIsLoading(true);
      try {
        const result = await extractTitleFromText(text);
        setPreview(result);
        onPreviewChange?.(result);
      } catch (error) {
        console.error('Failed to extract URL preview:', error);
        setPreview(null);
        onPreviewChange?.(null);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(extractPreview, 300);
    return () => clearTimeout(timeoutId);
  }, [text, onPreviewChange]);

  const handleDismiss = () => {
    setIsVisible(false);
    setPreview(null);
    onPreviewChange?.(null);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  if (!isVisible || (!preview && !isLoading)) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-sm text-gray-600 dark:text-gray-300">Loading preview...</span>
        </div>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10"
        aria-label="Dismiss preview"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
      
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {preview.image && !imageError ? (
            <img
              src={preview.image}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-md"
              onError={handleImageError}
            />
          ) : (
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-md flex items-center justify-center">
              <PhotoIcon className="h-8 w-8 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100" style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {preview.title || 'Untitled'}
          </div>
          {preview.description && (
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1" style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {preview.description}
            </div>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
            {preview.url}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UrlPreview;