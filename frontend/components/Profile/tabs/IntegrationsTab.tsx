import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CpuChipIcon,
    KeyIcon,
    ServerIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    EyeIcon,
    EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../../config/paths';

export type AIProvider = 'openai' | 'ollama';

export interface AISettings {
    ai_provider: AIProvider;
    openai_api_key: string;
    ollama_base_url: string;
    ollama_model: string;
}

interface IntegrationsTabProps {
    isActive: boolean;
    settings: AISettings;
    hasExistingKey: boolean;
    onChange: (settings: AISettings) => void;
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    isActive,
    settings,
    hasExistingKey,
    onChange,
}) => {
    const { t } = useTranslation();
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);

    const handleTestConnection = async () => {
        try {
            setTesting(true);
            setTestResult(null);
            const response = await fetch(
                getApiPath('profile/ai-settings/test'),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings),
                }
            );

            const data = await response.json();
            setTestResult({
                success: response.ok,
                message: data.message || data.error,
            });
        } catch {
            setTestResult({
                success: false,
                message: 'Connection test failed',
            });
        } finally {
            setTesting(false);
        }
    };

    if (!isActive) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <CpuChipIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t('profile.integrations.title', 'AI Integrations')}
            </h3>

            {/* Provider Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('profile.integrations.provider', 'AI Provider')}
                </label>
                <select
                    value={settings.ai_provider}
                    onChange={(e) =>
                        onChange({
                            ...settings,
                            ai_provider: e.target.value as AIProvider,
                        })
                    }
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    <option value="openai">OpenAI (Cloud)</option>
                    <option value="ollama">Ollama (Local)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {settings.ai_provider === 'openai'
                        ? t(
                              'profile.integrations.openaiDescription',
                              'Use OpenAI API for AI features. Requires an API key.'
                          )
                        : t(
                              'profile.integrations.ollamaDescription',
                              'Use a local Ollama instance. Free and private.'
                          )}
                </p>
            </div>

            {/* OpenAI Settings */}
            {settings.ai_provider === 'openai' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                        <KeyIcon className="w-5 h-5 mr-2 text-green-500" />
                        {t('profile.integrations.openaiSettings', 'OpenAI Settings')}
                    </h4>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('profile.integrations.apiKey', 'API Key')}
                            {hasExistingKey && (
                                <span className="ml-2 text-green-600 dark:text-green-400 text-xs">
                                    (configured)
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={settings.openai_api_key}
                                onChange={(e) =>
                                    onChange({
                                        ...settings,
                                        openai_api_key: e.target.value,
                                    })
                                }
                                placeholder={
                                    hasExistingKey
                                        ? '••••••••••••••••'
                                        : 'sk-...'
                                }
                                className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                {showApiKey ? (
                                    <EyeSlashIcon className="w-5 h-5" />
                                ) : (
                                    <EyeIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'profile.integrations.apiKeyHelp',
                                'Get your API key from platform.openai.com. Leave empty to keep existing key.'
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* Ollama Settings */}
            {settings.ai_provider === 'ollama' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                        <ServerIcon className="w-5 h-5 mr-2 text-purple-500" />
                        {t('profile.integrations.ollamaSettings', 'Ollama Settings')}
                    </h4>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('profile.integrations.baseUrl', 'Base URL')}
                        </label>
                        <input
                            type="text"
                            value={settings.ollama_base_url}
                            onChange={(e) =>
                                onChange({
                                    ...settings,
                                    ollama_base_url: e.target.value,
                                })
                            }
                            placeholder="http://localhost:11434"
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'profile.integrations.baseUrlHelp',
                                'URL where your Ollama server is running'
                            )}
                        </p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('profile.integrations.model', 'Model')}
                        </label>
                        <input
                            type="text"
                            value={settings.ollama_model}
                            onChange={(e) =>
                                onChange({
                                    ...settings,
                                    ollama_model: e.target.value,
                                })
                            }
                            placeholder="llama3"
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t(
                                'profile.integrations.modelHelp',
                                'Model name (e.g., llama3, mistral, codellama)'
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* Test Result */}
            {testResult && (
                <div
                    className={`p-4 rounded-lg mb-4 flex items-center ${
                        testResult.success
                            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}
                >
                    {testResult.success ? (
                        <CheckCircleIcon className="w-5 h-5 mr-2" />
                    ) : (
                        <ExclamationCircleIcon className="w-5 h-5 mr-2" />
                    )}
                    {testResult.message}
                </div>
            )}

            {/* Test Connection Button */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                    {testing
                        ? t('profile.integrations.testing', 'Testing...')
                        : t('profile.integrations.testConnection', 'Test Connection')}
                </button>
            </div>
        </div>
    );
};

export default IntegrationsTab;
