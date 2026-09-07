import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchBillingStatus } from '../../utils/billingService';

// On an instance that sells access, an account with no subscription is sent
// to the subscription page before it can reach the app. The server enforces
// this on every request; this only keeps the browser from rendering an app
// whose every call would answer 402.
//
// While the answer is unknown the children render, so a self-hosted install
// (where the endpoint 404s) never waits on anything.
const SubscriptionGate: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const location = useLocation();
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchBillingStatus()
            .then((status) => {
                if (cancelled) return;
                setLocked(!!status.subscription_required && !status.active);
            })
            .catch(() => {
                // 404 on self-hosted, or a transient failure: the server is
                // still the authority, so leave the app rendered.
            });
        return () => {
            cancelled = true;
        };
    }, [location.pathname === '/profile']);

    if (locked && location.pathname !== '/profile') {
        return <Navigate to="/subscription/new" replace />;
    }
    return <>{children}</>;
};

export default SubscriptionGate;
