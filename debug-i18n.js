/**
 * i18n Debugging Utility
 * This script helps diagnose issues with i18next configuration and language switching.
 * 
 * Usage:
 * 1. Include this script in your HTML or paste it in the browser console
 * 2. Call various functions to test i18n functionality
 *   - checkI18nInitialization() - Verify i18n is properly initialized
 *   - changeLanguage('es') - Test language switching
 *   - testAllTranslations() - Check if all translations are working
 *   - showAvailableLanguages() - Display all configured languages
 */

const i18nDebug = (function() {
  // Private variables
  let _translationTestKeys = [
    'common.loading',
    'navigation.home',
    'profile.title',
    'errors.somethingWentWrong'
  ];

  /**
   * Check if i18n is properly initialized
   * @returns {boolean} - true if i18n is available and initialized
   */
  function checkI18nInitialization() {
    console.group('🔍 i18n Initialization Check');
    
    try {
      // Check if i18n is available
      if (typeof i18n === 'undefined') {
        console.error('❌ i18n is not defined. Make sure you have imported and initialized i18next.');
        console.groupEnd();
        return false;
      }
      
      console.log('✅ i18n is defined');
      
      // Check if i18n is initialized
      if (!i18n.isInitialized) {
        console.error('❌ i18n is defined but not initialized. Check your i18n.init() call.');
        console.groupEnd();
        return false;
      }
      
      console.log('✅ i18n is initialized');
      console.log(`ℹ️ Current language: ${i18n.language}`);
      console.log(`ℹ️ Fallback language: ${i18n.options.fallbackLng}`);
      console.log(`ℹ️ Available languages: ${i18n.options.supportedLngs || 'Not explicitly configured'}`);
      console.log(`ℹ️ Namespace(s): ${i18n.options.defaultNS}`);
      console.log(`ℹ️ Debug mode: ${i18n.options.debug ? 'Enabled' : 'Disabled'}`);
      
      // Check if translations are loading correctly
      const translationExists = i18n.exists('common.loading');
      console.log(`${translationExists ? '✅' : '❌'} Test translation 'common.loading': ${translationExists ? i18n.t('common.loading') : 'Not found'}`);
      
      console.groupEnd();
      return true;
    } catch (error) {
      console.error('❌ Error checking i18n initialization:', error);
      console.groupEnd();
      return false;
    }
  }

  /**
   * Change the current language
   * @param {string} language - Language code to switch to (e.g., 'en', 'es')
   */
  function changeLanguage(language) {
    console.group(`🔄 Changing language to: ${language}`);
    
    try {
      if (typeof i18n === 'undefined') {
        console.error('❌ i18n is not defined. Cannot change language.');
        console.groupEnd();
        return;
      }
      
      // Get current language before change
      const currentLanguage = i18n.language;
      console.log(`ℹ️ Current language before change: ${currentLanguage}`);
      
      // Change language
      i18n.changeLanguage(language)
        .then(() => {
          console.log(`✅ Language changed to: ${i18n.language}`);
          
          // Check if language was actually changed
          if (i18n.language !== language) {
            console.warn(`⚠️ Requested language was ${language}, but current language is ${i18n.language}`);
          }
          
          // Test a translation in the new language
          const translationKey = 'common.loading';
          console.log(`ℹ️ Test translation '${translationKey}': ${i18n.t(translationKey)}`);
          
          console.groupEnd();
        })
        .catch(error => {
          console.error('❌ Error changing language:', error);
          console.groupEnd();
        });
    } catch (error) {
      console.error('❌ Error in changeLanguage:', error);
      console.groupEnd();
    }
  }

  /**
   * Test translations for all configured languages
   */
  function testAllTranslations() {
    console.group('🔄 Testing Translations');
    
    try {
      if (typeof i18n === 'undefined') {
        console.error('❌ i18n is not defined. Cannot test translations.');
        console.groupEnd();
        return;
      }
      
      // Get all available languages
      const languages = i18n.options.supportedLngs || [i18n.language, i18n.options.fallbackLng].filter(Boolean);
      
      console.log(`ℹ️ Testing translations for keys: ${_translationTestKeys.join(', ')}`);
      
      // Test each language
      languages.forEach(lang => {
        if (lang === 'cimode' || lang === 'dev') return; // Skip special language modes
        
        console.group(`🌐 Language: ${lang}`);
        
        // Store current language to restore later
        const currentLanguage = i18n.language;
        
        // Temporarily change language
        i18n.changeLanguage(lang).then(() => {
          // Test all keys for this language
          _translationTestKeys.forEach(key => {
            const exists = i18n.exists(key);
            console.log(`${exists ? '✅' : '❌'} ${key}: ${exists ? i18n.t(key) : 'Missing'}`);
          });
          
          // Restore original language
          i18n.changeLanguage(currentLanguage);
        });
        
        console.groupEnd();
      });
      
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error testing translations:', error);
      console.groupEnd();
    }
  }

  /**
   * Show all available language resources
   */
  function showAvailableLanguages() {
    console.group('🌐 Available Languages');
    
    try {
      if (typeof i18n === 'undefined') {
        console.error('❌ i18n is not defined.');
        console.groupEnd();
        return;
      }
      
      // Get all languages that have resources
      const store = i18n.store ? i18n.store.data : {};
      console.log('ℹ️ Languages with resources:', Object.keys(store));
      
      // Log all namespaces for each language
      Object.keys(store).forEach(lang => {
        console.group(`🌐 ${lang}`);
        const namespaces = Object.keys(store[lang] || {});
        console.log(`ℹ️ Namespaces: ${namespaces.join(', ')}`);
        
        // Show a sample of translations from each namespace
        namespaces.forEach(ns => {
          console.group(`📦 ${ns}`);
          const translations = store[lang][ns] || {};
          const sampleKeys = Object.keys(translations).slice(0, 5);
          
          if (sampleKeys.length === 0) {
            console.log('❌ No translations found in this namespace');
          } else {
            console.log('ℹ️ Sample translations:');
            sampleKeys.forEach(key => {
              if (typeof translations[key] === 'object') {
                console.log(`${key}: [Object]`);
              } else {
                console.log(`${key}: ${translations[key]}`);
              }
            });
          }
          
          console.groupEnd();
        });
        
        console.groupEnd();
      });
      
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error showing available languages:', error);
      console.groupEnd();
    }
  }

  /**
   * Check if translation files are being loaded correctly
   */
  function checkResourceLoading() {
    console.group('🔍 Resource Loading Check');
    
    try {
      if (typeof i18n === 'undefined') {
        console.error('❌ i18n is not defined.');
        console.groupEnd();
        return;
      }
      
      // Check backend config
      if (!i18n.options.backend) {
        console.error('❌ No backend configuration found. Make sure you are using i18next-http-backend.');
        console.groupEnd();
        return;
      }
      
      const loadPath = i18n.options.backend.loadPath;
      console.log(`ℹ️ Resource load path: ${loadPath}`);
      
      // Try to construct some resource URLs
      const languages = ['en', 'es'];
      const namespace = i18n.options.defaultNS || 'translation';
      
      console.log('ℹ️ Example resource URLs that should be loaded:');
      languages.forEach(lang => {
        const url = loadPath
          .replace('{{lng}}', lang)
          .replace('{{ns}}', namespace);
        console.log(`🌐 ${lang}: ${url}`);
      });
      
      // Check if resources are already loaded
      const store = i18n.store ? i18n.store.data : {};
      console.log('ℹ️ Currently loaded resources:', Object.keys(store));
      
      console.log(`ℹ️ To verify resource loading, check the Network tab in DevTools for these URLs.`);
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error checking resource loading:', error);
      console.groupEnd();
    }
  }

  /**
   * Test translation updates in React components
   */
  function testReactIntegration() {
    console.group('⚛️ React Integration Test');
    
    try {
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        console.error('❌ React and/or ReactDOM not found. Cannot test React integration.');
        console.groupEnd();
        return;
      }
      
      if (typeof i18n === 'undefined') {
        console.error('❌ i18n is not defined.');
        console.groupEnd();
        return;
      }
      
      console.log('ℹ️ To test React integration:');
      console.log('1. Make sure your components are wrapped with the useTranslation hook or withTranslation HOC');
      console.log('2. Check if your app is wrapped with I18nextProvider or i18n.react.useSuspense is properly configured');
      console.log('3. Verify that components re-render when language changes');
      
      console.log(`ℹ️ Current i18n React configuration:`, {
        useSuspense: i18n.options.react ? i18n.options.react.useSuspense : 'Not configured',
        bindI18n: i18n.options.react ? i18n.options.react.bindI18n : 'Not configured',
        transEmptyNodeValue: i18n.options.react ? i18n.options.react.transEmptyNodeValue : 'Not configured'
      });
      
      console.groupEnd();
    } catch (error) {
      console.error('❌ Error testing React integration:', error);
      console.groupEnd();
    }
  }

  // Return public API
  return {
    checkI18nInitialization,
    changeLanguage,
    testAllTranslations,
    showAvailableLanguages,
    checkResourceLoading,
    testReactIntegration,
    
    // Configure which translation keys to test
    setTestKeys: function(keys) {
      if (Array.isArray(keys)) {
        _translationTestKeys = keys;
        console.log(`ℹ️ Updated translation test keys: ${_translationTestKeys.join(', ')}`);
      }
    }
  };
})();

// Automatically run basic checks when script is loaded
console.log('🔍 i18n Debug Script Loaded');
i18nDebug.checkI18nInitialization();

// Export to window for console access
window.i18nDebug = i18nDebug;

// Usage examples:
// i18nDebug.changeLanguage('es');
// i18nDebug.testAllTranslations();
// i18nDebug.showAvailableLanguages();
// i18nDebug.checkResourceLoading();
// i18nDebug.testReactIntegration();

