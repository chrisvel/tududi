import React from 'react';
import { useTranslation } from 'react-i18next';
import DailyAssistant from '../AI/DailyAssistant';
import TrialLockNotice from '../Billing/TrialLockNotice';
import { isTrialLocked, useBillingState } from '../../hooks/useTrialStatus';

const DailyBriefPage: React.FC = () => {
    const { t } = useTranslation();
    // The brief generates itself on open, which the trial would refuse, so
    // wait to know before mounting it.
    const { status, settled } = useBillingState();
    const aiLocked = isTrialLocked(status, 'ai');

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
            <div className="w-full">
                <div className="flex items-center gap-3 mb-8">
                    <h2 className="text-2xl font-light">
                        {t('aiAssistant.title', 'Daily Brief')}
                    </h2>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400">
                        {t('common.beta', 'beta')}
                    </span>
                </div>
                {aiLocked ? (
                    <TrialLockNotice feature="ai" />
                ) : (
                    settled && <DailyAssistant />
                )}
            </div>
        </div>
    );
};

export default DailyBriefPage;
