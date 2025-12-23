import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    StarIcon,
    CheckCircleIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../../config/paths';
import { useToast } from '../../Shared/ToastContext';
import SupporterBadge from '../../Shared/SupporterBadge';
import {
    SupporterLicense,
    SupporterTier,
    TIER_COLORS,
} from '../../../types/supporter';

interface SupporterTabProps {
    isActive: boolean;
}

const SupporterTab: React.FC<SupporterTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const [license, setLicense] = useState<SupporterLicense | null>(null);
    const [hasLicense, setHasLicense] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [licenseKey, setLicenseKey] = useState('');

    // License request states
    const [selectedTier, setSelectedTier] = useState<SupporterTier | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentProof, setPaymentProof] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [licenseRequest, setLicenseRequest] = useState<any>(null);

    useEffect(() => {
        if (isActive) {
            fetchLicense();
            fetchLicenseRequestStatus();
        }
    }, [isActive]);

    const fetchLicenseRequestStatus = async () => {
        try {
            const response = await fetch(
                getApiPath('profile/supporter/request-status'),
                {
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                return;
            }

            const data = await response.json();
            if (data.has_request) {
                setLicenseRequest(data);
            }
        } catch (error) {
            console.error('Error fetching license request status:', error);
        }
    };

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

    const handleActivate = async () => {
        if (!licenseKey.trim()) {
            showErrorToast(t('supporter.keyRequired', 'Please enter a license key'));
            return;
        }

        try {
            setActivating(true);
            const response = await fetch(
                getApiPath('profile/supporter/activate'),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ license_key: licenseKey.trim() }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Activation failed');
            }

            showSuccessToast(
                data.message ||
                    t('supporter.activated', 'License activated successfully!')
            );
            setLicenseKey('');
            await fetchLicense();

            // Dispatch event to update navbar badge
            window.dispatchEvent(
                new CustomEvent('supporterStatusChanged', {
                    detail: { tier: data.tier },
                })
            );

            // Reload page to update avatar badge
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error: any) {
            showErrorToast(error.message || t('supporter.activationFailed', 'Activation failed'));
        } finally {
            setActivating(false);
        }
    };

    const handleSelectTier = (tier: SupporterTier) => {
        setSelectedTier(tier);
        setShowPaymentModal(true);
        setPaymentProof('');
    };

    const handleSubmitPaymentRequest = async () => {
        if (!selectedTier || !paymentProof.trim()) {
            showErrorToast(
                t(
                    'supporter.paymentProofRequired',
                    'Please provide payment confirmation details'
                )
            );
            return;
        }

        try {
            setSubmitting(true);

            const response = await fetch(
                getApiPath('profile/supporter/request'),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        tier: selectedTier,
                        payment_proof: paymentProof.trim(),
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to submit request');
            }

            const data = await response.json();

            showSuccessToast(
                t(
                    'supporter.requestSubmitted',
                    'Your license request has been submitted and is pending review.'
                )
            );

            setLicenseRequest(data.request);
            setShowPaymentModal(false);
            setSelectedTier(null);
            setPaymentProof('');
        } catch (error: any) {
            showErrorToast(
                error.message ||
                    t('supporter.requestFailed', 'Failed to submit request')
            );
        } finally {
            setSubmitting(false);
        }
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

    if (!isActive) return null;

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <div className="text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <StarIcon className="w-6 h-6 mr-3 text-yellow-500" />
                {t('supporter.title', 'Supporter Status')}
            </h3>

            {/* Current License Status */}
            {hasLicense && license ? (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            {t('supporter.currentLicense', 'Current License')}
                        </h4>
                        <SupporterBadge tier={license.tier} size="large" showLabel />
                    </div>

                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                                {t('supporter.status', 'Status')}:
                            </span>
                            <span className="font-medium">
                                {license.status === 'active' ? (
                                    <span className="text-green-600 dark:text-green-400 flex items-center">
                                        <CheckCircleIcon className="w-4 h-4 mr-1" />
                                        {t('supporter.statusActive', 'Active')}
                                    </span>
                                ) : license.status === 'grace' ? (
                                    <span className="text-yellow-600 dark:text-yellow-400 flex items-center">
                                        <CheckCircleIcon className="w-4 h-4 mr-1" />
                                        {t('supporter.statusGrace', 'Grace Period')}
                                    </span>
                                ) : (
                                    <span className="text-red-600 dark:text-red-400 flex items-center">
                                        <XCircleIcon className="w-4 h-4 mr-1" />
                                        {t('supporter.statusExpired', 'Expired')}
                                    </span>
                                )}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                                {t('supporter.activatedOn', 'Activated On')}:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {formatDate(license.activated_at)}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                                {t('supporter.expiresOn', 'Expires On')}:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {formatDate(license.expires_at)}
                            </span>
                        </div>

                        {getDaysRemaining() !== null && (
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">
                                    {t('supporter.daysRemaining', 'Days Remaining')}:
                                </span>
                                <span
                                    className={`font-medium ${
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
            ) : (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-blue-800 dark:text-blue-200">
                        {t(
                            'supporter.noLicense',
                            'You do not currently have an active supporter license. Activate a license key below to show your support!'
                        )}
                    </p>
                </div>
            )}

            {/* Activation Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {t('supporter.activateTitle', 'Activate License Key')}
                </h4>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('supporter.licenseKey', 'License Key')}
                        </label>
                        <input
                            type="text"
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={activating}
                        />
                    </div>

                    <button
                        onClick={handleActivate}
                        disabled={activating || !licenseKey.trim()}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {activating
                            ? t('common.saving', 'Saving...')
                            : t('supporter.activate', 'Activate License')}
                    </button>
                </div>
            </div>

            {/* Tier Information */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    {t('supporter.becomeSupporterTitle', 'Become a Supporter')}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    {t(
                        'supporter.becomeSupporterDescription',
                        'Choose a tier to support tududi development. Click on a tier to proceed with payment via Revolut.'
                    )}
                </p>

                {licenseRequest && licenseRequest.status === 'pending' && (
                    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            {t(
                                'supporter.pendingRequest',
                                'You have a pending license request. Please wait for admin approval.'
                            )}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(['bronze', 'silver', 'gold'] as SupporterTier[]).map((tier) => {
                        const config = TIER_COLORS[tier];
                        const isCurrentTier = license?.tier === tier;
                        const hasPendingRequest =
                            licenseRequest && licenseRequest.status === 'pending';

                        return (
                            <button
                                key={tier}
                                onClick={() => !isCurrentTier && !hasPendingRequest && handleSelectTier(tier)}
                                disabled={isCurrentTier || hasPendingRequest}
                                className={`p-6 rounded-lg border-2 text-left transition-all ${
                                    isCurrentTier || hasPendingRequest
                                        ? 'opacity-75 cursor-not-allowed'
                                        : 'hover:shadow-lg hover:scale-105 cursor-pointer'
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
                                        <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    )}
                                </div>

                                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                    €{config.price}
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                        /year
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    {config.description}
                                </p>

                                <ul className="space-y-2">
                                    {config.features.map((feature, index) => (
                                        <li
                                            key={index}
                                            className="flex items-start text-sm text-gray-700 dark:text-gray-300"
                                        >
                                            <CheckCircleIcon className="h-4 w-4 mr-2 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {isCurrentTier && (
                                    <div className="mt-4 text-sm text-green-600 dark:text-green-400 font-medium">
                                        {t('supporter.currentTier', 'Current Tier')}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    <p>
                        {t(
                            'supporter.paymentInfo',
                            'Secure payment processing via Revolut. Your support helps maintain and improve tududi.'
                        )}
                    </p>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedTier && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            {t('supporter.paymentTitle', 'Complete Your Payment')}
                        </h3>

                        <div className="mb-6">
                            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                                <div>
                                    <SupporterBadge
                                        tier={selectedTier}
                                        size="large"
                                        showLabel
                                    />
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                        {TIER_COLORS[selectedTier].description}
                                    </p>
                                </div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                    €{TIER_COLORS[selectedTier].price}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                                        {t('supporter.paymentInstructions', 'Payment Instructions')}:
                                    </h4>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                        <li>
                                            {t(
                                                'supporter.instruction1',
                                                'Click the Revolut payment button below'
                                            )}
                                        </li>
                                        <li>
                                            {t(
                                                'supporter.instruction2',
                                                'Complete the payment on Revolut'
                                            )}
                                        </li>
                                        <li>
                                            {t(
                                                'supporter.instruction3',
                                                'Return here and provide payment confirmation (transaction ID or screenshot)'
                                            )}
                                        </li>
                                        <li>
                                            {t(
                                                'supporter.instruction4',
                                                'Your request will be reviewed and approved by an admin'
                                            )}
                                        </li>
                                    </ol>
                                </div>

                                <a
                                    href={TIER_COLORS[selectedTier].paymentLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full text-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                                >
                                    {t('supporter.payWithRevolut', 'Pay €{price} with Revolut', {
                                        price: TIER_COLORS[selectedTier].price,
                                    })}
                                </a>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t(
                                            'supporter.paymentProof',
                                            'Payment Confirmation'
                                        )}
                                        :
                                    </label>
                                    <textarea
                                        value={paymentProof}
                                        onChange={(e) => setPaymentProof(e.target.value)}
                                        placeholder={t(
                                            'supporter.paymentProofPlaceholder',
                                            'Enter transaction ID or describe your payment...'
                                        )}
                                        rows={3}
                                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowPaymentModal(false);
                                            setSelectedTier(null);
                                            setPaymentProof('');
                                        }}
                                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                                        disabled={submitting}
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                    <button
                                        onClick={handleSubmitPaymentRequest}
                                        disabled={submitting || !paymentProof.trim()}
                                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting
                                            ? t('common.submitting', 'Submitting...')
                                            : t('supporter.submitRequest', 'Submit Request')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupporterTab;
