import React from 'react';
import { useTranslation } from 'react-i18next';
import BurndownChart from '../Task/BurndownChart';

const ReportsPage: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                <div className="flex items-center mb-8">
                    <h2 className="text-2xl font-light">
                        {t('sidebar.reports', 'Reports')}
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
                            {t('dashboard.weeklyCompletion', 'Weekly Completion')}
                        </h3>
                        <BurndownChart />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                                {t('reports.streaks', 'Streaks')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                {t('common.comingSoon', 'Coming soon')}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                                {t('reports.areaBreakdown', 'Area Breakdown')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                {t('common.comingSoon', 'Coming soon')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;
