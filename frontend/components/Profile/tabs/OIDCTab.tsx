import React from 'react';
import { useTranslation } from 'react-i18next';
import { LinkIcon } from '@heroicons/react/24/outline';
import ConnectedAccounts from './ConnectedAccounts';

interface OIDCTabProps {
    isActive: boolean;
    hasPassword: boolean;
}

const OIDCTab: React.FC<OIDCTabProps> = ({ isActive, hasPassword }) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <LinkIcon className="w-6 h-6 mr-3 text-green-500" />
                {t('profile.tabs.oidc', 'OIDC/SSO')}
            </h3>

            <ConnectedAccounts hasPassword={hasPassword} />
        </div>
    );
};

export default OIDCTab;
