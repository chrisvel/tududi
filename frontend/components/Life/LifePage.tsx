// Life-to-Day (T-304): Life tab is a route and label only. The Life
// Timeline body is Phase 6 — do not build it here.
import React from 'react';
import { useTranslation } from 'react-i18next';

const LifePage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div data-testid="life-page" className="p-6 max-w-xl">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('navigation.ltd.life', 'Life')}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t(
                    'navigation.ltd.lifeStub',
                    'The life timeline will appear here later.'
                )}
            </p>
        </div>
    );
};

export default LifePage;
