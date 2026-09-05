import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    CreditCardIcon,
    CheckIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { BillingStatus, BillingCatalog } from '../../../entities/Billing';
import {
    fetchBillingStatus,
    fetchBillingCatalog,
    startCheckout,
    openPortal,
    syncCheckout,
    formatBytes,
} from '../../../utils/billingService';
import { useToast } from '../../Shared/ToastContext';

interface BillingTabProps {
    isActive: boolean;
}

const UsageBar: React.FC<{
    label: string;
    used: number;
    limit: number | null;
    format?: (n: number) => string;
}> = ({ label, used, limit, format = (n) => String(n) }) => {
    const { t } = useTranslation();
    const pct =
        limit && limit > 0
            ? Math.min(100, Math.round((used / limit) * 100))
            : 0;
    const tone =
        pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500';
    return (
        <div>
            <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
                <span>{label}</span>
                <span>
                    {format(used)}
                    {limit === null
                        ? ` / ${t('billing.unlimited', 'unlimited')}`
                        : ` / ${format(limit)}`}
                </span>
            </div>
            {limit !== null && (
                <div className="h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                        className={`h-2 ${tone}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
    );
};

const BillingTab: React.FC<BillingTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();
    const [status, setStatus] = useState<BillingStatus | null>(null);
    const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<'month' | 'year' | 'portal' | null>(null);
    const [interval, setInterval] = useState<'month' | 'year'>('year');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [s, c] = await Promise.all([
                fetchBillingStatus(),
                fetchBillingCatalog(),
            ]);
            setStatus(s);
            setCatalog(c);
            if (!c.intervals.year) setInterval('month');
        } catch (err: any) {
            showErrorToast(err.message || 'Failed to load billing');
        } finally {
            setLoading(false);
        }
    }, [showErrorToast]);

    // Coming back from Stripe: confirm the subscription right away instead
    // of waiting for the webhook, then clean the URL.
    useEffect(() => {
        if (!isActive) return;
        const params = new URLSearchParams(location.search);
        const checkout = params.get('checkout');
        const sessionId = params.get('session_id') || undefined;
        if (checkout === 'success') {
            syncCheckout(sessionId)
                .then((s) => {
                    setStatus(s);
                    showSuccessToast(
                        t('billing.checkoutSuccess', 'Welcome to Pro!')
                    );
                })
                .catch(() => load())
                .finally(() => {
                    params.delete('checkout');
                    params.delete('session_id');
                    navigate(
                        { search: params.toString() ? `?${params}` : '' },
                        { replace: true }
                    );
                });
        } else if (checkout === 'cancel') {
            params.delete('checkout');
            navigate(
                { search: params.toString() ? `?${params}` : '' },
                { replace: true }
            );
            load();
        } else {
            load();
        }
    }, [isActive]); // only on activation, the URL is read fresh each time

    if (!isActive) return null;

    const onUpgrade = async (chosen: 'month' | 'year') => {
        setBusy(chosen);
        try {
            const url = await startCheckout(chosen);
            window.location.assign(url);
        } catch (err: any) {
            showErrorToast(err.message || 'Checkout failed');
            setBusy(null);
        }
    };

    const onPortal = async () => {
        setBusy('portal');
        try {
            const url = await openPortal();
            window.location.assign(url);
        } catch (err: any) {
            showErrorToast(err.message || 'Could not open the portal');
            setBusy(null);
        }
    };

    const formatDate = (value?: string | null) =>
        value ? new Date(value).toLocaleDateString() : '';

    const proPlan = catalog?.plans.find((p) => p.key === 'pro');
    const isPro = status?.plan === 'pro';

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <CreditCardIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t('billing.title', 'Plan & Billing')}
            </h3>

            {loading && !status ? (
                <div className="text-sm text-gray-500">
                    {t('common.loading', 'Loading...')}
                </div>
            ) : status ? (
                <div className="space-y-6">
                    {status.subscription?.status === 'past_due' && (
                        <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-amber-800 dark:text-amber-200 flex items-start">
                            <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                            <div className="text-sm">
                                {t(
                                    'billing.pastDue',
                                    'Your last payment did not go through. Update your card to keep your plan.'
                                )}
                                {status.grace_until && (
                                    <span className="ml-1">
                                        {t('billing.graceUntil', {
                                            defaultValue:
                                                'Pro stays active until {{date}}.',
                                            date: formatDate(
                                                status.grace_until
                                            ),
                                        })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('billing.currentPlan', 'Current plan')}
                                </div>
                                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {status.planName}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {status.reason === 'trial' &&
                                        t('billing.trialEnds', {
                                            defaultValue:
                                                'Trial ends {{date}}.',
                                            date: formatDate(
                                                status.trial_ends_at
                                            ),
                                        })}
                                    {status.reason === 'subscription' &&
                                        status.subscription
                                            ?.current_period_end &&
                                        (status.subscription
                                            .cancel_at_period_end
                                            ? t('billing.endsOn', {
                                                  defaultValue:
                                                      'Ends {{date}}.',
                                                  date: formatDate(
                                                      status.subscription
                                                          .current_period_end
                                                  ),
                                              })
                                            : t('billing.renewsOn', {
                                                  defaultValue:
                                                      'Renews {{date}}.',
                                                  date: formatDate(
                                                      status.subscription
                                                          .current_period_end
                                                  ),
                                              }))}
                                    {status.reason === 'override' &&
                                        t(
                                            'billing.complimentary',
                                            'Complimentary access.'
                                        )}
                                    {status.reason === 'admin' &&
                                        t(
                                            'billing.adminExempt',
                                            'Administrators are not limited.'
                                        )}
                                </div>
                            </div>
                            {status.portal_available && (
                                <button
                                    type="button"
                                    onClick={onPortal}
                                    disabled={busy !== null}
                                    className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                                    data-testid="billing-portal"
                                >
                                    {t(
                                        'billing.manageSubscription',
                                        'Manage subscription'
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {status.usage && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                {t('billing.usage', 'Usage')}
                            </h4>
                            <UsageBar
                                label={t(
                                    'billing.resource.task',
                                    'active tasks'
                                )}
                                used={status.usage.tasks}
                                limit={status.limits.max_tasks}
                            />
                            <UsageBar
                                label={t(
                                    'billing.resource.project',
                                    'projects'
                                )}
                                used={status.usage.projects}
                                limit={status.limits.max_projects}
                            />
                            <UsageBar
                                label={t('billing.resource.note', 'notes')}
                                used={status.usage.notes}
                                limit={status.limits.max_notes}
                            />
                            <UsageBar
                                label={t(
                                    'billing.resource.storage',
                                    'attachment storage'
                                )}
                                used={status.usage.storage_bytes}
                                limit={
                                    status.limits.storage_mb === null
                                        ? null
                                        : status.limits.storage_mb * 1024 * 1024
                                }
                                format={formatBytes}
                            />
                            <UsageBar
                                label={t(
                                    'billing.resource.ai',
                                    'AI requests today'
                                )}
                                used={status.usage.ai_requests_today}
                                limit={status.limits.ai_requests_per_day}
                            />
                        </div>
                    )}

                    {!isPro && status.checkout_available && proPlan && (
                        <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                {t('billing.upgradeTo', {
                                    defaultValue: 'Upgrade to {{plan}}',
                                    plan: proPlan.name,
                                })}
                            </h4>
                            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mb-4">
                                <li className="flex items-center">
                                    <CheckIcon className="w-4 h-4 mr-2 text-green-500" />
                                    {t(
                                        'billing.perkUnlimited',
                                        'Unlimited tasks, projects and notes'
                                    )}
                                </li>
                                <li className="flex items-center">
                                    <CheckIcon className="w-4 h-4 mr-2 text-green-500" />
                                    {t('billing.perkStorage', {
                                        defaultValue:
                                            '{{size}} of attachment storage',
                                        size: formatBytes(
                                            (proPlan.limits.storage_mb || 0) *
                                                1024 *
                                                1024
                                        ),
                                    })}
                                </li>
                                <li className="flex items-center">
                                    <CheckIcon className="w-4 h-4 mr-2 text-green-500" />
                                    {t(
                                        'billing.perkFeatures',
                                        'AI assistant, MCP, CalDAV sync, Telegram bot, backup import'
                                    )}
                                </li>
                            </ul>
                            {status.intervals.month &&
                                status.intervals.year && (
                                    <div className="flex items-center space-x-2 mb-4">
                                        {(['month', 'year'] as const).map(
                                            (opt) => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() =>
                                                        setInterval(opt)
                                                    }
                                                    className={`px-3 py-1.5 rounded text-sm border ${
                                                        interval === opt
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                                    }`}
                                                >
                                                    {opt === 'month'
                                                        ? t(
                                                              'billing.monthly',
                                                              'Monthly'
                                                          )
                                                        : t(
                                                              'billing.annual',
                                                              'Annual'
                                                          )}
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}
                            <button
                                type="button"
                                onClick={() => onUpgrade(interval)}
                                disabled={busy !== null}
                                className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                data-testid="billing-upgrade"
                            >
                                {busy === interval
                                    ? t('common.loading', 'Loading...')
                                    : t('billing.upgradeNow', 'Upgrade now')}
                            </button>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                {t(
                                    'billing.stripeNote',
                                    'Payments are handled by Stripe. Cancel any time from "Manage subscription".'
                                )}
                            </p>
                        </div>
                    )}

                    {!status.billing_configured && !isPro && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t(
                                'billing.notConfigured',
                                'Upgrades are not available on this instance yet.'
                            )}
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
};

export default BillingTab;
