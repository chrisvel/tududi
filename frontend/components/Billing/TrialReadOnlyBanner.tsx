import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHostedMode } from '../../hooks/useHostedMode';
import { fetchBillingStatus } from '../../utils/billingService';

// Shown across the app once a Cloud trial has ended unpaid: everything can
// still be read and exported, nothing can be changed, and the account goes
// away on the date given. Renders nothing anywhere else.
const TrialReadOnlyBanner: React.FC = () => {
    const { t } = useTranslation();
    const hosted = useHostedMode();
    const [until, setUntil] = useState<string | null>(null);

    useEffect(() => {
        if (!hosted) return;
        let cancelled = false;
        fetchBillingStatus()
            .then((status) => {
                if (!cancelled && status.read_only && status.read_only_until) {
                    setUntil(status.read_only_until);
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [hosted]);

    if (!until) return null;

    return (
        <div
            className="mx-4 mt-2 mb-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 text-sm flex flex-col sm:flex-row sm:items-center gap-3"
            data-testid="trial-read-only-banner"
        >
            <p className="flex-1">
                {t('subscription.readOnlyBanner', {
                    defaultValue:
                        'Your trial has ended, so your data is read-only. Subscribe to keep using tududi, or export your data. The account will be deleted on {{date}}.',
                    date: new Date(until).toLocaleDateString(),
                })}
            </p>
            <Link
                to="/subscription/new"
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-center whitespace-nowrap"
            >
                {t('subscription.subscribe', 'Subscribe')}
            </Link>
        </div>
    );
};

export default TrialReadOnlyBanner;
