import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

// Shown in place of the admin panel to a hosted superadmin who has not
// turned on two-factor sign-in yet.
const AdminMfaRequired: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="max-w-xl p-6 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                    <DevicePhoneMobileIcon className="w-5 h-5 mr-2 text-amber-600" />
                    {t(
                        'mfa.adminRequiredTitle',
                        'Turn on two-factor sign-in first'
                    )}
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                    {t(
                        'mfa.adminRequiredBody',
                        'This account can see every customer, so the admin panel opens only once two-factor sign-in is on.'
                    )}
                </p>
                <Link
                    to="/profile?section=security"
                    className="inline-block px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
                >
                    {t('mfa.adminRequiredAction', 'Set it up')}
                </Link>
            </div>
        </div>
    );
};

export default AdminMfaRequired;
