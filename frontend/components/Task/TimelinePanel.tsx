import React from 'react';
import { useTranslation } from 'react-i18next';
import TaskTimeline from './TaskTimeline';
import { ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface TimelinePanelProps {
    taskUid: string | undefined;
    isExpanded: boolean;
    onToggle: () => void;
}

const TimelinePanel: React.FC<TimelinePanelProps> = ({
    taskUid,
    isExpanded,
    onToggle,
}) => {
    const { t } = useTranslation();

    return (
        <div
            className={`${
                isExpanded
                    ? 'w-full lg:w-80 opacity-100'
                    : 'w-0 lg:w-12 opacity-0 lg:opacity-100'
            } border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 sm:rounded-r-lg flex flex-col transition-all duration-300 overflow-hidden`}
        >
            {/* Collapsed state - envelope icon */}
            {!isExpanded && (
                <div className="hidden lg:flex flex-col items-center justify-center h-full p-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform rotate-90 whitespace-nowrap">
                        {t('timeline.activityTimeline')}
                    </span>
                </div>
            )}

            {/* Expanded state - full timeline */}
            {isExpanded && (
                <>
                    <div className="p-3 lg:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                                <ClockIcon className="h-4 w-4 mr-2 text-gray-500" />
                                {t('timeline.activityTimeline')}
                            </h3>
                            <button
                                onClick={() => onToggle()}
                                className="lg:hidden p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                title={t('timeline.hideTimeline')}
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <div className="p-3 lg:p-4 flex-1 overflow-hidden">
                        <TaskTimeline taskUid={taskUid} />
                    </div>
                </>
            )}
        </div>
    );
};

export default TimelinePanel;
