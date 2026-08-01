import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon, EyeIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { MarketplaceTemplate } from '../../entities/Template';

interface MarketplaceTemplateCardProps {
    template: MarketplaceTemplate;
    onInstall: (template: MarketplaceTemplate) => void;
    onPreview: (template: MarketplaceTemplate) => void;
    installing?: boolean;
}

const ACCENT_COLORS = [
    { bar: 'bg-violet-500', badge: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
    { bar: 'bg-blue-500',   badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
    { bar: 'bg-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
    { bar: 'bg-rose-500',  badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
    { bar: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
    { bar: 'bg-cyan-500',  badge: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
    { bar: 'bg-pink-500',  badge: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300' },
    { bar: 'bg-teal-500',  badge: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' },
];

function categoryAccent(category?: string) {
    if (!category) return ACCENT_COLORS[0];
    let hash = 0;
    for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) & 0xffff;
    return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

const MarketplaceTemplateCard: React.FC<MarketplaceTemplateCardProps> = ({
    template,
    onInstall,
    onPreview,
    installing = false,
}) => {
    const { t } = useTranslation();
    const accent = categoryAccent(template.category);
    const taskCount = template.tasks_preview?.length ?? 0;

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
            <div className={`h-1.5 w-full ${accent.bar}`} />

            <div className="p-4 flex flex-col gap-2.5 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                        {template.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${template.is_free ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'}`}>
                        {template.is_free
                            ? t('templates.marketplace.free', 'Free')
                            : t('templates.marketplace.paid', 'Paid')}
                    </span>
                </div>

                {template.category && (
                    <span className={`text-xs px-2 py-0.5 rounded-full self-start font-medium ${accent.badge}`}>
                        {template.category}
                    </span>
                )}

                {template.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {template.description}
                    </p>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mt-auto pt-1">
                    {taskCount > 0 && (
                        <span className="flex items-center gap-1">
                            <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
                            {taskCount} {t('templates.tasks', 'tasks')}
                        </span>
                    )}
                    {template.clone_count !== undefined && template.clone_count > 0 && (
                        <span className="flex items-center gap-1">
                            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                            {template.clone_count} {t('templates.uses', 'uses')}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 pt-2.5 border-t border-gray-100 dark:border-gray-700/60">
                    <button
                        onClick={() => onPreview(template)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 rounded-md transition-colors"
                    >
                        <EyeIcon className="h-3.5 w-3.5" />
                        {t('templates.marketplace.preview', 'Preview')}
                    </button>
                    <button
                        onClick={() => onInstall(template)}
                        disabled={installing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors ml-auto"
                    >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                        {installing
                            ? t('templates.marketplace.installing', 'Installing...')
                            : t('templates.marketplace.install', 'Install')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MarketplaceTemplateCard;
