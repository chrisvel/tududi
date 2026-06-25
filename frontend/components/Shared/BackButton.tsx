import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface BackButtonProps {
    className?: string;
    variant?: 'default' | 'overlay';
}

const BackButton: React.FC<BackButtonProps> = ({
    className = '',
    variant = 'default',
}) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const baseClass =
        variant === 'overlay'
            ? 'flex items-center gap-1.5 text-sm text-white/90 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full transition-colors'
            : 'flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors';

    return (
        <button
            onClick={() => navigate(-1)}
            className={`${baseClass} ${className}`}
        >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>{t('common.back', 'Back')}</span>
        </button>
    );
};

export default BackButton;
