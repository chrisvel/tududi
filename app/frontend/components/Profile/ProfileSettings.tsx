import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
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
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser }) => {
  const { t, i18n } = useTranslation();
  const { showSuccessToast, showErrorToast } = useToast();
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
    telegram_bot_token: '',
  });
  
  const [telegramSetupStatus, setTelegramSetupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramBotInfo, setTelegramBotInfo] = useState<{
    username: string;
    polling_status: any;
    chat_url: string;
  } | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

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
          telegram_bot_token: data.telegram_bot_token || '',
        });
        
        // If user has a token, check polling status
        if (data.telegram_bot_token) {
          fetchPollingStatus();
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);
  
  // Fetch polling status
  const fetchPollingStatus = async () => {
    try {
      const response = await fetch('/api/telegram/polling-status');
      const data = await response.json();
      
      if (data.success) {
        setIsPolling(data.is_polling);
        
        // If the user has a token and we've previously set up the bot
        if (profile?.telegram_bot_token && telegramBotInfo?.username) {
          // Update polling status in the bot info
          setTelegramBotInfo({
            ...telegramBotInfo,
            polling_status: data.status
          });
        }
      }
    } catch (error) {
      console.error('Error fetching polling status:', error);
    }
  };

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
  
  const handleSetupTelegram = async () => {
    setTelegramSetupStatus('loading');
    setTelegramError(null);
    setTelegramBotInfo(null);
    
    try {
      // Validate the token format
      if (!formData.telegram_bot_token || !formData.telegram_bot_token.includes(':')) {
        throw new Error(t('profile.invalidTelegramToken'));
      }
      
      // Send setup request to the server
      const response = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: formData.telegram_bot_token }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('profile.telegramSetupFailed'));
      }
      
      const data = await response.json();
      setTelegramSetupStatus('success');
      setSuccess(t('profile.telegramSetupSuccess'));
      
      // Save bot info for display
      if (data.bot) {
        setTelegramBotInfo(data.bot);
        setIsPolling(true);
      }
      
      // Format the URL to start the bot chat
      const botUsername = data.bot?.username || formData.telegram_bot_token.split(':')[0];
      
      // Open the Telegram bot chat in a new window
      window.open(`https://t.me/${botUsername}`, '_blank');
      
    } catch (error) {
      console.error('Telegram setup error:', error);
      setTelegramSetupStatus('error');
      setTelegramError((error as Error).message);
    }
  };
  
  const handleStartPolling = async () => {
    try {
      const response = await fetch('/api/telegram/start-polling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('profile.startPollingFailed'));
      }
      
      const data = await response.json();
      setIsPolling(true);
      showSuccessToast(t('profile.pollingStarted'));
      
      // Update bot info if available
      if (telegramBotInfo) {
        setTelegramBotInfo({
          ...telegramBotInfo,
          polling_status: data.status
        });
      }
    } catch (error) {
      console.error('Start polling error:', error);
      showErrorToast(t('profile.pollingError'));
    }
  };
  
  const handleStopPolling = async () => {
    try {
      const response = await fetch('/api/telegram/stop-polling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('profile.stopPollingFailed'));
      }
      
      const data = await response.json();
      setIsPolling(false);
      showSuccessToast(t('profile.pollingStopped'));
      
      // Update bot info if available
      if (telegramBotInfo) {
        setTelegramBotInfo({
          ...telegramBotInfo,
          polling_status: data.status
        });
      }
    } catch (error) {
      console.error('Stop polling error:', error);
      showErrorToast(t('profile.pollingError'));
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
        
        {/* Telegram Integration */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            {t('profile.telegramIntegration', 'Telegram Integration')}
          </h3>
          
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
            <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
            <p>
              {t('profile.telegramDescription', 'Connect your Tududi account to a Telegram bot to add items to your inbox via Telegram messages.')}
            </p>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('profile.telegramBotToken', 'Telegram Bot Token')}
            </label>
            <input
              type="text"
              name="telegram_bot_token"
              value={formData.telegram_bot_token}
              onChange={handleChange}
              placeholder="123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ"
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('profile.telegramTokenDescription', 'Create a bot with @BotFather on Telegram and paste the token here.')}
            </p>
          </div>
          
          {profile?.telegram_chat_id && (
            <div className="mb-4 p-2 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200">
              <p className="text-sm">
                {t('profile.telegramConnected', 'Your Telegram account is connected! Send messages to your bot to add items to your Tududi inbox.')}
              </p>
            </div>
          )}
          
          {telegramError && (
            <div className="mb-4 p-2 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
              <p className="text-sm">{telegramError}</p>
            </div>
          )}
          
          {telegramBotInfo && (
            <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-2">
                {t('profile.botConfigured', 'Bot configured successfully!')}
              </p>
              
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-semibold">{t('profile.botUsername', 'Bot Username:')} </span> 
                  @{telegramBotInfo.username}
                </p>
                
                <div>
                  <p className="font-semibold mb-1">{t('profile.pollingStatus', 'Polling Status:')} </p>
                  
                  <div className="flex items-center mb-2">
                    <div className={`w-3 h-3 rounded-full mr-2 ${isPolling ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>{isPolling ? t('profile.pollingActive') : t('profile.pollingInactive')}</span>
                  </div>
                  
                  <p className="text-xs mb-2">
                    {t('profile.pollingNote', 'Polling periodically checks for new messages from Telegram and adds them to your inbox.')}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center mt-2">
                    {isPolling ? (
                      <button
                        onClick={handleStopPolling}
                        className="px-3 py-1 bg-red-600 text-white dark:bg-red-700 rounded text-sm hover:bg-red-700 dark:hover:bg-red-800 text-center mb-2 sm:mb-0 sm:mr-3"
                      >
                        {t('profile.stopPolling', 'Stop Polling')}
                      </button>
                    ) : (
                      <button
                        onClick={handleStartPolling}
                        className="px-3 py-1 bg-blue-600 text-white dark:bg-blue-700 rounded text-sm hover:bg-blue-700 dark:hover:bg-blue-800 text-center mb-2 sm:mb-0 sm:mr-3"
                      >
                        {t('profile.startPolling', 'Start Polling')}
                      </button>
                    )}
                    <a 
                      href={telegramBotInfo.chat_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-green-600 text-white dark:bg-green-700 rounded text-sm hover:bg-green-700 dark:hover:bg-green-800 text-center mb-2 sm:mb-0 sm:mr-3"
                    >
                      {t('profile.openTelegram', 'Open in Telegram')}
                    </a>
                    
                    {/* Test button for development */}
                    <button
                      onClick={async () => {
                        try {
                          const testMessage = prompt('Enter a test message:');
                          if (testMessage) {
                            const response = await fetch(`/api/telegram/test/${profile?.id}`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ text: testMessage })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                              showSuccessToast(t('profile.testMessageSent', 'Test message sent successfully!'));
                            } else {
                              showErrorToast(t('profile.testMessageFailed', 'Failed to send test message.'));
                            }
                          }
                        } catch (error) {
                          console.error('Test message error:', error);
                          showErrorToast(t('profile.testMessageError', 'Error sending test message.'));
                        }
                      }}
                      className="px-3 py-1 bg-purple-600 text-white dark:bg-purple-700 rounded text-sm hover:bg-purple-700 dark:hover:bg-purple-800 text-center"
                    >
                      {t('profile.testTelegramMessage', 'Test Telegram')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <button
            type="button"
            onClick={handleSetupTelegram}
            disabled={!formData.telegram_bot_token || telegramSetupStatus === 'loading'}
            className={`px-4 py-2 rounded-md ${
              !formData.telegram_bot_token || telegramSetupStatus === 'loading'
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            }`}
          >
            {telegramSetupStatus === 'loading'
              ? t('profile.settingUp', 'Setting up...')
              : t('profile.setupTelegram', 'Setup Telegram')}
          </button>
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
