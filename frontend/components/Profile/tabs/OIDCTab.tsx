import React from 'react';
import { useTranslation } from 'react-i18next';
import { LinkIcon } from '@heroicons/react/24/outline';
import ConnectedAccounts from './ConnectedAccounts';
import OidcProviderConfig from './OidcProviderConfig';

interface OIDCTabProps {
    isActive: boolean;
    hasPassword: boolean;
    isAdmin: boolean;
}

const OIDCTab: React.FC<OIDCTabProps> = ({
    isActive,
    hasPassword,
    isAdmin,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <LinkIcon className="w-6 h-6 mr-3 text-green-500" />
                {t('profile.tabs.oidc', 'OIDC/SSO')}
            </h3>

            {isAdmin && <OidcProviderConfig />}

            <ConnectedAccounts hasPassword={hasPassword} />
        </div>
    );
};

export default OIDCTab;
