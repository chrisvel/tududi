import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import {
    fetchAdminAiUsage,
    AdminAiUsageUser,
} from '../../utils/adminAiUsageService';

const AdminAiUsagePage: React.FC = () => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const [users, setUsers] = useState<AdminAiUsageUser[]>([]);
    const [totalCredits, setTotalCredits] = useState(0);
    const [total, setTotal] = useState(0);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(
        async (q = query) => {
            setLoading(true);
            try {
                const data = await fetchAdminAiUsage(q);
                setUsers(data.users);
                setTotalCredits(data.summary.total_credits_used_this_month);
                setTotal(data.total);
            } catch (err: any) {
                showErrorToast(err.message || 'Failed to load AI usage');
            } finally {
                setLoading(false);
            }
        },
        [query, showErrorToast]
    );

    useEffect(() => {
        load('');
    }, [load]);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <SparklesIcon className="w-7 h-7 mr-3 text-blue-500" />
                {t('admin.aiUsage.title', 'AI Usage')}
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    [t('admin.aiUsage.users', 'Users'), total],
                    [
                        t(
                            'admin.aiUsage.totalCredits',
                            'Credits used this month (all users)'
                        ),
                        totalCredits,
                    ],
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
                        'admin.aiUsage.searchPlaceholder',
                        'Search by email'
                    )}
                    className="flex-1 max-w-md px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    data-testid="admin-ai-usage-search"
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
                                {t('admin.aiUsage.user', 'User')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.aiUsage.plan', 'Plan')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.aiUsage.used', 'Used')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.aiUsage.limit', 'Limit')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.aiUsage.remaining', 'Remaining')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={5}
                                >
                                    {t('common.loading', 'Loading...')}
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={5}
                                >
                                    {t('admin.aiUsage.empty', 'No users yet')}
                                </td>
                            </tr>
                        ) : (
                            users.map((u) => (
                                <tr
                                    key={u.id}
                                    className="text-gray-900 dark:text-gray-100"
                                >
                                    <td className="px-4 py-2">
                                        <div>{u.email}</div>
                                        {u.name && (
                                            <div className="text-xs text-gray-500">
                                                {u.name}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 capitalize">
                                        {u.plan}
                                    </td>
                                    <td className="px-4 py-2">
                                        {u.ai_credits_used_this_month}
                                    </td>
                                    <td className="px-4 py-2">
                                        {u.ai_credits_limit === null
                                            ? t(
                                                  'billing.unlimited',
                                                  'unlimited'
                                              )
                                            : u.ai_credits_limit}
                                    </td>
                                    <td className="px-4 py-2">
                                        {u.ai_credits_remaining === null
                                            ? t(
                                                  'billing.unlimited',
                                                  'unlimited'
                                              )
                                            : u.ai_credits_remaining}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminAiUsagePage;
