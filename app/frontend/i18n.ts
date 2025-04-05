import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const isDevelopment = process.env.NODE_ENV === 'development';

// Define required translations for the app to function even if translations fail to load
const fallbackResources = {
  en: {
    translation: {
      common: {
        loading: 'Loading...',
        appLoading: 'Loading application... Please wait.',
        error: 'Error',
      },
      auth: {
        login: 'Login',
        register: 'Register',
      },
      errors: {
        somethingWentWrong: 'Something went wrong, please try again',
      },
    },
  },
};

// Explicitly add resources for development
const devResources = isDevelopment ? {
  en: {
    translation: fallbackResources.en.translation,
  },
} : undefined;

console.log("Initializing i18n...");
console.log("Environment:", process.env.NODE_ENV);

// Create i18n instance
const i18nInstance = i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next);

// Initialize i18n
i18nInstance.init({
  fallbackLng: 'en',
  debug: isDevelopment,
  
  // Map language codes with region (e.g., 'en-US') to base language codes (e.g., 'en')
  load: 'languageOnly',
  
  // Language mapping to handle specific cases
  supportedLngs: ['en', 'es', 'el', 'jp', 'ua', 'de'],
  nonExplicitSupportedLngs: true,
  
  // Add fallback resources to prevent rendering issues
  resources: devResources,
  
  // Language detection options
  detection: {
    order: ['querystring', 'cookie', 'localStorage', 'navigator'],
    lookupQuerystring: 'lng',
    lookupCookie: 'i18next',
    lookupLocalStorage: 'i18nextLng',
    caches: ['localStorage', 'cookie']
  },
  
  interpolation: {
    escapeValue: false, // not needed for react as it escapes by default
  },
  
  // Default namespace configuration
  defaultNS: 'translation',
  ns: ['translation'],
  
  // Backend configuration for loading translations
  backend: {
    // Path to load translations from - ensure it's properly pointing to the public directory
    loadPath: isDevelopment ? './locales/{{lng}}/{{ns}}.json' : '/locales/{{lng}}/{{ns}}.json',
    // Add cache busting
    queryStringParams: { v: Date.now().toString() },
    requestOptions: {
      cache: 'no-cache',
      credentials: 'same-origin',
      mode: 'cors',
      headers: {
        'Cache-Control': 'no-cache'
      }
    }
  },
})
.then(() => {
  console.log('i18n initialized successfully');
  console.log('Loaded languages:', i18n.languages);
  console.log('Current language:', i18n.language);
  console.log('Available namespaces:', i18n.options.ns);
  console.log('Has translation bundle:', i18n.hasResourceBundle(i18n.language, 'translation'));
  
  // Try to load translations directly with both possible paths
  const loadPath = isDevelopment ? `./locales/${i18n.language}/translation.json` : `/locales/${i18n.language}/translation.json`;
  console.log(`Attempting to fetch translations from: ${loadPath}`);
  
  fetch(loadPath)
    .then(response => {
      console.log(`Manual fetch response: ${response.status} from ${loadPath}`);
      if (!response.ok) {
        // If first attempt fails and we're in development, try the alternative path
        if (isDevelopment) {
          console.log('First fetch attempt failed, trying alternative path');
          return fetch(`/locales/${i18n.language}/translation.json`);
        }
        throw new Error(`Failed to fetch translation: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Translation data fetched manually:', Object.keys(data));
      i18n.addResourceBundle(i18n.language, 'translation', data, true, true);
      console.log('Added resource bundle manually');
    })
    .catch(err => {
      console.error('Error manually fetching translations:', err);
      
      // As a fallback, try to add translations from the public directory directly using require
      if (isDevelopment) {
        try {
          console.log('Attempting to load translations using a different approach...');
          setTimeout(() => {
            fetch(`/locales/${i18n.language}/translation.json`, {
              headers: { 'Accept': 'application/json' },
              mode: 'cors'
            })
              .then(res => res.json())
              .then(data => {
                i18n.addResourceBundle(i18n.language, 'translation', data, true, true);
                console.log('Added resource bundle via alternative approach');
              })
              .catch(e => console.error('Alternative loading approach failed:', e));
          }, 1000);
        } catch (e) {
          console.error('All attempts to load translations failed:', e);
        }
      }
    });
})
.catch(error => {
  console.error('i18n initialization error:', error);
});

// Register event listeners for debugging translation loading
i18n.on('initialized', (initialized) => {
  console.log('i18n initialized event:', initialized);
  console.log('Current language:', i18n.language);
  console.log('Available languages:', i18n.languages);
  console.log('Is initialized:', i18n.isInitialized);
});

i18n.on('loaded', (loaded) => {
  console.log('Translations loaded event:', loaded);
});

i18n.on('failedLoading', (lng, ns, msg) => {
  console.error(`Failed loading translation for ${lng}/${ns}: ${msg}`);
});

i18n.on('missingKey', (lngs, namespace, key, res) => {
  console.warn(`Missing translation key: ${key} in namespace: ${namespace} for languages: ${lngs.join(', ')}`);
});

i18n.on('languageChanged', (lng) => {
  console.log(`Language changed to: ${lng}`);
});

// Add a function to manually check translation availability
// Add type declaration for the global function
declare global {
  interface Window {
    checkTranslation: (key: string) => void;
  }
}

// Expose a function to manually check translations (helpful for debugging)
window.checkTranslation = (key: string) => {
  try {
    const translation = i18n.t(key);
    console.log(`Translation for '${key}': ${translation}`);
    console.log(`Is key '${key}' available: ${translation !== key}`);
    return translation;
  } catch (error) {
    console.error(`Error checking translation for key '${key}':`, error);
    return null;
  }
};

export default i18n;
