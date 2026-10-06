import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useBillingStatus } from '../../hooks/useTrialStatus';
import { daysLeft } from './TrialBanner';

// Pinned to the bottom of the sidebar while a Cloud account is on its free
// trial: the days left and a way to subscribe, in view on every page
// without taking room from the content.
const SidebarTrialCard: React.FC = () => {
    const { t } = useTranslation();
    const status = useBillingStatus();
    if (status?.reason !== 'trial' || !status.trial_ends_at) return null;

    return (
        <div
            className="mx-2.5 mb-2 flex items-center gap-2 rounded-lg bg-blue-50/70 px-3 py-2 dark:bg-blue-500/10"
            data-testid="trial-banner"
        >
            <SparklesIcon className="h-4 w-4 flex-shrink-0 text-blue-400 dark:text-blue-300" />
            <p className="flex-1 text-xs leading-snug text-blue-900/80 dark:text-blue-100/80">
                {t('subscription.trialBanner', {
                    defaultValue:
                        "You're on the free trial, {{count}} days left",
                    count: daysLeft(status.trial_ends_at),
                })}
            </p>
            <Link
                to="/subscription/new"
                className="flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                data-testid="trial-banner-subscribe"
            >
                {t('subscription.subscribe', 'Subscribe')}
            </Link>
        </div>
    );
};

export default SidebarTrialCard;
