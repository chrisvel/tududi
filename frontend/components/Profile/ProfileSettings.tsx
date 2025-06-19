import React, { useState, useEffect, ChangeEvent, FormEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';

interface ProfileSettingsProps {
  currentUser: { id: number; email: string };
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
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
  task_summary_enabled: boolean;
  task_summary_frequency: string;
}

interface SchedulerStatus {
  success: boolean;
  enabled: boolean;
  frequency: string;
  last_run: string | null;
  next_run: string | null;
}

interface TelegramBotInfo {
  username: string;
  polling_status: any;
  chat_url: string;
}

const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const formatFrequency = (frequency: string): string => {
  if (frequency.endsWith('h')) {
    const value = frequency.replace('h', '');
    return `${value} ${parseInt(value) === 1 ? 'hour' : 'hours'}`;
  } else if (frequency === 'daily') {
    return '1 day';
  } else if (frequency === 'weekly') {
    return '1 week';
  } else if (frequency === 'weekdays') {
    return 'Weekdays';
  }
  return frequency;
};

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ currentUser, isDarkMode, toggleDarkMode }) => {
  const { t, i18n } = useTranslation();
  const { showSuccessToast, showErrorToast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<Partial<Profile>>({
    appearance: isDarkMode ? 'dark' : 'light',
    language: 'en',
    timezone: 'UTC',
    avatar_image: '',
    telegram_bot_token: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updateKey, setUpdateKey] = useState(0);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [telegramSetupStatus, setTelegramSetupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramBotInfo, setTelegramBotInfo] = useState<TelegramBotInfo | null>(null);
  
  const forceUpdate = useCallback(() => {
    setUpdateKey(prevKey => prevKey + 1);
  }, []);
  
  const fetchSchedulerStatus = async () => {
    try {
      setLoadingStatus(true);
      const response = await fetch('/api/profile/task-summary/status');
      
      if (!response.ok) {
        throw new Error(t('profile.statusFetchError', 'Failed to fetch scheduler status.'));
      }
      
      const data = await response.json();
      setSchedulerStatus(data);
    } catch (error) {
      showErrorToast((error as Error).message);
    } finally {
      setLoadingStatus(false);
    }
  };
  
  const handleSendTaskSummaryNow = async () => {
    try {
      setIsSendingSummary(true);
      const response = await fetch('/api/profile/task-summary/send-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('profile.sendSummaryFailed', 'Failed to send summary.'));
      }
      
      const data = await response.json();
      showSuccessToast(data.message);
      
      if (data.enabled) {
        fetchSchedulerStatus();
      }
    } catch (error) {
      showErrorToast((error as Error).message);
    } finally {
      setIsSendingSummary(false);
    }
  };
  
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'appearance' && toggleDarkMode) {
      const shouldBeDark = value === 'dark';
      if (shouldBeDark !== isDarkMode) {
        toggleDarkMode();
      }
    }
    
    if (name === 'language' && value !== i18n.language) {
      handleLanguageChange(value);
    }
  };
  
  const handleLanguageChange = async (value: string) => {
    try {
      setIsChangingLanguage(true);
      
      await i18n.changeLanguage(value);
      
      document.documentElement.lang = value;
      
      const resources = i18n.getResourceBundle(value, 'translation');
      
      if (!resources || Object.keys(resources).length === 0) {        
        
        const loadPath = `/locales/${value}/translation.json`;
        try {
          const response = await fetch(loadPath);
          if (response.ok) {
            const data = await response.json();
            i18n.addResourceBundle(value, 'translation', data, true, true);
            
            if (window.forceLanguageReload) {
              window.forceLanguageReload(value);
            }
          }
        } catch (err) {}
      }
      
      setTimeout(() => {
        forceUpdate();
        
        const checkAndLoadResources = i18n.getResourceBundle(value, 'translation');
        if (!checkAndLoadResources || Object.keys(checkAndLoadResources).length === 0) {
          if (window.forceLanguageReload) {
            window.forceLanguageReload(value);
          }
        }
        
        setTimeout(() => {
          if (isChangingLanguage) {
            setIsChangingLanguage(false);
          }
        }, 800);
      }, 200);
    } catch (error) {
      setIsChangingLanguage(false);
    }
  };
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/profile');
        
        if (!response.ok) {
          throw new Error(t('profile.fetchError', 'Failed to fetch profile data.'));
        }
        
        const data = await response.json();
        setProfile(data);
        setFormData({
          appearance: isDarkMode ? 'dark' : 'light', // Use current app state instead of saved preference
          language: data.language || 'en',
          timezone: data.timezone || 'UTC',
          avatar_image: data.avatar_image || '',
          telegram_bot_token: data.telegram_bot_token || '',
        });
        setTelegramBotToken(data.telegram_bot_token || '');
        setTelegramChatId(data.telegram_chat_id || '');
        
        if (data.task_summary_enabled) {
          fetchSchedulerStatus();
        }
        
        if (data.telegram_bot_token) {
          fetchPollingStatus();
        }
      } catch (error) {
        showErrorToast((error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchPollingStatus = async () => {
      try {
        const response = await fetch('/api/telegram/polling-status');
        
        if (!response.ok) {
          throw new Error(t('profile.pollingStatusError', 'Failed to fetch polling status.'));
        }
        
        const data = await response.json();
        setIsPolling(data.running);
        
        if (data.token_exists && !data.running) {
          handleStartPolling();
        }
      } catch (error) {}
    };
    fetchProfile();
  }, []);

  useEffect(() => {
  }, [updateKey, i18n.language]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, appearance: isDarkMode ? 'dark' : 'light' }));
  }, [isDarkMode]);
  
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      forceUpdate();
    };
    
    const handleAppLanguageChanged = (event: CustomEvent<{ language: string }>) => {
      forceUpdate();
      setTimeout(() => {
        setIsChangingLanguage(false);
      }, 300);
    };

    i18n.on('languageChanged', handleLanguageChanged);
    window.addEventListener('app-language-changed', handleAppLanguageChanged as EventListener);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
      window.removeEventListener('app-language-changed', handleAppLanguageChanged as EventListener);
    };
  }, []);

  
  const handleSetupTelegram = async () => {
    setTelegramSetupStatus('loading');
    setTelegramError(null);
    setTelegramBotInfo(null);
    
    try {
      if (!formData.telegram_bot_token || !formData.telegram_bot_token.includes(':')) {
        throw new Error(t('profile.invalidTelegramToken'));
      }
      
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
      
      if (data.bot) {
        setTelegramBotInfo(data.bot);
        setIsPolling(true);
        
        if (!data.bot.polling_status?.running) {
          setTimeout(() => {
            handleStartPolling();
          }, 1000);
        }
      }
      
      const botUsername = data.bot?.username || formData.telegram_bot_token.split(':')[0];
      
      window.open(`https://t.me/${botUsername}`, '_blank');
      
    } catch (error) {
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
      
      if (telegramBotInfo) {
        setTelegramBotInfo({
          ...telegramBotInfo,
          polling_status: data.status
        });
      }
    } catch (error) {
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
      showSuccessToast(t('profile.pollingStopped', 'Polling stopped successfully.'));
      
      if (telegramBotInfo) {
        setTelegramBotInfo({
          ...telegramBotInfo,
          polling_status: data.status
        });
      }
    } catch (error) {
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
      
      if (updatedProfile.language !== i18n.language) {
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

      {success && <div className="mb-4 text-green-500">{success}</div>}
      {error && <div className="mb-4 text-red-500">{error}</div>}

      <form onSubmit={handleSubmit}>
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
              value={formData.telegram_bot_token || ''}
              onChange={handleChange}
              placeholder="123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ"
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('profile.telegramTokenDescription', 'Create a bot with @BotFather on Telegram and paste the token here.')}
            </p>
          
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            {t('profile.taskSummaryNotifications', 'Task Summary Notifications')}
          </h3>
          
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
            <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
            <p>
              {t('profile.taskSummaryDescription', 'Receive regular summaries of your tasks via Telegram. This feature requires your Telegram integration to be set up.')}
            </p>
          </div>
          
          <div className="mb-4 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('profile.enableTaskSummary', 'Enable Task Summaries')}
            </label>
            <div 
              className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                profile?.task_summary_enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              onClick={async () => {
                try {
                  const response = await fetch('/api/profile/task-summary/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || t('profile.toggleFailed'));
                  }
                  
                  const data = await response.json();
                  setProfile(prev => prev ? ({...prev, task_summary_enabled: data.enabled}) : null);
                  showSuccessToast(data.message);
                } catch (error) {
                  showErrorToast((error as Error).message);
                }
              }}
            >
              <span 
                className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                  profile?.task_summary_enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              ></span>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('profile.summaryFrequency', 'Summary Frequency')}
            </label>
            <div className="flex flex-wrap gap-2">
              {['1h', '2h', '4h', '8h', '12h', 'daily', 'weekly'].map((frequency) => (
                <button
                  key={frequency}
                  type="button"
                  className={`px-3 py-1.5 text-sm rounded-full ${
                    profile?.task_summary_frequency === frequency
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/profile/task-summary/frequency', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ frequency })
                      });
                      
                      if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || t('profile.frequencyUpdateFailed'));
                      }
                      
                      const data = await response.json();
                      
                      setProfile(prev => prev ? ({...prev, task_summary_frequency: frequency}) : null);
                      showSuccessToast(data.message);
                    } catch (error) {
                      showErrorToast((error as Error).message);
                    }
                  }}
                >
                  {t(`profile.frequency.${frequency}`, formatFrequency(frequency))}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('profile.frequencyHelp', 'Choose how often you want to receive task summaries.')}
            </p>
          </div>
          
          <div className="mt-4">
            <button
              type="button"
              disabled={!profile?.telegram_bot_token || !profile?.telegram_chat_id}
              className={`px-4 py-2 rounded-md ${
                !profile?.telegram_bot_token || !profile?.telegram_chat_id
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              }`}
              onClick={async () => {
                try {
                  const response = await fetch('/api/profile/task-summary/send-now', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || t('profile.sendSummaryFailed'));
                  }
                  
                  const data = await response.json();
                  showSuccessToast(data.message);
                } catch (error) {
                  showErrorToast((error as Error).message);
                }
              }}
            >
              {t('profile.sendTestSummary', 'Send Test Summary')}
            </button>
            {(!profile?.telegram_bot_token || !profile?.telegram_chat_id) && (
              <p className="mt-2 text-xs text-red-500">
                {t('profile.telegramRequiredForSummaries', 'Telegram integration must be set up to use task summaries.')}
              </p>
            )}
          </div>
        </div>

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
