import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';

interface ProductivityTabProps {
    isActive: boolean;
    pomodoroEnabled: boolean;
    onTogglePomodoro: () => void;
}

const ProductivityTab: React.FC<ProductivityTabProps> = ({
    isActive,
    pomodoroEnabled,
    onTogglePomodoro,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <ClockIcon className="w-6 h-6 mr-3 text-green-500" />
                {t('profile.productivityFeatures', 'Productivity Features')}
            </h3>

            <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t(
                                'profile.enablePomodoro',
                                'Enable Pomodoro Timer'
                            )}
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t(
                                'profile.pomodoroDescription',
                                'Enable the Pomodoro timer in the navigation bar for focused work sessions.'
                            )}
                        </p>
                    </div>
                    <div
                        className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                            pomodoroEnabled
                                ? 'bg-blue-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        onClick={onTogglePomodoro}
                    >
                        <span
                            className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                pomodoroEnabled
                                    ? 'translate-x-6'
                                    : 'translate-x-0'
                            }`}
                        ></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductivityTab;
