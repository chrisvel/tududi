import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    BoltIcon,
    ChevronRightIcon,
    ExclamationTriangleIcon,
    FaceSmileIcon,
    InformationCircleIcon,
    LightBulbIcon,
} from '@heroicons/react/24/outline';
import type { ProfileFormData } from '../types';

interface AiTabProps {
    isActive: boolean;
    formData: ProfileFormData;
    onToggle: (
        field: keyof Pick<
            ProfileFormData,
            | 'task_intelligence_enabled'
            | 'auto_suggest_next_actions_enabled'
            | 'productivity_assistant_enabled'
            | 'next_task_suggestion_enabled'
        >
    ) => void;
}

interface ToggleRowProps {
    label: string;
    icon: React.ReactNode;
    value: boolean;
    onToggle: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
    label,
    icon,
    value,
    onToggle,
}) => (
    <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
            <span className="mr-2">{icon}</span>
            {label}
        </label>
        <div
            className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={onToggle}
        >
            <span
                className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                    value ? 'translate-x-6' : 'translate-x-0'
                }`}
            ></span>
        </div>
    </div>
);

const AiTab: React.FC<AiTabProps> = ({ isActive, formData, onToggle }) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <LightBulbIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t(
                    'profile.aiProductivityFeatures',
                    'AI & Productivity Features'
                )}
            </h3>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <BoltIcon className="w-5 h-5 mr-2 text-purple-500" />
                    {t('profile.taskIntelligence', 'Task Intelligence')}
                </h4>

                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                    <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                    <p>
                        {t(
                            'profile.taskIntelligenceDescription',
                            'Show popup alerts while typing task names that suggest improvements like "Make it more descriptive!", "Be more specific!", or "Add an action verb!". Disable this if you prefer typing in your own shorthand without suggestions.'
                        )}
                    </p>
                </div>

                <ToggleRow
                    icon={<BoltIcon className="w-5 h-5 text-purple-500" />}
                    label={t(
                        'profile.enableTaskIntelligence',
                        'Enable Task Intelligence Assistant'
                    )}
                    value={Boolean(formData.task_intelligence_enabled)}
                    onToggle={() => onToggle('task_intelligence_enabled')}
                />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mt-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <ChevronRightIcon className="w-5 h-5 mr-2 text-green-500" />
                    {t(
                        'profile.autoSuggestNextActions',
                        'Auto-Suggest Next Actions'
                    )}
                </h4>

                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                    <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                    <p>
                        {t(
                            'profile.autoSuggestNextActionsDescription',
                            'When creating a project, automatically prompt for the very next physical action to take.'
                        )}
                    </p>
                </div>

                <ToggleRow
                    icon={
                        <ChevronRightIcon className="w-5 h-5 text-green-500" />
                    }
                    label={t(
                        'profile.enableAutoSuggestNextActions',
                        'Enable Next Action Prompts'
                    )}
                    value={Boolean(formData.auto_suggest_next_actions_enabled)}
                    onToggle={() =>
                        onToggle('auto_suggest_next_actions_enabled')
                    }
                />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mt-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-yellow-500" />
                    {t(
                        'profile.productivityAssistant',
                        'Productivity Assistant'
                    )}
                </h4>

                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                    <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                    <p>
                        {t(
                            'profile.productivityAssistantDescription',
                            'Show productivity insights that help identify stalled projects, vague tasks, and workflow improvements on your Today page.'
                        )}
                    </p>
                </div>

                <ToggleRow
                    icon={
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
                    }
                    label={t(
                        'profile.enableProductivityAssistant',
                        'Enable Productivity Insights'
                    )}
                    value={Boolean(formData.productivity_assistant_enabled)}
                    onToggle={() => onToggle('productivity_assistant_enabled')}
                />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mt-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <FaceSmileIcon className="w-5 h-5 mr-2 text-green-500" />
                    {t('profile.nextTaskSuggestion', 'Next Task Suggestion')}
                </h4>

                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                    <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                    <p>
                        {t(
                            'profile.nextTaskSuggestionDescription',
                            'Automatically suggest the next best task to work on when you have nothing in progress, prioritizing due today tasks, then suggested tasks, then next actions.'
                        )}
                    </p>
                </div>

                <ToggleRow
                    icon={<FaceSmileIcon className="w-5 h-5 text-green-500" />}
                    label={t(
                        'profile.enableNextTaskSuggestion',
                        'Enable Next Task Suggestions'
                    )}
                    value={Boolean(formData.next_task_suggestion_enabled)}
                    onToggle={() => onToggle('next_task_suggestion_enabled')}
                />
            </div>
        </div>
    );
};

export default AiTab;
