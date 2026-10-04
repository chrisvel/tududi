import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    UsersIcon,
    CreditCardIcon,
    EnvelopeIcon,
    RectangleStackIcon,
    SparklesIcon,
    BugAntIcon,
    NewspaperIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../config/paths';
import { handleAuthResponse } from '../../utils/authUtils';
import AdminBlogSettings from './AdminBlogSettings';

interface Overview {
    users: { total: number; admins: number; verified: number; last24h: number };
    content: { tasks: number; projects: number; notes: number };
    waitlist: { total: number; last7d: number };
    feedback: { open: number };
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
    const [error, setError] = useState<string | null>(null);
    const [blogOpen, setBlogOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(getApiPath('admin/overview'), {
                    credentials: 'include',
                });
                await handleAuthResponse(res, 'Failed to load the overview.');
                setData(await res.json());
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
                {data.billing.hosted && (
                    <>
                        <Link
                            to="/admin/billing"
                            className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            <CreditCardIcon className="w-4 h-4 mr-2" />
                            {t('admin.billing.title', 'Billing')}
                        </Link>
                        <Link
                            to="/admin/ai-usage"
                            className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            <SparklesIcon className="w-4 h-4 mr-2" />
                            {t('admin.aiUsage.title', 'AI Usage')}
                        </Link>
                    </>
                )}
                <Link
                    to="/admin/waitlist"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    <EnvelopeIcon className="w-4 h-4 mr-2" />
                    {t('admin.waitlist.title', 'Waitlist')}
                </Link>
                <Link
                    to="/admin/feedback"
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    data-testid="admin-dashboard-feedback-link"
                >
                    <BugAntIcon className="w-4 h-4 mr-2" />
                    {t('admin.feedback.title', 'Feedback')}
                    {data.feedback?.open > 0 && (
                        <span className="ml-2 px-1.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 text-xs">
                            {data.feedback.open}
                        </span>
                    )}
                </Link>
                <button
                    type="button"
                    onClick={() => setBlogOpen(true)}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    data-testid="admin-dashboard-blog-button"
                >
                    <NewspaperIcon className="w-4 h-4 mr-2" />
                    {t('admin.blog.title', 'Blog')}
                </button>
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400">
                    <RectangleStackIcon className="w-4 h-4 mr-2" />
                    {data.instance.registration_enabled
                        ? t('admin.dashboard.regOpen', 'Registration open')
                        : t('admin.dashboard.regClosed', 'Registration closed')}
                </span>
            </div>

            {blogOpen && (
                <AdminBlogSettings onClose={() => setBlogOpen(false)} />
            )}
        </div>
    );
};

export default AdminDashboardPage;
