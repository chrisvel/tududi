import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBillingStatus } from '../../hooks/useTrialStatus';

const DAY_MS = 24 * 60 * 60 * 1000;

// Days left, counting a started day as a whole one, so the last day of a
// trial reads "1 day left" rather than "0".
export const daysLeft = (until: string, now = Date.now()): number =>
    Math.max(1, Math.ceil((new Date(until).getTime() - now) / DAY_MS));

// After an unpaid trial ends: a bar at the top of every page saying the data
// is read-only and when the account will be deleted, with a way to
// subscribe. The trial itself is counted down in the sidebar
// (SidebarTrialCard). Renders nothing anywhere else.
const TrialBanner: React.FC = () => {
    const { t } = useTranslation();
    const status = useBillingStatus();

    if (!status?.read_only || !status.read_only_until) return null;

    return (
        <div
            className="sticky top-0 z-20 mx-4 mt-2 mb-4 px-4 py-2 rounded-lg text-sm flex items-center gap-3 bg-amber-50 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100"
            data-testid="trial-read-only-banner"
        >
            <p className="flex-1">
                {t('subscription.readOnlyBanner', {
                    defaultValue:
                        'Your trial has ended, so your data is read-only. Subscribe to keep using tududi, or export your data. The account will be deleted on {{date}}.',
                    date: new Date(status.read_only_until).toLocaleDateString(),
                })}
            </p>
            <Link
                to="/subscription/new"
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-center whitespace-nowrap"
                data-testid="trial-banner-subscribe"
            >
                {t('subscription.subscribe', 'Subscribe')}
            </Link>
        </div>
    );
};

export default TrialBanner;
