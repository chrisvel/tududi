import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchBillingStatus } from '../../utils/billingService';

// On an instance that sells access, an account with no subscription is sent
// to the subscription page before it can reach the app. The server enforces
// this on every request; this only keeps the browser from rendering an app
// whose every call would answer 402.
//
// Nothing renders until the first answer arrives: rendering the app first
// made a new account see it flash before the subscription page replaced it.
// A self-hosted install answers 404 straight away, so it waits on nothing
// more than that one request.
const SubscriptionGate: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { t } = useTranslation();
    const location = useLocation();
    const [locked, setLocked] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchBillingStatus()
            .then((status) => {
                if (cancelled) return;
                setLocked(
                    !!status.subscription_required &&
                        !status.active &&
                        !status.read_only
                );
            })
            .catch(() => {
                // 404 on self-hosted, or a transient failure: the server is
                // still the authority, so leave the app rendered.
            })
            .finally(() => {
                if (!cancelled) setChecked(true);
            });
        return () => {
            cancelled = true;
        };
    }, [location.pathname === '/profile']);

    if (!checked) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('common.loading', 'Loading application... Please wait.')}
                </div>
            </div>
        );
    }
    if (locked && location.pathname !== '/profile') {
        return <Navigate to="/subscription/new" replace />;
    }
    return <>{children}</>;
};

export default SubscriptionGate;
