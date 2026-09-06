import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CreditCardIcon,
    ArrowPathIcon,
    GiftIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import {
    fetchAdminBilling,
    setPlanOverride,
    clearPlanOverride,
    syncAccountFromProvider,
    AdminBillingAccount,
    AdminBillingSummaryRow,
} from '../../utils/adminBillingService';

const AdminBillingPage: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [accounts, setAccounts] = useState<AdminBillingAccount[]>([]);
    const [summary, setSummary] = useState<AdminBillingSummaryRow[]>([]);
    const [total, setTotal] = useState(0);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<AdminBillingAccount | null>(null);
    const [overridePlan, setOverridePlan] = useState('pro');
    const [overrideExpires, setOverrideExpires] = useState('');
    const [overrideReason, setOverrideReason] = useState('');
    const [busyUser, setBusyUser] = useState<number | null>(null);

    const load = useCallback(
        async (q = query) => {
            setLoading(true);
            try {
                const data = await fetchAdminBilling(q);
                setAccounts(data.accounts);
                setSummary(data.summary);
                setTotal(data.total);
            } catch (err: any) {
                showErrorToast(err.message || 'Failed to load billing');
            } finally {
                setLoading(false);
            }
        },
        [query, showErrorToast]
    );

    useEffect(() => {
        load('');
    }, [load]);

    const formatDate = (value: string | null) =>
        value ? new Date(value).toLocaleDateString() : '';

    const openOverride = (account: AdminBillingAccount) => {
        setEditing(account);
        setOverridePlan(account.override_plan || 'pro');
        setOverrideExpires(
            account.override_expires_at
                ? account.override_expires_at.slice(0, 10)
                : ''
        );
        setOverrideReason('');
    };

    const saveOverride = async () => {
        if (!editing) return;
        setBusyUser(editing.user_id);
        try {
            await setPlanOverride(editing.user_id, {
                plan: overridePlan,
                expires_at: overrideExpires || null,
                reason: overrideReason || undefined,
            });
            showSuccessToast(
                t('admin.billing.overrideSaved', 'Override saved')
            );
            setEditing(null);
            await load();
        } catch (err: any) {
            showErrorToast(err.message || 'Failed to save override');
        } finally {
            setBusyUser(null);
        }
    };

    const removeOverride = async (account: AdminBillingAccount) => {
        setBusyUser(account.user_id);
        try {
            await clearPlanOverride(account.user_id);
            showSuccessToast(
                t('admin.billing.overrideCleared', 'Override removed')
            );
            await load();
        } catch (err: any) {
            showErrorToast(err.message || 'Failed to remove override');
        } finally {
            setBusyUser(null);
        }
    };

    const sync = async (account: AdminBillingAccount) => {
        setBusyUser(account.user_id);
        try {
            await syncAccountFromProvider(account.user_id);
            showSuccessToast(
                t('admin.billing.synced', 'Synced from the payment provider')
            );
            await load();
        } catch (err: any) {
            showErrorToast(err.message || 'Sync failed');
        } finally {
            setBusyUser(null);
        }
    };

    const summaryByPlan = summary.reduce<Record<string, number>>((acc, row) => {
        acc[row.plan] = (acc[row.plan] || 0) + row.count;
        return acc;
    }, {});
    const activeSubscriptions = summary
        .filter((r) => r.status === 'active' || r.status === 'trialing')
        .reduce((n, r) => n + r.count, 0);
    const pastDue = summary
        .filter((r) => r.status === 'past_due')
        .reduce((n, r) => n + r.count, 0);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <CreditCardIcon className="w-7 h-7 mr-3 text-blue-500" />
                {t('admin.billing.title', 'Billing')}
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    [t('admin.billing.accounts', 'Accounts'), total],
                    [
                        t('admin.billing.onPro', 'On Pro'),
                        summaryByPlan.pro || 0,
                    ],
                    [
                        t('admin.billing.activeSubscriptions', 'Paying'),
                        activeSubscriptions,
                    ],
                    [t('admin.billing.pastDue', 'Past due'), pastDue],
                ].map(([label, value]) => (
                    <div
                        key={String(label)}
                        className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900"
                    >
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {label}
                        </div>
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            <form
                className="flex items-center gap-2 mb-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    load(query);
                }}
            >
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t(
                        'admin.billing.searchPlaceholder',
                        'Search by email'
                    )}
                    className="flex-1 max-w-md px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    data-testid="admin-billing-search"
                />
                <button
                    type="submit"
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                    {t('common.search', 'Search')}
                </button>
            </form>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-left text-gray-600 dark:text-gray-300">
                        <tr>
                            <th className="px-4 py-2">
                                {t('admin.billing.user', 'User')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.billing.plan', 'Plan')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.billing.status', 'Status')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.billing.until', 'Until')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.billing.override', 'Override')}
                            </th>
                            <th className="px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={6}
                                >
                                    {t('common.loading', 'Loading...')}
                                </td>
                            </tr>
                        ) : accounts.length === 0 ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={6}
                                >
                                    {t(
                                        'admin.billing.empty',
                                        'No billing accounts yet'
                                    )}
                                </td>
                            </tr>
                        ) : (
                            accounts.map((a) => (
                                <tr
                                    key={a.user_id}
                                    className="text-gray-900 dark:text-gray-100"
                                >
                                    <td className="px-4 py-2">
                                        <div>{a.email}</div>
                                        {a.name && (
                                            <div className="text-xs text-gray-500">
                                                {a.name}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 capitalize">
                                        {a.plan}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span
                                            className={`px-2 py-0.5 rounded text-xs ${
                                                a.status === 'past_due'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                                    : a.status === 'active' ||
                                                        a.status === 'trialing'
                                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                                            }`}
                                        >
                                            {a.status}
                                        </span>
                                        {a.cancel_at_period_end && (
                                            <span className="ml-1 text-xs text-gray-500">
                                                {t(
                                                    'admin.billing.cancelling',
                                                    'cancelling'
                                                )}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                        {formatDate(
                                            a.current_period_end ||
                                                a.trial_ends_at
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {a.override_plan ? (
                                            <span>
                                                {a.override_plan}
                                                {a.override_expires_at &&
                                                    ` (${t('admin.billing.until', 'until')} ${formatDate(a.override_expires_at)})`}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">
                                                -
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                        <button
                                            type="button"
                                            title={t(
                                                'admin.billing.setOverride',
                                                'Set override'
                                            )}
                                            onClick={() => openOverride(a)}
                                            disabled={busyUser === a.user_id}
                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                            data-testid={`admin-billing-override-${a.user_id}`}
                                        >
                                            <GiftIcon className="w-5 h-5 text-blue-500" />
                                        </button>
                                        {a.override_plan && (
                                            <button
                                                type="button"
                                                title={t(
                                                    'admin.billing.clearOverride',
                                                    'Remove override'
                                                )}
                                                onClick={() =>
                                                    removeOverride(a)
                                                }
                                                disabled={
                                                    busyUser === a.user_id
                                                }
                                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                            >
                                                <XMarkIcon className="w-5 h-5 text-red-500" />
                                            </button>
                                        )}
                                        {(a.provider_customer_id ||
                                            a.provider_subscription_id) && (
                                            <button
                                                type="button"
                                                title={t(
                                                    'admin.billing.sync',
                                                    'Sync from the payment provider'
                                                )}
                                                onClick={() => sync(a)}
                                                disabled={
                                                    busyUser === a.user_id
                                                }
                                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                            >
                                                <ArrowPathIcon className="w-5 h-5 text-gray-500" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {editing && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-70"
                    onClick={() => setEditing(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t('admin.billing.overrideFor', {
                                    defaultValue: 'Plan override for {{email}}',
                                    email: editing.email,
                                })}
                            </h3>
                        </div>
                        <div className="px-6 py-4 space-y-3">
                            <label className="block text-sm text-gray-700 dark:text-gray-300">
                                {t('admin.billing.plan', 'Plan')}
                                <select
                                    value={overridePlan}
                                    onChange={(e) =>
                                        setOverridePlan(e.target.value)
                                    }
                                    className="mt-1 w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="pro">pro</option>
                                    <option value="free">free</option>
                                </select>
                            </label>
                            <label className="block text-sm text-gray-700 dark:text-gray-300">
                                {t(
                                    'admin.billing.expires',
                                    'Expires (optional)'
                                )}
                                <input
                                    type="date"
                                    value={overrideExpires}
                                    onChange={(e) =>
                                        setOverrideExpires(e.target.value)
                                    }
                                    className="mt-1 w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                />
                            </label>
                            <label className="block text-sm text-gray-700 dark:text-gray-300">
                                {t('admin.billing.reason', 'Reason (optional)')}
                                <input
                                    type="text"
                                    value={overrideReason}
                                    onChange={(e) =>
                                        setOverrideReason(e.target.value)
                                    }
                                    className="mt-1 w-full rounded border px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                />
                            </label>
                        </div>
                        <div className="px-6 py-4 flex justify-end space-x-2">
                            <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={saveOverride}
                                disabled={busyUser !== null}
                                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                data-testid="admin-billing-override-save"
                            >
                                {t('common.save', 'Save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminBillingPage;
