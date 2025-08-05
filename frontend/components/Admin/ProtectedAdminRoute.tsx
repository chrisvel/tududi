import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminStore } from '../../stores/adminStore';

interface ProtectedAdminRouteProps {
    children: React.ReactNode;
}

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({
    children,
}) => {
    const { isAdminMode } = useAdminStore();

    if (!isAdminMode) {
        // Redirect to home if admin mode is not enabled
        return <Navigate to="/today" replace />;
    }

    return <>{children}</>;
};

export default ProtectedAdminRoute;
