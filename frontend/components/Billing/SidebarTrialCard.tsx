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
            className="mx-2.5 mb-2 rounded-lg bg-blue-600 dark:bg-blue-700 px-3 py-3 text-white shadow-sm"
            data-testid="trial-banner"
        >
            <div className="flex items-start gap-2">
                <SparklesIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-snug">
                    {t('subscription.trialBanner', {
                        defaultValue:
                            "You're on the free trial, {{count}} days left",
                        count: daysLeft(status.trial_ends_at),
                    })}
                </p>
            </div>
            <Link
                to="/subscription/new"
                className="mt-3 block w-full rounded-md bg-white px-3 py-1.5 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50"
                data-testid="trial-banner-subscribe"
            >
                {t('subscription.subscribe', 'Subscribe')}
            </Link>
        </div>
    );
};

export default SidebarTrialCard;
