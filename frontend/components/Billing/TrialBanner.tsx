import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHostedMode } from '../../hooks/useHostedMode';
import { fetchBillingStatus } from '../../utils/billingService';
import type { BillingStatus } from '../../entities/Billing';

const DAY_MS = 24 * 60 * 60 * 1000;

// Days left, counting a started day as a whole one, so the last day of a
// trial reads "1 day left" rather than "0".
export const daysLeft = (until: string, now = Date.now()): number =>
    Math.max(1, Math.ceil((new Date(until).getTime() - now) / DAY_MS));

// A bar that stays at the top of every page of a Cloud account that has not
// subscribed yet: during the trial it counts the days down, after it says
// the data is read-only and when the account will be deleted. Both offer
// the subscription page. Renders nothing anywhere else.
const TrialBanner: React.FC = () => {
    const { t } = useTranslation();
    const hosted = useHostedMode();
    const [status, setStatus] = useState<BillingStatus | null>(null);

    useEffect(() => {
        if (!hosted) return;
        let cancelled = false;
        fetchBillingStatus()
            .then((s) => {
                if (!cancelled) setStatus(s);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [hosted]);

    const onTrial = status?.reason === 'trial' && !!status.trial_ends_at;
    const readOnly = !!status?.read_only && !!status.read_only_until;
    if (!onTrial && !readOnly) return null;

    const message = readOnly
        ? t('subscription.readOnlyBanner', {
              defaultValue:
                  'Your trial has ended, so your data is read-only. Subscribe to keep using tududi, or export your data. The account will be deleted on {{date}}.',
              date: new Date(status!.read_only_until!).toLocaleDateString(),
          })
        : t('subscription.trialBanner', {
              defaultValue: "You're on the free trial, {{count}} days left",
              count: daysLeft(status!.trial_ends_at!),
          });

    return (
        <div
            className={`sticky top-0 z-20 mx-4 mt-2 mb-4 px-4 py-2 rounded-lg text-sm flex items-center gap-3 ${
                readOnly
                    ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100'
                    : 'bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
            }`}
            data-testid={readOnly ? 'trial-read-only-banner' : 'trial-banner'}
        >
            <p className="flex-1">{message}</p>
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
