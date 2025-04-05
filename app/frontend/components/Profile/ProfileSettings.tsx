import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
interface ProfileSettingsProps {
  currentUser: { id: number; email: string };
}

interface Profile {
  id: number;
  email: string;
  appearance: 'light' | 'dark';
  language: string;
  timezone: string;
  avatar_image: string | null;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser }) => {
  const { t, i18n } = useTranslation();
  // Add this to check the initial language
  console.log('Current language on component mount:', i18n.language);
  console.log('Available languages:', i18n.languages);
  console.log('Available namespaces:', i18n.options.ns);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Use React's forceUpdate pattern with a function to guarantee a fresh render
  const [updateKey, setUpdateKey] = useState(0);
  const forceUpdate = useCallback(() => {
    setUpdateKey(prev => prev + 1);
  }, []);
  
  // Add a state for tracking if language is actively changing
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [formData, setFormData] = useState({
    appearance: 'light',
    language: 'en',
    timezone: 'UTC',
    avatar_image: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile', {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch profile.');
        }
        const data: Profile = await response.json();
        setProfile(data);
        setFormData({
          appearance: data.appearance,
          language: data.language,
          timezone: data.timezone,
          avatar_image: data.avatar_image || '',
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // Add an effect to monitor language changes
  // Add effect with the updateKey dependency to refresh component on language change
  useEffect(() => {
    console.log(`Component refreshed with key: ${updateKey}, language: ${i18n.language}`);
  }, [updateKey, i18n.language]);
  
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      console.log(`Language changed to ${lng}`);
      // Force component to re-render when language changes
      forceUpdate();
    };
    
    // Handler for the custom app-language-changed event
    const handleAppLanguageChanged = (event: CustomEvent<{ language: string }>) => {
      console.log('Custom language change event received:', event.detail.language);
      // Force an update to re-render with new translations
      forceUpdate();
      // Mark language change as complete after a short delay
      // This ensures the UI has time to update with new translations
      setTimeout(() => {
        setIsChangingLanguage(false);
      }, 300);
    };

    // Add language change listeners
    i18n.on('languageChanged', handleLanguageChanged);
    window.addEventListener('app-language-changed', handleAppLanguageChanged as EventListener);

    // Clean up listeners on unmount
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
      window.removeEventListener('app-language-changed', handleAppLanguageChanged as EventListener);
    };
  }, []);

  const handleChange = async (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Change language immediately when selected
    if (name === 'language' && value !== i18n.language) {
      console.log('Changing language to:', value);
      // Set flag to indicate language is changing
      setIsChangingLanguage(true);
      
      try {
        // Save language preference to localStorage for persistence
        localStorage.setItem('i18nextLng', value);
        
        // First, force a re-render to indicate language is changing
        forceUpdate();
        
        // Trigger language change in i18next with a more robust approach
        await i18n.changeLanguage(value);
        console.log('Language changed successfully to:', i18n.language);
        
        // Explicitly force the document's lang attribute to match
        document.documentElement.lang = value;
        
        // Verify translations are loaded
        const resources = i18n.getResourceBundle(value, 'translation');
        console.log('Resources loaded for language:', value, resources ? 'Yes' : 'No');
        
        if (!resources || Object.keys(resources).length === 0) {
          console.warn('Translations might not be fully loaded for:', value);
          
          // Try to load translations manually if needed
          const loadPath = `/locales/${value}/translation.json`;
          try {
            const response = await fetch(loadPath);
            if (response.ok) {
              const data = await response.json();
              i18n.addResourceBundle(value, 'translation', data, true, true);
              console.log('Manually loaded translations for:', value);
              
              // Force app to recognize new translations
              if (window.forceLanguageReload) {
                window.forceLanguageReload(value);
              }
            }
          } catch (err) {
            console.error('Failed to manually load translations:', err);
          }
        }
        
        // Force another update to ensure UI reflects new language
        setTimeout(() => {
          forceUpdate();
          
          // Try to load translations again if they still aren't available
          const checkAndLoadResources = i18n.getResourceBundle(value, 'translation');
          if (!checkAndLoadResources || Object.keys(checkAndLoadResources).length === 0) {
            console.warn('Still no translations after initial load, forcing reload');
            if (window.forceLanguageReload) {
              window.forceLanguageReload(value);
            }
          }
          
          // If change event wasn't fired, mark as complete after a delay
          setTimeout(() => {
            if (isChangingLanguage) {
              setIsChangingLanguage(false);
            }
          }, 800); // Longer timeout to ensure translations load
        }, 200);
      } catch (error) {
        console.error('Error changing language:', error);
        setIsChangingLanguage(false);
      }
    }
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, avatar_image: reader.result as string }));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile.');
      }

      const updatedProfile: Profile = await response.json();
      setProfile(updatedProfile);
      
      // Make sure to update language if it was changed
      if (updatedProfile.language !== i18n.language) {
        console.log('Updating language after form submission:', updatedProfile.language);
        await i18n.changeLanguage(updatedProfile.language);
      }
      
      setSuccess(t('profile.successMessage'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6" key={`profile-settings-${updateKey}`}>
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        {t('profile.title')}
      </h2>
      
      {/* Debug information */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-800 text-xs font-mono">
          <p>Current language: {i18n.language}</p>
          <p>Initialized: {i18n.isInitialized ? 'Yes' : 'No'}</p>
          <p>Available languages: {i18n.languages?.join(', ')}</p>
        </div>
      )}

      {success && <div className="mb-4 text-green-500">{success}</div>}
      {error && <div className="mb-4 text-red-500">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Appearance Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('profile.appearance')}
          </label>
          <select
            name="appearance"
            value={formData.appearance}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="light">{t('profile.lightMode', 'Light')}</option>
            <option value="dark">{t('profile.darkMode', 'Dark')}</option>
          </select>
        </div>

        {/* Language Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('profile.language')}
          </label>
          <select
            name="language"
            value={formData.language}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="en">{t('profile.english')}</option>
            <option value="es">{t('profile.spanish')}</option>
            <option value="el">{t('profile.greek')}</option>
            <option value="jp">{t('profile.japanese')}</option>
            <option value="ua">{t('profile.ukrainian')}</option>
            <option value="de">{t('profile.deutsch')}</option>
            {/* Add more languages if necessary */}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('profile.languageChangedNote', 'Language changes are applied immediately')}
          </p>
          {isChangingLanguage && (
            <div className="mt-2 text-sm text-blue-500 animate-pulse">
              {t('profile.languageChanging', 'Changing language...')}
            </div>
          )}
        </div>

        {/* Timezone Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('profile.timezone')}
          </label>
          <select
            name="timezone"
            value={formData.timezone}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
          </select>
        </div>

        {/* Avatar Image Upload */}
        {/* <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Avatar Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-200 dark:hover:file:bg-gray-600"
          />
          {formData.avatar_image && (
            <img
              src={formData.avatar_image}
              alt="Avatar Preview"
              className="mt-2 h-24 w-24 rounded-full object-cover"
            />
          )}
        </div> */}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {t('profile.saveChanges')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettings;
