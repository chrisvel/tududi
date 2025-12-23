import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircleIcon,
    XCircleIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../config/paths';
import { useToast } from './Shared/ToastContext';
import SupporterBadge from './Shared/SupporterBadge';
import {
    SupporterLicense,
    SupporterTier,
    TIER_COLORS,
} from '../types/supporter';
import { getCurrentUser } from '../utils/userUtils';

const Plan: React.FC = () => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();

    const [license, setLicense] = useState<SupporterLicense | null>(null);
    const [hasLicense, setHasLicense] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLicense();
    }, []);

    const fetchLicense = async () => {
        try {
            setLoading(true);
            const response = await fetch(getApiPath('profile/supporter'), {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch license');
            }

            const data = await response.json();
            setHasLicense(data.has_license);
            if (data.has_license) {
                setLicense(data);
            }
        } catch (error) {
            console.error('Error fetching license:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTier = (tier: SupporterTier) => {
        // Generate unique reference code
        const currentUser = getCurrentUser();
        const timestamp = Date.now().toString(36).toUpperCase();
        const emailPrefix = currentUser?.email.split('@')[0].substring(0, 8).toUpperCase() || 'USER';
        const tierPrefix = tier.substring(0, 1).toUpperCase();
        const referenceCode = `TUD-${tierPrefix}-${emailPrefix}-${timestamp}`;

        // Append reference code to payment link
        const basePaymentLink = TIER_COLORS[tier].paymentLink;
        const paymentLink = `${basePaymentLink}&note=${encodeURIComponent(referenceCode)}`;

        window.open(paymentLink, '_blank');
    };

    const getDaysRemaining = () => {
        if (!license || !license.expires_at) return null;

        const expiresAt = new Date(license.expires_at);
        const now = new Date();
        const diffTime = expiresAt.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return t('supporter.lifetime', 'Lifetime');
        return new Date(dateString).toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex justify-center px-4 lg:px-2 py-8">
                <div className="w-full max-w-6xl">
                    <div className="flex justify-center py-12">
                        <div className="text-gray-500 dark:text-gray-400">
                            {t('common.loading', 'Loading...')}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2 py-8">
            <div className="w-full max-w-6xl space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('plan.title', 'Plan')}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {t('plan.subtitle', 'Support tududi development')}
                    </p>
                </div>

                {/* Disclaimer */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 p-5 rounded-xl border border-blue-200 dark:border-blue-800/50 shadow-sm">
                    <div className="flex items-start gap-3">
                        <InformationCircleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                            {t(
                                'plan.disclaimer',
                                'The supporter license is completely optional and does not affect app usage or features. You can continue using tududi without any limitations. This plan is designed to support tududi development.'
                            )}
                        </p>
                    </div>
                </div>

                {/* Current License Status */}
                {hasLicense && license && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-850 dark:to-gray-825 p-6 rounded-xl border border-green-200 dark:border-gray-700 shadow-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('supporter.currentLicense', 'Current License')}
                            </h3>
                            <SupporterBadge tier={license.tier} size="large" showLabel />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex justify-between md:justify-start md:gap-8 bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t('supporter.status', 'Status')}
                                </span>
                                <span className="font-medium">
                                    {license.status === 'active' ? (
                                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <CheckCircleIcon className="w-4 h-4" />
                                            {t('supporter.statusActive', 'Active')}
                                        </span>
                                    ) : license.status === 'grace' ? (
                                        <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                                            <CheckCircleIcon className="w-4 h-4" />
                                            {t('supporter.statusGrace', 'Grace Period')}
                                        </span>
                                    ) : (
                                        <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                            <XCircleIcon className="w-4 h-4" />
                                            {t('supporter.statusExpired', 'Expired')}
                                        </span>
                                    )}
                                </span>
                            </div>

                            <div className="flex justify-between md:justify-start md:gap-8 bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t('supporter.activatedOn', 'Activated On')}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {formatDate(license.activated_at)}
                                </span>
                            </div>

                            <div className="flex justify-between md:justify-start md:gap-8 bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t('supporter.expiresOn', 'Expires On')}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {formatDate(license.expires_at)}
                                </span>
                            </div>

                            {getDaysRemaining() !== null && (
                                <div className="flex justify-between md:justify-start md:gap-8 bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                        {t('supporter.daysRemaining', 'Days Remaining')}
                                    </span>
                                    <span
                                        className={`font-bold ${
                                            getDaysRemaining()! > 30
                                                ? 'text-green-600 dark:text-green-400'
                                                : getDaysRemaining()! > 7
                                                  ? 'text-yellow-600 dark:text-yellow-400'
                                                  : 'text-red-600 dark:text-red-400'
                                        }`}
                                    >
                                        {getDaysRemaining()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tier Information */}
                <div>
                    <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {t('supporter.becomeSupporterTitle', 'Become a Supporter')}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                            {t(
                                'supporter.becomeSupporterDescription',
                                'Choose a tier to support tududi development. Click on a tier to proceed with payment via Revolut.'
                            )}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {(['bronze', 'silver', 'gold'] as SupporterTier[]).map((tier) => {
                            const config = TIER_COLORS[tier];
                            const isCurrentTier = license?.tier === tier;

                            return (
                                <button
                                    key={tier}
                                    onClick={() => !isCurrentTier && handleSelectTier(tier)}
                                    disabled={isCurrentTier}
                                    className={`group relative p-6 rounded-xl border-2 text-left transition-all h-full flex flex-col bg-white dark:bg-gray-850 shadow-md ${
                                        isCurrentTier
                                            ? 'opacity-75 cursor-not-allowed ring-2 ring-green-500 dark:ring-green-400'
                                            : 'hover:shadow-xl hover:-translate-y-1 cursor-pointer'
                                    }`}
                                    style={{
                                        borderColor:
                                            tier === 'bronze'
                                                ? '#ea580c'
                                                : tier === 'silver'
                                                  ? '#9ca3af'
                                                  : '#eab308',
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <SupporterBadge tier={tier} size="large" showLabel />
                                        {isCurrentTier && (
                                            <div className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                                                <CheckCircleIcon className="h-4 w-4" />
                                                {t('supporter.currentTier', 'Active')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-4">
                                        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                                            €{config.price}
                                        </div>
                                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            {t('supporter.perYear', 'per year')}
                                        </div>
                                    </div>

                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                        {config.description}
                                    </p>

                                    <ul className="space-y-3 flex-1">
                                        {config.features.map((feature, index) => (
                                            <li
                                                key={index}
                                                className="flex items-start text-sm text-gray-700 dark:text-gray-300"
                                            >
                                                <CheckCircleIcon className="h-5 w-5 mr-2 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {!isCurrentTier && (
                                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <div className="text-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                                {t('supporter.selectTier', 'Select this tier')} →
                                            </div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="text-center bg-gray-50 dark:bg-gray-850 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t(
                                'supporter.paymentInfo',
                                'Secure payment processing via Revolut. Your support helps maintain and improve tududi.'
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Plan;
