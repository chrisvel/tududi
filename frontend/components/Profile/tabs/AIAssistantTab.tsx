import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
    fetchAiProviderSettings,
    AiProviderSettings,
} from '../../../utils/aiAssistantService';
import { fetchBillingStatus } from '../../../utils/billingService';
import UsageBar from '../../Shared/UsageBar';
import type { ProfileFormData, Features } from '../types';

type AiProviderField = 'ai_api_key' | 'ai_base_url' | 'ai_model';

interface AIAssistantTabProps {
    isActive: boolean;
    formData: ProfileFormData;
    onToggleAi: (field: keyof Features) => void;
    onAiProfileChange: (value: string) => void;
    onAiProviderFieldChange: (field: AiProviderField, value: string) => void;
    onClearAiApiKey: () => void;
    onLoadAiProviderSettings: (settings: AiProviderSettings) => void;
    hosted?: boolean;
}

const AIAssistantTab: React.FC<AIAssistantTabProps> = ({
    isActive,
    formData,
    onToggleAi,
    onAiProfileChange,
    onAiProviderFieldChange,
    onClearAiApiKey,
    onLoadAiProviderSettings,
    hosted,
}) => {
    const { t } = useTranslation();
    const [loaded, setLoaded] = useState(false);
    const hasFetched = useRef(false);
    const [credits, setCredits] = useState<{
        used: number;
        limit: number | null;
    } | null>(null);

    useEffect(() => {
        if (!isActive || hasFetched.current) return;
        hasFetched.current = true;

        // Hosted subscribers don't pick their own provider - they get a
        // monthly AI Credits balance instead (see the hosted branch below).
        // Fetching/populating provider-settings formData in hosted mode
        // would also make ProfileSettings' generic Save PUT them, which the
        // server now rejects for hosted accounts.
        if (hosted) {
            fetchBillingStatus()
                .then((status) => {
                    setCredits({
                        used: status.usage?.ai_credits_used_this_month ?? 0,
                        limit: status.limits.ai_credits_per_month,
                    });
                })
                .catch(() => setCredits(null))
                .finally(() => setLoaded(true));
            return;
        }

        fetchAiProviderSettings()
            .then((settings) => {
                if (settings) onLoadAiProviderSettings(settings);
            })
            .finally(() => setLoaded(true));
    }, [isActive, hosted, onLoadAiProviderSettings]);

    if (!isActive) return null;

    const aiEnabled = Boolean(formData.features?.ai_assistant_enabled);
    const apiKeySet = Boolean(formData.ai_api_key_set);
    const apiKeyLast4 = formData.ai_api_key_last4;

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

            {hosted ? (
                /* Hosted subscribers share the operator's own provider and
                   get a monthly AI Credits allowance bundled with their
                   plan instead of picking a service/model themselves. */
                <div className="mb-8">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {t('profile.aiCreditsSection', 'AI Credits')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {t(
                            'profile.aiCreditsDescription',
                            'One credit is used for each daily brief, task insight, or project insight you generate. Your balance resets on the 1st of each month.'
                        )}
                    </p>
                    {credits ? (
                        <UsageBar
                            label={t(
                                'profile.aiCreditsLabel',
                                'Credits this month'
                            )}
                            used={credits.used}
                            limit={credits.limit}
                        />
                    ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {loaded ? '—' : '…'}
                        </p>
                    )}
                </div>
            ) : (
                /* AI Provider: per-user API key/base URL/model, stored (and
                   encrypted) in the database. Falls back to the server's own
                   LLM_API_KEY/.env when left blank, so nothing changes for a
                   self-hoster who never sets these. */
                <div className="mb-8">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {t('profile.aiProviderSection', 'AI Provider')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {t(
                            'profile.aiProviderDescription',
                            'Bring your own API key for any OpenAI-compatible provider. Leave blank to use the server default, if one is configured.'
                        )}
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('profile.aiApiKey', 'API Key')}
                            </label>
                            {apiKeySet && formData.ai_api_key === undefined ? (
                                <div className="flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                                    <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
                                        ••••••••
                                        {apiKeyLast4 || ''}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={onClearAiApiKey}
                                        className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                        {t('profile.aiApiKeyClear', 'Clear')}
                                    </button>
                                </div>
                            ) : (
                                <input
                                    type="password"
                                    name="ai_api_key"
                                    autoComplete="off"
                                    value={formData.ai_api_key || ''}
                                    onChange={(
                                        e: ChangeEvent<HTMLInputElement>
                                    ) =>
                                        onAiProviderFieldChange(
                                            'ai_api_key',
                                            e.target.value
                                        )
                                    }
                                    placeholder={
                                        loaded
                                            ? t(
                                                  'profile.aiApiKeyPlaceholder',
                                                  'sk-...'
                                              )
                                            : '…'
                                    }
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('profile.aiBaseUrl', 'Base URL')}
                            </label>
                            <input
                                type="text"
                                name="ai_base_url"
                                value={formData.ai_base_url || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    onAiProviderFieldChange(
                                        'ai_base_url',
                                        e.target.value
                                    )
                                }
                                placeholder={t(
                                    'profile.aiBaseUrlPlaceholder',
                                    'https://api.openai.com/v1 (default)'
                                )}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-mono text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('profile.aiModel', 'Model')}
                            </label>
                            <input
                                type="text"
                                name="ai_model"
                                value={formData.ai_model || ''}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    onAiProviderFieldChange(
                                        'ai_model',
                                        e.target.value
                                    )
                                }
                                placeholder={t(
                                    'profile.aiModelPlaceholder',
                                    'gpt-4o-mini (default)'
                                )}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-mono text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    {loaded && !apiKeySet && !formData.ai_api_key && (
                        <p className="mt-2 text-xs text-amber-500 dark:text-amber-400">
                            {t(
                                'profile.aiKeyMissingHint',
                                'Set an API key above to enable AI features.'
                            )}
                        </p>
                    )}
                </div>
            )}

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
                                    'Enable AI-powered daily briefs, task insights, and project insights.'
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
