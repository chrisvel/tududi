import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon, RectangleStackIcon } from '@heroicons/react/24/outline';
import { MarketplaceTemplate } from '../../entities/Template';

interface MarketplaceTemplateCardProps {
    template: MarketplaceTemplate;
    onInstall: (template: MarketplaceTemplate) => void;
    installing?: boolean;
}

const MarketplaceTemplateCard: React.FC<MarketplaceTemplateCardProps> = ({
    template,
    onInstall,
    installing = false,
}) => {
    const { t } = useTranslation();

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <RectangleStackIcon className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {template.name}
                    </h3>
                </div>
                <span
                    className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        template.is_free
                            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                            : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                    }`}
                >
                    {template.is_free
                        ? t('templates.marketplace.free', 'Free')
                        : t('templates.marketplace.paid', 'Paid')}
                </span>
            </div>

            {template.category && (
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full self-start">
                    {template.category}
                </span>
            )}

            {template.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {template.description}
                </p>
            )}

            {template.clone_count !== undefined && template.clone_count > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    {template.clone_count} {t('templates.uses', 'uses')}
                </span>
            )}

            <button
                onClick={() => onInstall(template)}
                disabled={installing}
                className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors mt-auto"
            >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {installing
                    ? t('templates.marketplace.installing', 'Installing...')
                    : t('templates.marketplace.install', 'Install')}
            </button>
        </div>
    );
};

export default MarketplaceTemplateCard;
