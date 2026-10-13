import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { TrialLockedFeature, useTrialLock } from '../../hooks/useTrialStatus';

interface TrialLockNoticeProps {
    feature: TrialLockedFeature;
    className?: string;
}

// Shown in place of something the free trial leaves out, so the visitor
// learns it before clicking rather than from a refused request. Renders
// nothing outside the trial.
const TrialLockNotice: React.FC<TrialLockNoticeProps> = ({
    feature,
    className = '',
}) => {
    const { t } = useTranslation();
    const locked = useTrialLock(feature);
    if (!locked) return null;

    const message =
        feature === 'ai'
            ? t(
                  'subscription.trialLock.ai',
                  'The AI assistant is not part of the free trial. Subscribe to turn it on.'
              )
            : feature === 'public_notes'
              ? t(
                    'subscription.trialLock.publicNotes',
                    'Public note links are not part of the free trial. Subscribe to share notes with anyone.'
                )
              : t(
                    'subscription.trialLock.members',
                    'Adding members is not part of the free trial. Subscribe to add family members or teammates.'
                );

    return (
        <div
            className={`flex items-start gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-100 ${className}`}
            data-testid={`trial-lock-${feature}`}
        >
            <LockClosedIcon className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-300" />
            <p className="flex-1">{message}</p>
            <Link
                to={`/subscription/new?feature=${feature}`}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
            >
                {t('subscription.subscribe', 'Subscribe')}
            </Link>
        </div>
    );
};

export default TrialLockNotice;
