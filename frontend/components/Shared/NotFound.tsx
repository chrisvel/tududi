import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    HomeIcon,
    FolderIcon,
    DocumentTextIcon,
    InboxIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const NotFound: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const quickActions = [
        {
            name: t('navigation.today', 'Today'),
            href: '/today',
            icon: HomeIcon,
            description: t('notFound.todayDescription', "View today's tasks"),
        },
        {
            name: t('navigation.projects', 'Projects'),
            href: '/projects',
            icon: FolderIcon,
            description: t(
                'notFound.projectsDescription',
                'Browse your projects'
            ),
        },
        {
            name: t('navigation.inbox', 'Inbox'),
            href: '/inbox',
            icon: InboxIcon,
            description: t(
                'notFound.inboxDescription',
                'Check your inbox items'
            ),
        },
        {
            name: t('navigation.notes', 'Notes'),
            href: '/notes',
            icon: DocumentTextIcon,
            description: t('notFound.notesDescription', 'Browse your notes'),
        },
    ];

    const handleNavigation = (href: string) => {
        navigate(href);
    };

    const handleGoBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/today');
        }
    };

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
                    {/* Error Icon */}
                    <div className="mb-8">
                        <ExclamationTriangleIcon className="h-24 w-24 text-gray-400 dark:text-gray-500 mx-auto" />
                    </div>

                    {/* Error Message */}
                    <div className="mb-12">
                        <h1 className="text-6xl font-light text-gray-900 dark:text-gray-100 mb-4">
                            404
                        </h1>
                        <h2 className="text-2xl font-medium text-gray-700 dark:text-gray-300 mb-4">
                            {t('notFound.title', 'Page Not Found')}
                        </h2>
                        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                            {t(
                                'notFound.description',
                                "The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong URL."
                            )}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="mb-12 flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleGoBack}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200 font-medium"
                        >
                            {t('notFound.goBack', 'Go Back')}
                        </button>
                        <button
                            onClick={() => handleNavigation('/today')}
                            className="px-6 py-3 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 font-medium"
                        >
                            {t('notFound.goHome', 'Go to Today')}
                        </button>
                    </div>

                    {/* Quick Navigation */}
                    <div className="w-full max-w-4xl">
                        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-6">
                            {t('notFound.quickActions', 'Quick Actions')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {quickActions.map((action) => (
                                <button
                                    key={action.href}
                                    onClick={() =>
                                        handleNavigation(action.href)
                                    }
                                    className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 group"
                                >
                                    <action.icon className="h-8 w-8 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mx-auto mb-3 transition-colors duration-200" />
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                        {action.name}
                                    </h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {action.description}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
