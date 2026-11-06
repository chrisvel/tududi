import React from 'react';
import { useTranslation } from 'react-i18next';
import RoadmapChart from './RoadmapChart';

const Roadmap: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            <header className="pt-4 pb-5">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('roadmap.title', 'Roadmap')}
                </h1>
            </header>
            <RoadmapChart />
        </div>
    );
};

export default Roadmap;
