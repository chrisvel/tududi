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
    goToCheckout,
    changePlan,
    openPortal,
    syncCheckout,
    formatBytes,
} from '../../../utils/billingService';
import {
    formatMoney,
    isPaidPlan,
    planLabel,
    planPrice,
    purchasablePlans,
} from '../../../utils/billingPlans';
import { useToast } from '../../Shared/ToastContext';
import UsageBar from '../../Shared/UsageBar';

interface BillingTabProps {
    isActive: boolean;
}

const BillingTab: React.FC<BillingTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();
    const [status, setStatus] = useState<BillingStatus | null>(null);
    const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<
        'month' | 'year' | 'portal' | 'plan' | null
    >(null);
    const [interval, setInterval] = useState<'month' | 'year'>('year');
    const [planKey, setPlanKey] = useState('pro');

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

    // Coming back from the provider's checkout: confirm the subscription right away instead
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
            await goToCheckout(chosen, planKey, () => setBusy(null));
        } catch (err: any) {
            showErrorToast(err.message || 'Checkout failed');
            setBusy(null);
        }
    };

    const onChangePlan = async (key: string) => {
        setBusy('plan');
        try {
            setStatus(await changePlan(key));
            showSuccessToast(
                t('billing.planChanged', 'Your plan was changed.')
            );
        } catch (err: any) {
            showErrorToast(err.message || 'Could not change the plan');
        } finally {
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
    const isPro = isPaidPlan(status?.plan);
    const plans = status ? purchasablePlans(status) : [];
    const teamPlans = plans.filter((p) => p.key !== 'pro');
    const chosenPlan = plans.find((p) => p.key === planKey) || plans[0];
    const seatsFull =
        !!status?.seats && status.seats.used >= status.seats.seats;

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
                                    {planLabel(
                                        t,
                                        status.plan,
                                        status.seats?.seats ?? 1,
                                        status.planName
                                    )}
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
                                    {status.reason === 'seat' &&
                                        t('billing.seatCovered', {
                                            defaultValue:
                                                'Your seat is paid by {{name}}.',
                                            name:
                                                status.seat_owner?.name ||
                                                t(
                                                    'billing.workspaceOwner',
                                                    'the workspace owner'
                                                ),
                                        })}
                                    {status.reason !== 'seat' &&
                                        !!status.seats &&
                                        (status.seats.seats > 1 ||
                                            status.seats.members > 0) && (
                                            <span
                                                className="block"
                                                data-testid="billing-seats"
                                            >
                                                {t('billing.seatsUsed', {
                                                    defaultValue:
                                                        '{{used}} of {{seats}} seats in use.',
                                                    used: status.seats.used,
                                                    seats: status.seats.seats,
                                                })}
                                                {seatsFull &&
                                                    status.portal_available &&
                                                    !status.plan_change_available && (
                                                        <span className="ml-1">
                                                            {t(
                                                                'billing.seatsFullHint',
                                                                'For more, move to a bigger Team plan in "Manage subscription".'
                                                            )}
                                                        </span>
                                                    )}
                                            </span>
                                        )}
                                </div>
                            </div>
                            <div className="flex items-center">
                                {status.plan_change_available && (
                                    <select
                                        value={status.plan}
                                        onChange={(e) =>
                                            onChangePlan(e.target.value)
                                        }
                                        disabled={busy !== null}
                                        className="mr-2 px-2 py-2 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                                        aria-label={t(
                                            'billing.changePlan',
                                            'Change plan'
                                        )}
                                        data-testid="billing-change-plan"
                                    >
                                        {plans
                                            .filter(
                                                (p) =>
                                                    p.key === status.plan ||
                                                    (status.subscription
                                                        ?.interval === 'year'
                                                        ? p.intervals.year
                                                        : p.intervals.month)
                                            )
                                            .map((p) => (
                                                <option
                                                    key={p.key}
                                                    value={p.key}
                                                >
                                                    {planLabel(
                                                        t,
                                                        p.key,
                                                        p.seats
                                                    )}
                                                </option>
                                            ))}
                                    </select>
                                )}
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
                                    'AI requests this month'
                                )}
                                used={status.usage.ai_requests_this_month}
                                limit={status.limits.ai_requests_per_month}
                            />
                            <UsageBar
                                label={t(
                                    'billing.resource.aiCredits',
                                    'AI credits this month'
                                )}
                                used={status.usage.ai_credits_used_this_month}
                                limit={status.limits.ai_credits_per_month}
                            />
                        </div>
                    )}

                    {!isPro &&
                        status.checkout_available &&
                        proPlan &&
                        chosenPlan && (
                            <div className="p-4 rounded-lg bg-blue-50/60 dark:bg-blue-900/10">
                                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    {t('billing.upgradeTo', {
                                        defaultValue: 'Upgrade to {{plan}}',
                                        plan: planLabel(
                                            t,
                                            chosenPlan.key,
                                            chosenPlan.seats
                                        ),
                                    })}
                                </h4>
                                {teamPlans.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => setPlanKey('pro')}
                                            className={`px-3 py-1.5 rounded text-sm ${
                                                chosenPlan.key === 'pro'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                            data-testid="billing-plan-pro"
                                        >
                                            {t('billing.justMe', 'Just me')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPlanKey(
                                                    chosenPlan.key === 'pro'
                                                        ? teamPlans[0].key
                                                        : chosenPlan.key
                                                )
                                            }
                                            className={`px-3 py-1.5 rounded text-sm ${
                                                chosenPlan.key !== 'pro'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                            data-testid="billing-plan-team"
                                        >
                                            {t('billing.team', 'Team')}
                                        </button>
                                        {chosenPlan.key !== 'pro' && (
                                            <select
                                                value={chosenPlan.key}
                                                onChange={(e) =>
                                                    setPlanKey(e.target.value)
                                                }
                                                className="px-2 py-1.5 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                                aria-label={t(
                                                    'billing.teamSize',
                                                    'Team size'
                                                )}
                                                data-testid="billing-team-size"
                                            >
                                                {teamPlans.map((p) => (
                                                    <option
                                                        key={p.key}
                                                        value={p.key}
                                                    >
                                                        {t(
                                                            'billing.upToSeats',
                                                            {
                                                                defaultValue:
                                                                    'Up to {{seats}} people',
                                                                seats: p.seats,
                                                            }
                                                        )}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}
                                <p
                                    className="text-sm text-gray-700 dark:text-gray-300 mb-3"
                                    data-testid="billing-price"
                                >
                                    {t(
                                        interval === 'year'
                                            ? 'billing.pricePerYear'
                                            : 'billing.pricePerMonth',
                                        {
                                            defaultValue:
                                                interval === 'year'
                                                    ? '{{price}} a year'
                                                    : '{{price}} a month',
                                            price: formatMoney(
                                                status.pricing?.currency,
                                                planPrice(
                                                    status,
                                                    chosenPlan.seats,
                                                    interval
                                                )
                                            ),
                                        }
                                    )}
                                    {chosenPlan.seats > 1 && (
                                        <span className="text-gray-500 dark:text-gray-400">
                                            {' '}
                                            {t('billing.perSeatNote', {
                                                defaultValue:
                                                    '({{seats}} seats, you included)',
                                                seats: chosenPlan.seats,
                                            })}
                                        </span>
                                    )}
                                </p>
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
                                                (proPlan.limits.storage_mb ||
                                                    0) *
                                                    1024 *
                                                    1024
                                            ),
                                        })}
                                    </li>
                                    <li className="flex items-center">
                                        <CheckIcon className="w-4 h-4 mr-2 text-green-500" />
                                        {t(
                                            'billing.perkFeatures',
                                            'AI assistant, MCP, CalDAV sync, backup import'
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
                                        : t(
                                              'billing.upgradeNow',
                                              'Upgrade now'
                                          )}
                                </button>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    {t('billing.paymentsNote', {
                                        provider: status.provider?.display_name,
                                        defaultValue:
                                            'Payments are handled by {{provider}}. Cancel any time from "Manage subscription".',
                                    })}
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
