import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiPath } from '../config/paths';

// One click from the marketing site into the sandbox. There is no password
// to publish and no form to fill in: this asks the server for a session on
// the shared demo account and drops the visitor straight into Today.
const DemoEntry: React.FC = () => {
    const { t } = useTranslation();
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const open = async () => {
            try {
                const res = await fetch(getApiPath('demo/login'), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) throw new Error(String(res.status));
                // A full load rather than a route change, so every store
                // starts from the demo session rather than an empty one.
                window.location.href = '/today';
            } catch {
                setFailed(true);
            }
        };
        open();
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                {failed ? (
                    <>
                        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                            {t(
                                'demo.unavailableTitle',
                                'The demo is not available'
                            )}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            {t(
                                'demo.unavailableBody',
                                'It may be rebuilding itself. Try again in a moment.'
                            )}
                        </p>
                        <a
                            href="/login"
                            className="text-blue-500 hover:text-blue-600"
                        >
                            {t('auth.back_to_login', 'Back to Login')}
                        </a>
                    </>
                ) : (
                    <p
                        className="text-gray-600 dark:text-gray-400"
                        data-testid="demo-opening"
                    >
                        {t('demo.opening', 'Opening the demo...')}
                    </p>
                )}
            </div>
        </div>
    );
};

export default DemoEntry;
