// Life-to-Day (T-304): Review tab is a route and label only. Guided
// review (Phase 4+) is out of scope.
import React from 'react';
import { useTranslation } from 'react-i18next';

const ReviewPage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div data-testid="review-page" className="p-6 max-w-xl">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('navigation.ltd.review', 'Review')}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t(
                    'navigation.ltd.reviewStub',
                    'Guided review will appear here later.'
                )}
            </p>
        </div>
    );
};

export default ReviewPage;
