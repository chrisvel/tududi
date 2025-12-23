import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StarIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getApiPath } from '../../config/paths';
import { useToast } from '../Shared/ToastContext';
import SupporterBadge from '../Shared/SupporterBadge';
import ConfirmDialog from '../Shared/ConfirmDialog';
import {
    Supporter,
    SupporterAnalytics,
} from '../../types/supporter';

const AdminSupportersPage: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const navigate = useNavigate();

    const [supporters, setSupporters] = useState<Supporter[]>([]);
    const [analytics, setAnalytics] = useState<SupporterAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [supporterToRevoke, setSupporterToRevoke] =
        useState<Supporter | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([loadSupporters(), loadAnalytics()]);
        } catch (err: any) {
            setError(
                err.message ||
                    t('admin.supporters.loadError', 'Failed to load supporters')
            );
        } finally {
            setLoading(false);
        }
    };

    const loadSupporters = async () => {
        const response = await fetch(getApiPath('admin/supporters'), {
            credentials: 'include',
        });

        if (response.status === 403) {
            navigate('/today');
            throw new Error('Forbidden');
        }

        if (!response.ok) {
            throw new Error('Failed to load supporters');
        }

        const data = await response.json();
        setSupporters(data.supporters);
    };

    const loadAnalytics = async () => {
        const response = await fetch(
            getApiPath('admin/supporters/analytics'),
            {
                credentials: 'include',
            }
        );

        if (!response.ok) {
            throw new Error('Failed to load analytics');
        }

        const data = await response.json();
        setAnalytics(data);
    };

    const handleRevoke = async () => {
        if (!supporterToRevoke) return;

        try {
            const response = await fetch(
                getApiPath(`admin/supporters/${supporterToRevoke.id}`),
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                throw new Error('Failed to revoke license');
            }

            showSuccessToast(
                t(
                    'admin.supporters.revokeSuccess',
                    'License revoked successfully'
                )
            );
            setSupporterToRevoke(null);
            await loadData();
        } catch (error: any) {
            showErrorToast(
                error.message ||
                    t('admin.supporters.revokeError', 'Failed to revoke license')
            );
            setSupporterToRevoke(null);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return t('admin.supporters.lifetime', 'Lifetime');
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'text-green-600 dark:text-green-400';
            case 'grace':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'expired':
                return 'text-red-600 dark:text-red-400';
            case 'revoked':
                return 'text-gray-600 dark:text-gray-400';
            default:
                return 'text-gray-600 dark:text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center px-4 lg:px-2">
                <div className="w-full max-w-7xl">
                    <div className="flex justify-center py-8">
                        <div className="text-gray-500 dark:text-gray-400">
                            {t('common.loading', 'Loading...')}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center px-4 lg:px-2">
                <div className="w-full max-w-7xl">
                    <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                        {error}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-7xl space-y-6">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-light flex items-center">
                        <StarIcon className="w-6 h-6 mr-2 text-yellow-500" />
                        {t('admin.supporters.title', 'Supporter Management')}
                    </h2>
                </div>

                {/* Analytics Cards */}
                {analytics && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {t('admin.supporters.total', 'Total Supporters')}
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {analytics.total_supporters}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {t('admin.supporters.active', 'Active Licenses')}
                            </div>
                            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                                {analytics.active_supporters}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {t('admin.supporters.revenue', 'Total Revenue')}
                            </div>
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                                ${analytics.total_revenue.toFixed(2)}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {t('admin.supporters.tierBreakdown', 'By Tier')}
                            </div>
                            <div className="mt-2 space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-orange-600">Bronze:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {analytics.by_tier.bronze}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Silver:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {analytics.by_tier.silver}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-yellow-600">Gold:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {analytics.by_tier.gold}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Supporters Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.supporters.user', 'User')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.supporters.tier', 'Tier')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.supporters.activated', 'Activated')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.supporters.expires', 'Expires')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.supporters.status', 'Status')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.supporters.amount', 'Amount')}
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('admin.supporters.actions', 'Actions')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {supporters.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        {t(
                                            'admin.supporters.noSupporters',
                                            'No supporters yet'
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                supporters.map((supporter) => (
                                    <tr
                                        key={supporter.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {supporter.email}
                                            </div>
                                            {supporter.name && (
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {supporter.name}{' '}
                                                    {supporter.surname || ''}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <SupporterBadge
                                                tier={supporter.tier}
                                                size="small"
                                                showLabel
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(supporter.activated_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(supporter.expires_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`text-sm font-medium capitalize ${getStatusColor(supporter.status)}`}
                                            >
                                                {t(
                                                    `admin.supporters.status.${supporter.status}`,
                                                    supporter.status
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {supporter.purchase_amount
                                                ? `$${supporter.purchase_amount.toFixed(2)}`
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() =>
                                                    setSupporterToRevoke(supporter)
                                                }
                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                title={t(
                                                    'admin.supporters.revoke',
                                                    'Revoke License'
                                                )}
                                                disabled={
                                                    supporter.status === 'revoked'
                                                }
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {supporterToRevoke && (
                    <ConfirmDialog
                        title={t(
                            'admin.supporters.revokeTitle',
                            'Revoke Supporter License'
                        )}
                        message={t(
                            'admin.supporters.revokeConfirm',
                            'Are you sure you want to revoke the supporter license for {{email}}? This action cannot be undone.',
                            { email: supporterToRevoke.email }
                        )}
                        onConfirm={handleRevoke}
                        onCancel={() => setSupporterToRevoke(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminSupportersPage;
