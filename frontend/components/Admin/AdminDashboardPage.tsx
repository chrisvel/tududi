import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    UsersIcon,
    CreditCardIcon,
    EnvelopeIcon,
    RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../config/paths';
import { handleAuthResponse } from '../../utils/authUtils';

interface Overview {
    users: { total: number; admins: number; verified: number; last24h: number };
    content: { tasks: number; projects: number; notes: number };
    waitlist: { total: number; last7d: number };
    billing: {
        paying: number;
        hosted: boolean;
        subscription_required: boolean;
        provider: string | null;
    };
    instance: {
        registration_enabled: boolean;
        version: string;
        environment: string;
    };
}

interface WaitlistEntry {
    id: number;
    email: string;
    source: string;
    locale: string | null;
    submission_count: number;
    created_at: string;
}

const Stat: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: string;
}> = ({ label, value, hint }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
            {value}
        </p>
        {hint && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {hint}
            </p>
        )}
    </div>
);

// What an operator wants on opening the admin area: who is here, whether
// the instance is selling anything, and who is waiting for it to open.
const AdminDashboardPage: React.FC = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<Overview | null>(null);
    const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(getApiPath('admin/overview'), {
                    credentials: 'include',
                });
                await handleAuthResponse(res, 'Failed to load the overview.');
                setData(await res.json());

                const wl = await fetch(getApiPath('admin/waitlist?limit=25'), {
                    credentials: 'include',
                });
                if (wl.ok) setWaitlist((await wl.json()).subscribers || []);
            } catch (err: any) {
                setError(err.message || 'Could not load the dashboard');
            }
        };
        load();
    }, []);

    if (error) {
        return (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <p className="text-red-500" data-testid="admin-dashboard-error">
                    {error}
                </p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-gray-500 dark:text-gray-400">
                {t('common.loading', 'Loading...')}
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {t('admin.dashboard.title', 'Admin')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t('admin.dashboard.subtitle', 'tududi {{version}} · {{env}}', {
                    version: data.instance.version,
                    env: data.instance.environment,
                })}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Stat
                    label={t('admin.dashboard.users', 'Users')}
                    value={data.users.total}
                    hint={t(
                        'admin.dashboard.usersHint',
                        '{{verified}} verified · {{admins}} admin · {{new}} today',
                        {
                            verified: data.users.verified,
                            admins: data.users.admins,
                            new: data.users.last24h,
                        }
                    )}
                />
                <Stat
                    label={t('admin.dashboard.paying', 'Paying')}
                    value={data.billing.paying}
                    hint={
                        data.billing.hosted
                            ? `${data.billing.provider || '-'}${data.billing.subscription_required ? ' · gated' : ''}`
                            : t('admin.dashboard.selfHosted', 'self-hosted')
                    }
                />
                <Stat
                    label={t('admin.dashboard.waitlist', 'Waitlist')}
                    value={data.waitlist.total}
                    hint={t('admin.dashboard.waitlistHint', '{{n}} in 7 days', {
                        n: data.waitlist.last7d,
                    })}
                />
                <Stat
                    label={t('admin.dashboard.content', 'Content')}
                    value={data.content.tasks}
                    hint={t(
                        'admin.dashboard.contentHint',
                        '{{projects}} projects · {{notes}} notes',
                        {
                            projects: data.content.projects,
                            notes: data.content.notes,
                        }
                    )}
                />
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
                <Link
                    to="/admin/users"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    <UsersIcon className="w-4 h-4 mr-2" />
                    {t('admin.users.title', 'Users')}
                </Link>
                <Link
                    to="/admin/billing"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    <CreditCardIcon className="w-4 h-4 mr-2" />
                    {t('admin.billing.title', 'Billing')}
                </Link>
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400">
                    <RectangleStackIcon className="w-4 h-4 mr-2" />
                    {data.instance.registration_enabled
                        ? t('admin.dashboard.regOpen', 'Registration open')
                        : t('admin.dashboard.regClosed', 'Registration closed')}
                </span>
            </div>

            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                <EnvelopeIcon className="w-5 h-5 mr-2" />
                {t('admin.dashboard.waitlistLatest', 'Latest waitlist signups')}
            </h2>
            {waitlist.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {t('admin.dashboard.waitlistEmpty', 'Nobody yet.')}
                </p>
            ) : (
                <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full text-sm">
                        <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="text-left px-4 py-2 font-medium">
                                    {t('admin.dashboard.email', 'Email')}
                                </th>
                                <th className="text-left px-4 py-2 font-medium">
                                    {t('admin.dashboard.source', 'Source')}
                                </th>
                                <th className="text-left px-4 py-2 font-medium">
                                    {t('admin.dashboard.joined', 'Joined')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {waitlist.map((w) => (
                                <tr
                                    key={w.id}
                                    className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                                >
                                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200">
                                        {w.email}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                        {w.source}
                                        {w.locale ? ` · ${w.locale}` : ''}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                        {new Date(
                                            w.created_at
                                        ).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminDashboardPage;
