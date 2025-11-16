import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChartBarIcon,
    LightBulbIcon,
    SparklesIcon,
    ClockIcon,
    TrophyIcon,
    ChatBubbleBottomCenterTextIcon,
    ListBulletIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../config/paths';

interface TodaySettingsDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    settings: {
        showMetrics: boolean;
        showProductivity: boolean;
        showNextTaskSuggestion: boolean;
        showSuggestions: boolean;
        showDueToday: boolean;
        showCompleted: boolean;
        showProgressBar: boolean;
        showDailyQuote: boolean;
    };
    profileSettings?: {
        productivity_assistant_enabled?: boolean;
        next_task_suggestion_enabled?: boolean;
    };
    onSettingsChange: (settings: any) => void;
}

const TodaySettingsDropdown: React.FC<TodaySettingsDropdownProps> = ({
    isOpen,
    onClose,
    settings,
    profileSettings,
    onSettingsChange,
}) => {
    const { t } = useTranslation();
    const [localSettings, setLocalSettings] = useState(settings);
    const [isSaving, setIsSaving] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleToggle = (key: keyof typeof localSettings) => {
        const newSettings = {
            ...localSettings,
            [key]: !localSettings[key],
        };
        setLocalSettings(newSettings);

        // Auto-save on change
        saveSettings(newSettings);
    };

    const saveSettings = async (settingsToSave: typeof localSettings) => {
        setIsSaving(true);
        try {
            const response = await fetch(getApiPath('profile/today-settings'), {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settingsToSave),
            });

            if (response.ok) {
                onSettingsChange(settingsToSave);
            } else {
                console.error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const settingsOptions: Array<{
        key: keyof typeof localSettings;
        label: string;
        icon: React.ElementType;
        disabled?: boolean;
    }> = [
        {
            key: 'showDailyQuote',
            label: t('settings.showDailyQuote', 'Show Daily Quote'),
            icon: ChatBubbleBottomCenterTextIcon,
        },
        {
            key: 'showMetrics',
            label: t('settings.showMetrics', 'Show Metrics'),
            icon: ChartBarIcon,
        },
        // Only show productivity option if enabled in profile
        ...(profileSettings?.productivity_assistant_enabled === true
            ? [
                  {
                      key: 'showProductivity' as keyof typeof localSettings,
                      label: t(
                          'settings.showProductivity',
                          'Show Productivity Insights'
                      ),
                      icon: LightBulbIcon,
                  },
              ]
            : []),
        // Only show next task suggestion option if enabled in profile
        ...(profileSettings?.next_task_suggestion_enabled === true
            ? [
                  {
                      key: 'showNextTaskSuggestion' as keyof typeof localSettings,
                      label: t(
                          'settings.showNextTaskSuggestion',
                          'Next Task Suggestion'
                      ),
                      icon: SparklesIcon,
                  },
              ]
            : []),
        {
            key: 'showSuggestions',
            label: t('settings.showSuggestions', 'Show Suggested'),
            icon: ListBulletIcon,
        },
        {
            key: 'showDueToday',
            label: t('settings.showDueToday', 'Show Due Today Tasks'),
            icon: ClockIcon,
        },
        {
            key: 'showCompleted',
            label: t('settings.showCompleted', 'Show Completed Tasks'),
            icon: TrophyIcon,
        },
    ];

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
        >
            <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    {t('settings.todayPageSettings', 'Today Page Settings')}
                </h3>

                <div className="space-y-3">
                    {settingsOptions.map((option) => {
                        const IconComponent = option.icon;
                        const isDisabled = option.disabled || isSaving;

                        return (
                            <div
                                key={option.key}
                                className={`flex items-center justify-between ${isDisabled ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-center flex-1">
                                    <IconComponent className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-3" />
                                    <label
                                        className={`text-sm text-gray-700 dark:text-gray-300 ${!isDisabled ? 'cursor-pointer' : 'cursor-not-allowed'} flex-1`}
                                    >
                                        {option.label}
                                    </label>
                                </div>
                                <button
                                    onClick={() =>
                                        !isDisabled && handleToggle(option.key)
                                    }
                                    disabled={isDisabled}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                        localSettings[option.key]
                                            ? 'bg-blue-600'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                            localSettings[option.key]
                                                ? 'translate-x-5'
                                                : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {isSaving && (
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        {t('common.saving', 'Saving...')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TodaySettingsDropdown;
