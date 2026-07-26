import React, { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircleIcon,
    ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../../config/paths';
import type { ProfileFormData, Features } from '../types';

interface AIAssistantTabProps {
    isActive: boolean;
    formData: ProfileFormData;
    onToggleAi: (field: keyof Features) => void;
    onAiProfileChange: (value: string) => void;
}

interface LLMConfig {
    api_key_set: boolean;
    base_url: string | null;
    model: string;
}

const AIAssistantTab: React.FC<AIAssistantTabProps> = ({
    isActive,
    formData,
    onToggleAi,
    onAiProfileChange,
}) => {
    const { t } = useTranslation();
    const [config, setConfig] = useState<LLMConfig | null>(null);

    useEffect(() => {
        if (!isActive) return;
        fetch(getApiPath('ai-assistant/config'), { credentials: 'include' })
            .then((r) => r.json())
            .then(setConfig)
            .catch(() => setConfig(null));
    }, [isActive]);

    if (!isActive) return null;

    const aiEnabled = Boolean(formData.features?.ai_assistant_enabled);

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                {t('profile.aiAssistantTab', 'AI Assistant')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t(
                    'profile.aiAssistantTabDescription',
                    'Daily briefs, task insights, and project insights powered by any OpenAI-compatible model.'
                )}
            </p>

            {/* Server configuration */}
            <div className="mb-8">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                    {t('profile.aiServerConfig', 'Server Configuration')}
                </h4>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                    {/* API Key */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('profile.aiApiKey', 'API Key')}
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                LLM_API_KEY
                            </span>
                        </span>
                        {config === null ? (
                            <span className="text-xs text-gray-400">-</span>
                        ) : config.api_key_set ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                                <CheckCircleIcon className="w-4 h-4" />
                                {t('profile.aiKeySet', 'Set')}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400">
                                <ExclamationCircleIcon className="w-4 h-4" />
                                {t('profile.aiKeyNotSet', 'Not set')}
                            </span>
                        )}
                    </div>

                    {/* Base URL */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('profile.aiBaseUrl', 'Base URL')}
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                LLM_BASE_URL
                            </span>
                        </span>
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300 text-right max-w-xs truncate">
                            {config === null
                                ? '-'
                                : config.base_url ?? (
                                      <span className="text-gray-400 dark:text-gray-500 font-sans not-italic">
                                          {t(
                                              'profile.aiBaseUrlDefault',
                                              'OpenAI (default)'
                                          )}
                                      </span>
                                  )}
                        </span>
                    </div>

                    {/* Model */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('profile.aiModel', 'Model')}
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                LLM_MODEL
                            </span>
                        </span>
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                            {config === null ? '-' : config.model}
                        </span>
                    </div>
                </div>
                {config && !config.api_key_set && (
                    <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                        {t(
                            'profile.aiKeyMissingHint',
                            'Set LLM_API_KEY (or OPENAI_API_KEY) on the server to enable AI features.'
                        )}
                    </p>
                )}
            </div>

            {/* Enable toggle */}
            <div className="mb-8">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                    {t('profile.aiEnableSection', 'Enable')}
                </h4>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between px-4 py-4">
                        <div className="pr-8">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t(
                                    'profile.aiAssistantLabel',
                                    'AI Assistant (Insights)'
                                )}
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {t(
                                    'profile.aiAssistantDescription',
                                    'Enable AI-powered daily briefs, task insights, and project insights. Requires LLM_API_KEY (or OPENAI_API_KEY) on the server.'
                                )}
                            </p>
                        </div>
                        <div
                            className={`relative inline-block w-12 h-6 flex-shrink-0 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                                aiEnabled
                                    ? 'bg-blue-500'
                                    : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            onClick={() => onToggleAi('ai_assistant_enabled')}
                        >
                            <span
                                className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                    aiEnabled
                                        ? 'translate-x-6'
                                        : 'translate-x-0'
                                }`}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* About You */}
            <div>
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    {t('profile.aiProfileLabel', 'About You')}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {t(
                        'profile.aiProfileDescription',
                        'Optional context fed into the AI prompts: your role, field, or anything that helps personalise the briefs and insights (e.g. "Academic researcher focused on grant deadlines and grading cycles").'
                    )}
                </p>
                <textarea
                    name="ai_profile"
                    rows={10}
                    maxLength={500}
                    value={formData.ai_profile || ''}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                        onAiProfileChange(e.target.value)
                    }
                    placeholder={t(
                        'profile.aiProfilePlaceholder',
                        'e.g. Academic researcher. My work revolves around grant deadlines, paper reviews, and teaching cycles, not sprints or deploys.'
                    )}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 text-right">
                    {(formData.ai_profile || '').length} / 500
                </p>
            </div>
        </div>
    );
};

export default AIAssistantTab;
