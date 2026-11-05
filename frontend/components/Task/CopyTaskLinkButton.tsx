import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, LinkIcon } from '@heroicons/react/24/outline';
import { getBasePath } from '../../config/paths';

interface CopyTaskLinkButtonProps {
    // App path of the task page, e.g. /task/<uid> or /habit/<uid>
    path: string;
    className?: string;
    iconClassName?: string;
}

const CopyTaskLinkButton: React.FC<CopyTaskLinkButtonProps> = ({
    path,
    className = '',
    iconClassName = 'h-4 w-4',
}) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const link = `${window.location.origin}${getBasePath()}${path}`;

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard blocked: the icon is still a plain link to copy by hand
        }
    };

    return (
        <a
            href={link}
            onClick={handleClick}
            onKeyDown={(e) => e.stopPropagation()}
            className={`flex-shrink-0 p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-600 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors ${className}`}
            title={
                copied
                    ? t('task.linkCopied', 'Link copied')
                    : t('task.copyLink', 'Copy link to task')
            }
            aria-label={t('task.copyLink', 'Copy link to task')}
            data-testid="task-copy-link"
        >
            {copied ? (
                <CheckIcon
                    className={`${iconClassName} text-green-600 dark:text-green-400`}
                />
            ) : (
                <LinkIcon className={iconClassName} />
            )}
        </a>
    );
};

export default CopyTaskLinkButton;
