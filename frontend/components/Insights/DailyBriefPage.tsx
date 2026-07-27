import React from 'react';
import { useTranslation } from 'react-i18next';
import DailyAssistant from '../AI/DailyAssistant';

const DailyBriefPage: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                <div className="flex items-center gap-3 mb-8">
                    <h2 className="text-2xl font-light">
                        {t('aiAssistant.title', 'Daily Brief')}
                    </h2>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400">
                        beta
                    </span>
                </div>
                <DailyAssistant />
            </div>
        </div>
    );
};

export default DailyBriefPage;
