import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const TranslationDebugger: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [debugInfo, setDebugInfo] = useState<{
    isInitialized: boolean;
    loadedNamespaces: string[];
    languages: string[];
    currentLanguage: string;
    isLoading: boolean;
  }>({
    isInitialized: false,
    loadedNamespaces: [],
    languages: [],
    currentLanguage: '',
    isLoading: i18n.isInitialized ? false : true,
  });

  useEffect(() => {
    // Initial state
    updateDebugInfo();

    // Listen for initialization
    const handleInitialized = () => {
      console.log("i18n initialized!");
      updateDebugInfo();
    };

    // Listen for language changes
    const handleLanguageChanged = (lng: string) => {
      console.log(`Language changed to: ${lng}`);
      updateDebugInfo();
    };

    // Listen for loading completions
    const handleLoaded = () => {
      console.log("Translation loaded!");
      updateDebugInfo();
    };

    i18n.on('initialized', handleInitialized);
    i18n.on('languageChanged', handleLanguageChanged);
    i18n.on('loaded', handleLoaded);

    return () => {
      i18n.off('initialized', handleInitialized);
      i18n.off('languageChanged', handleLanguageChanged);
      i18n.off('loaded', handleLoaded);
    };
  }, [i18n]);

  const updateDebugInfo = () => {
    setDebugInfo({
      isInitialized: i18n.isInitialized,
      loadedNamespaces: i18n.reportNamespaces ? i18n.reportNamespaces.getUsedNamespaces() : [],
      languages: i18n.languages ? [...i18n.languages] : [],
      currentLanguage: i18n.language || '',
      isLoading: false,
    });
  };

  // Function to change language
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-0 right-0 bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-700 rounded-tl-lg shadow-lg z-50 text-sm">
      <h3 className="font-bold mb-2 text-blue-600 dark:text-blue-400">i18n Debug</h3>
      <div className="space-y-1">
        <div>
          <span className="font-semibold">Status:</span>{' '}
          {debugInfo.isInitialized ? '✅ Initialized' : '⏳ Initializing...'}
        </div>
        <div>
          <span className="font-semibold">Current Language:</span> {debugInfo.currentLanguage}
        </div>
        <div>
          <span className="font-semibold">Available Languages:</span>{' '}
          <div className="flex flex-wrap gap-1 mt-1">
            {i18n.options.supportedLngs && 
              i18n.options.supportedLngs
                .filter(lng => lng !== 'cimode' && lng !== 'dev')
                .map(lng => (
                  <button
                    key={lng}
                    onClick={() => changeLanguage(lng)}
                    className={`px-2 py-1 text-xs rounded ${
                      debugInfo.currentLanguage === lng
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {lng}
                  </button>
                ))}
          </div>
        </div>
        <div>
          <span className="font-semibold">Loaded Namespaces:</span>{' '}
          {debugInfo.loadedNamespaces.length > 0 
            ? debugInfo.loadedNamespaces.join(', ') 
            : 'None'}
        </div>
        <div>
          <span className="font-semibold">Test Translation:</span>{' '}
          {t('common.loading')}
        </div>
      </div>
    </div>
  );
};

export default TranslationDebugger;

