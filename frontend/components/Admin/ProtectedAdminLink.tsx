import React from 'react';
import { Link } from 'react-router-dom';
import { CogIcon } from '@heroicons/react/24/outline';
import { useAdminStore } from '../../stores/adminStore';

const ProtectedAdminLink: React.FC = () => {
    const { isAdminMode } = useAdminStore();

    if (!isAdminMode) {
        return null;
    }

    return (
        <Link
            to="/admin"
            className="flex items-center justify-center focus:outline-none text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-2 py-1 transition-colors duration-200"
            aria-label="Admin"
            title="Rules Engine Admin (Ctrl+Shift+R)"
        >
            <CogIcon className="h-5 w-5" />
        </Link>
    );
};

export default ProtectedAdminLink;
