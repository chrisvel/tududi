import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ExclamationTriangleIcon,
    LockClosedIcon,
    QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

export type ProjectLoadError = 'forbidden' | 'notFound' | 'failed';

// The HTTP status of a failed project load decides what the page says:
// a project you can't open or one that is gone is not an outage.
export const projectLoadErrorFrom = (error: unknown): ProjectLoadError => {
    const status = (error as { status?: number } | null)?.status;
    if (status === 403) return 'forbidden';
    if (status === 404) return 'notFound';
    return 'failed';
};

const ProjectUnavailable: React.FC<{ reason: ProjectLoadError }> = ({
    reason,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const content = {
        forbidden: {
            Icon: LockClosedIcon,
            title: t(
                'projects.unavailable.noAccessTitle',
                "You don't have access to this project"
            ),
            hint: t(
                'projects.unavailable.noAccessHint',
                "Ask the project's owner to share it with you."
            ),
        },
        notFound: {
            Icon: QuestionMarkCircleIcon,
            title: t(
                'projects.unavailable.notFoundTitle',
                "This project doesn't exist or was deleted"
            ),
            hint: t(
                'projects.unavailable.notFoundHint',
                'Check the link, or find the project in your list.'
            ),
        },
        failed: {
            Icon: ExclamationTriangleIcon,
            title: t(
                'projects.unavailable.failedTitle',
                'Failed to load project details.'
            ),
            hint: t(
                'projects.unavailable.failedHint',
                'Check your connection and reload the page.'
            ),
        },
    }[reason];
    const { Icon } = content;

    return (
        <div className="flex justify-center px-4 py-16">
            <div
                role="alert"
                className="w-full max-w-md rounded-2xl bg-white/70 px-6 py-10 text-center dark:bg-gray-900/50"
            >
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <Icon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                </div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {content.title}
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {content.hint}
                </p>
                <button
                    type="button"
                    onClick={() => navigate('/projects')}
                    className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                    {t(
                        'projects.unavailable.backToProjects',
                        'Back to Projects'
                    )}
                </button>
            </div>
        </div>
    );
};

export default ProjectUnavailable;
