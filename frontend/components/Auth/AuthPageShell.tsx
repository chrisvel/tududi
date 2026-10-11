import { useTranslation } from 'react-i18next';
// LTD-PATCH(T-301): Apply Life-to-Day identity and quiet shared presentation; preserve behavior.
import React, { useEffect, useState } from 'react';
import { getAssetPath } from '../../config/paths';

interface AuthPageShellProps {
    title: string;
    children: React.ReactNode;
}

// The logged-out page frame shared by the login, register, and password
// reset screens: logo bar, centred card, illustration on wide screens.
const AuthPageShell: React.FC<AuthPageShellProps> = ({ title, children }) => {
    const { t } = useTranslation();
    const [isDarkMode] = useState<boolean>(() => {
        const storedPreference = localStorage.getItem('isDarkMode');
        return storedPreference !== null
            ? storedPreference === 'true'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    return (
        <>
            <nav className="fixed top-0 start-0 end-0 z-50 text-gray-900 dark:text-white">
                <div className="h-16 flex items-center px-4 sm:px-6 lg:px-8">
                    <img
                        src={getAssetPath(
                            isDarkMode
                                ? 'life-wordmark-light.png'
                                : 'life-wordmark-dark.png'
                        )}
                        alt="Life-to-Day"
                        className="h-14 w-auto"
                    />
                    <span className="ltd-auth-tagline">
                        {t('app.tagline', 'From long-term vision to today.')}
                    </span>
                </div>
            </nav>

            <div className="ltd-auth min-h-screen px-4 pt-16 flex items-center justify-center">
                <div className="w-full max-w-md flex flex-col items-center justify-center">
                    <div className="w-full flex flex-col items-center">
                        <div className="w-full px-4 py-10 sm:px-8">
                            <h2 className="text-center text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-8">
                                {title}
                            </h2>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AuthPageShell;
