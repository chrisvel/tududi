import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAssetPath } from '../../config/paths';

const OIDCCallback: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const [isDarkMode] = React.useState<boolean>(() => {
        const storedPreference = localStorage.getItem('isDarkMode');
        return storedPreference !== null
            ? storedPreference === 'true'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    useEffect(() => {
        const error = searchParams.get('error');
        if (error) {
            setTimeout(() => {
                navigate(`/login?error=${encodeURIComponent(error)}`);
            }, 2000);
        }
    }, [searchParams, navigate]);

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-50 text-gray-900 dark:text-white">
                <div className="h-16 flex items-center px-4 sm:px-6 lg:px-8">
                    <img
                        src={getAssetPath(
                            isDarkMode
                                ? 'wide-logo-light.png'
                                : 'wide-logo-dark.png'
                        )}
                        alt="tududi"
                        className="h-9 w-auto"
                    />
                </div>
            </nav>

            <div className="bg-gray-100 dark:bg-gray-900 min-h-screen px-4 pt-16 flex items-center justify-center">
                <div className="w-full max-w-md text-center">
                    <div className="p-10 rounded-lg">
                        <div className="flex justify-center mb-6">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
                            {t(
                                'auth.oidc.completing_signin',
                                'Completing sign-in...'
                            )}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            {t(
                                'auth.oidc.authenticating_with_provider',
                                'Authenticating with provider. Please wait...'
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default OIDCCallback;
