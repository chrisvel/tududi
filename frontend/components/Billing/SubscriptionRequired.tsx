import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@heroicons/react/24/outline';
import { getApiPath } from '../../config/paths';
import {
    fetchBillingStatus,
    fetchBillingCatalog,
    startCheckout,
    syncCheckout,
} from '../../utils/billingService';
import type { BillingCatalog, BillingStatus } from '../../entities/Billing';

type Interval = 'month' | 'year';

// The wall an account meets on an instance that sells access: no
// subscription, no app. Everything it offers is a way forward - subscribe,
// take the data elsewhere, or sign out - because the rest of the product is
// closed until one of the plans is bought.
const SubscriptionRequired: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [status, setStatus] = useState<BillingStatus | null>(null);
    const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
    const [interval, setIntervalChoice] = useState<Interval>('year');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        try {
            const [s, c] = await Promise.all([
                fetchBillingStatus(),
                fetchBillingCatalog(),
            ]);
            setStatus(s);
            setCatalog(c);
            if (!c.intervals.year) setIntervalChoice('month');
            return s;
        } catch (err: any) {
            setError(err.message || 'Could not load the plans');
            return null;
        }
    };

    // Coming back from the provider's checkout: confirm the subscription
    // straight away rather than waiting on the webhook, then leave.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const done = params.get('checkout') === 'success';
        const run = async () => {
            if (done) {
                try {
                    const synced = await syncCheckout(
                        params.get('session_id') || undefined
                    );
                    if (synced.active) {
                        navigate('/today', { replace: true });
                        return;
                    }
                } catch {
                    // fall through to the normal load
                }
            }
            const s = await load();
            if (s && s.active) navigate('/today', { replace: true });
        };
        run();
    }, []);

    const onSubscribe = async () => {
        setBusy(true);
        setError(null);
        try {
            const url = await startCheckout(interval);
            window.location.assign(url);
        } catch (err: any) {
            setError(err.message || 'Could not start the checkout');
            setBusy(false);
        }
    };

    const onSignOut = async () => {
        try {
            await fetch(getApiPath('logout'), {
                method: 'GET',
                credentials: 'include',
            });
        } finally {
            window.location.href = '/login';
        }
    };

    // The symbol follows whatever currency the instance quotes in, so a
    // euro store never renders a dollar sign.
    const money = (amount?: number) =>
        amount === undefined
            ? ''
            : new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: status?.pricing?.currency || 'USD',
                  maximumFractionDigits: 0,
              }).format(amount);

    const pro = catalog?.plans.find((p) => p.key === 'pro');
    const perks = [
        t('subscription.perkUnlimited', 'Unlimited tasks, projects and notes'),
        t('subscription.perkStorage', 'Attachments and file uploads'),
        t(
            'subscription.perkFeatures',
            'AI assistant, MCP, CalDAV sync and the Telegram bot'
        ),
        t('subscription.perkBackups', 'Daily backups and managed updates'),
        t('subscription.perkExport', 'Export everything at any time'),
    ];

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 px-4 py-12">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
                    {t('subscription.title', 'Subscription')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    {t(
                        'subscription.chooseForCloud',
                        'Choose a plan for tududi Cloud'
                    )}
                </p>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
                    <p className="font-medium text-gray-800 dark:text-gray-100">
                        {t('subscription.noActive', 'No active subscription')}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {t(
                            'subscription.chooseToContinue',
                            'Choose a plan to continue using tududi Cloud.'
                        )}
                    </p>

                    {error && (
                        <div
                            className="mb-4 text-red-500"
                            data-testid="subscription-error"
                        >
                            {error}
                        </div>
                    )}

                    {status && !status.billing_configured ? (
                        <p className="text-gray-600 dark:text-gray-400">
                            {t(
                                'subscription.notConfigured',
                                'Subscriptions are not available on this instance yet. Please contact support.'
                            )}
                        </p>
                    ) : (
                        <>
                            {catalog?.intervals.month &&
                                catalog?.intervals.year && (
                                    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 mb-6">
                                        {(['month', 'year'] as Interval[]).map(
                                            (opt) => (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() =>
                                                        setIntervalChoice(opt)
                                                    }
                                                    className={`px-4 py-1.5 text-sm rounded-md ${
                                                        interval === opt
                                                            ? 'bg-blue-500 text-white'
                                                            : 'text-gray-600 dark:text-gray-300'
                                                    }`}
                                                    data-testid={`subscription-interval-${opt}`}
                                                >
                                                    {opt === 'month'
                                                        ? t(
                                                              'subscription.monthly',
                                                              'Monthly'
                                                          )
                                                        : t(
                                                              'subscription.yearly',
                                                              'Yearly'
                                                          )}
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}

                            <div className="mb-6">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {pro?.name || 'Pro'}
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {interval === 'month'
                                        ? t('subscription.priceMonthly', {
                                              defaultValue:
                                                  '{{price}} per month',
                                              price: money(
                                                  status?.pricing?.monthly
                                              ),
                                          })
                                        : t('subscription.priceYearly', {
                                              defaultValue:
                                                  '{{price}} per year',
                                              price: money(
                                                  status?.pricing?.annual
                                              ),
                                          })}
                                </p>
                            </div>

                            <ul className="space-y-2 mb-8">
                                {perks.map((perk) => (
                                    <li
                                        key={perk}
                                        className="flex items-start text-gray-700 dark:text-gray-300"
                                    >
                                        <CheckIcon className="w-5 h-5 mr-2 mt-0.5 text-green-500 shrink-0" />
                                        <span>{perk}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                type="button"
                                onClick={onSubscribe}
                                disabled={busy || !status?.checkout_available}
                                className="w-full bg-blue-500 text-white py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-60"
                                data-testid="subscription-subscribe"
                            >
                                {busy
                                    ? t('common.loading', 'Loading...')
                                    : interval === 'month'
                                      ? t(
                                            'subscription.subscribeMonthly',
                                            'Subscribe monthly'
                                        )
                                      : t(
                                            'subscription.subscribeYearly',
                                            'Subscribe yearly'
                                        )}
                            </button>

                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                                {t('subscription.taxNote', {
                                    defaultValue:
                                        'Payments are handled by {{provider}}. Prices exclude applicable taxes. Cancel at any time.',
                                    provider:
                                        status?.provider?.display_name ||
                                        'our payment provider',
                                })}
                            </p>
                        </>
                    )}
                </div>

                <div className="mt-6 flex flex-wrap gap-4 text-sm">
                    <button
                        type="button"
                        onClick={() => navigate('/profile')}
                        className="text-blue-500 hover:text-blue-600"
                        data-testid="subscription-profile"
                    >
                        {t('subscription.exportData', 'Export your data')}
                    </button>
                    <button
                        type="button"
                        onClick={onSignOut}
                        className="text-gray-500 hover:text-gray-600 dark:text-gray-400"
                        data-testid="subscription-signout"
                    >
                        {t('navigation.logout', 'Logout')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionRequired;
