import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfileFormData, Features } from '../types';

interface FeaturesTabProps {
    isActive: boolean;
    eisenhowerEnabled: boolean;
    onToggleEisenhower: () => void;
    formData: ProfileFormData;
    onToggleAi: (field: keyof Features) => void;
}

interface ToggleRowProps {
    label: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    last?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
    label,
    description,
    value,
    onToggle,
    last,
}) => (
    <div
        className={`flex items-center justify-between py-4 ${
            last ? '' : 'border-b border-gray-200 dark:border-gray-700'
        }`}
    >
        <div className="pr-8">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description}
            </p>
        </div>
        <div
            className={`relative inline-block w-12 h-6 flex-shrink-0 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={onToggle}
        >
            <span
                className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                    value ? 'translate-x-6' : 'translate-x-0'
                }`}
            />
        </div>
    </div>
);

const FeaturesTab: React.FC<FeaturesTabProps> = ({
    isActive,
    eisenhowerEnabled,
    onToggleEisenhower,
    formData,
    onToggleAi,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {t('profile.featuresAddons', 'Features & Add-ons')}
            </h3>

            <div className="space-y-0">
                <ToggleRow
                    label={t('sidebar.eisenhower', 'Eisenhower Matrix')}
                    description={t(
                        'profile.eisenhowerDescription',
                        'Enable the Eisenhower Matrix page for prioritising tasks by urgency and importance.'
                    )}
                    value={eisenhowerEnabled}
                    onToggle={onToggleEisenhower}
                />
            </div>

            <div className="mt-8">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                    {t('profile.intelligenceSection', 'Intelligence')}
                </h4>
                <div className="space-y-0">
                    <ToggleRow
                        label={t(
                            'profile.taskIntelligenceLabel',
                            'Task Intelligence Assistant'
                        )}
                        description={t(
                            'profile.taskIntelligenceDescription',
                            'Show popup alerts while typing task names that suggest improvements like "Make it more descriptive!", "Be more specific!", or "Add an action verb!". Disable this if you prefer typing in your own shorthand without suggestions.'
                        )}
                        value={Boolean(formData.features?.task_intelligence_enabled)}
                        onToggle={() => onToggleAi('task_intelligence_enabled')}
                    />
                    <ToggleRow
                        label={t(
                            'profile.autoSuggestNextActionsLabel',
                            'Next Action Prompts'
                        )}
                        description={t(
                            'profile.autoSuggestNextActionsDescription',
                            'When creating a project, automatically prompt for the very next physical action to take.'
                        )}
                        value={Boolean(formData.features?.auto_suggest_next_actions_enabled)}
                        onToggle={() =>
                            onToggleAi('auto_suggest_next_actions_enabled')
                        }
                    />
                    <ToggleRow
                        label={t(
                            'profile.productivityAssistantLabel',
                            'Productivity Insights'
                        )}
                        description={t(
                            'profile.productivityAssistantDescription',
                            'Show productivity insights that help identify stalled projects, vague tasks, and workflow improvements on your Today page.'
                        )}
                        value={Boolean(formData.features?.productivity_assistant_enabled)}
                        onToggle={() =>
                            onToggleAi('productivity_assistant_enabled')
                        }
                    />
                    <ToggleRow
                        label={t(
                            'profile.nextTaskSuggestionLabel',
                            'Next Task Suggestions'
                        )}
                        description={t(
                            'profile.nextTaskSuggestionDescription',
                            'Automatically suggest the next best task to work on when you have nothing in progress, prioritizing due today tasks, then suggested tasks, then next actions.'
                        )}
                        value={Boolean(formData.features?.next_task_suggestion_enabled)}
                        onToggle={() =>
                            onToggleAi('next_task_suggestion_enabled')
                        }
                        last
                    />
                </div>
            </div>
        </div>
    );
};

export default FeaturesTab;
