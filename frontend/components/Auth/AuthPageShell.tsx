import React, { useEffect, useState } from 'react';
import { getAssetPath } from '../../config/paths';

interface AuthPageShellProps {
    title: string;
    children: React.ReactNode;
}

// The logged-out page frame shared by the login, register, and password
// reset screens: logo bar, centred card, illustration on wide screens.
const AuthPageShell: React.FC<AuthPageShellProps> = ({ title, children }) => {
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
                <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
                    <div className="w-full lg:w-auto flex flex-col items-center">
                        <div className="p-10 rounded-lg w-full max-w-2xl">
                            <h2 className="text-center text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-12">
                                {title}
                            </h2>
                            {children}
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center justify-center">
                        <img
                            src={getAssetPath('login-gfx.png')}
                            alt=""
                            className="max-w-md w-full h-auto"
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default AuthPageShell;
