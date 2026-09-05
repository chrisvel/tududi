import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fetchBillingStatus } from '../../utils/billingService';
import type { BillingStatus } from '../../entities/Billing';

// Small plan indicator for the user menu. Only rendered on hosted instances.
const PlanBadge: React.FC = () => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<BillingStatus | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchBillingStatus()
            .then((s) => {
                if (!cancelled) setStatus(s);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    if (!status) return null;

    const isPro = status.plan === 'pro';
    return (
        <Link
            to="/profile?section=billing"
            className="flex items-center justify-between px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            data-testid="plan-badge"
        >
            <span className="text-gray-600 dark:text-gray-400">
                {t('billing.plan', 'Plan')}
            </span>
            <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isPro
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                }`}
            >
                {status.planName}
                {status.reason === 'trial' &&
                    ` (${t('billing.trial', 'trial')})`}
            </span>
        </Link>
    );
};

export default PlanBadge;
