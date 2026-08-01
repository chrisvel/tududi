import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, ArrowDownTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { MarketplaceTemplate } from '../../entities/Template';
import { fetchMarketplaceTemplate } from '../../utils/templatesService';

interface MarketplacePreviewModalProps {
    template: MarketplaceTemplate;
    onClose: () => void;
    onInstall: (template: MarketplaceTemplate) => void;
    installing?: boolean;
}

const ACCENT_COLORS = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-cyan-500',
    'bg-pink-500',
    'bg-teal-500',
];

function categoryAccentBar(category?: string) {
    if (!category) return ACCENT_COLORS[0];
    let hash = 0;
    for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) & 0xffff;
    return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

const MarketplacePreviewModal: React.FC<MarketplacePreviewModalProps> = ({
    template,
    onClose,
    onInstall,
    installing = false,
}) => {
    const { t } = useTranslation();
    const [full, setFull] = useState<MarketplaceTemplate>(template);
    const [loading, setLoading] = useState(true);
    const accentBar = categoryAccentBar(template.category);

    useEffect(() => {
        fetchMarketplaceTemplate(template.uid)
            .then(setFull)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [template.uid]);

    const tasks = full.structure?.tasks || [];

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`h-1.5 w-full flex-shrink-0 ${accentBar}`} />

                <div className="px-6 pt-5 pb-4 flex-shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug">
                                {full.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {full.category && (
                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full font-medium">
                                        {full.category}
                                    </span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${full.is_free ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'}`}>
                                    {full.is_free ? t('templates.marketplace.free', 'Free') : t('templates.marketplace.paid', 'Paid')}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>

                    {full.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                            {full.description}
                        </p>
                    )}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 mx-6" />

                <div className="px-6 py-3 flex-shrink-0">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        {t('templates.taskList', 'Tasks')}
                        {!loading && tasks.length > 0 && <span className="ml-1.5 normal-case font-normal">({tasks.length})</span>}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
                        </div>
                    ) : tasks.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                            {t('templates.noTasks', 'No tasks in this template')}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {tasks.map((task, i) => (
                                <div key={i}>
                                    <div className="flex items-start gap-2.5 py-1.5">
                                        <CheckCircleIcon className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{task.name}</span>
                                    </div>
                                    {(task.subtasks || []).length > 0 && (
                                        <div className="ml-6 pl-3 border-l-2 border-gray-100 dark:border-gray-700 mb-1">
                                            {(task.subtasks || []).map((sub, si) => (
                                                <div key={si} className="flex items-start gap-2 py-1">
                                                    <span className="text-gray-300 dark:text-gray-600 text-xs mt-px">—</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{sub.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0 bg-gray-50 dark:bg-gray-800/80">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        {tasks.length > 0 && <>{tasks.length} {t('templates.tasks', 'tasks')}</>}
                        {full.clone_count !== undefined && full.clone_count > 0 && (
                            <span className="ml-2 text-gray-300 dark:text-gray-600">&bull;</span>
                        )}
                        {full.clone_count !== undefined && full.clone_count > 0 && (
                            <span className="ml-2">{full.clone_count} {t('templates.uses', 'uses')}</span>
                        )}
                    </span>
                    <button
                        onClick={() => onInstall(full)}
                        disabled={installing}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        {installing ? t('templates.marketplace.installing', 'Installing...') : t('templates.marketplace.install', 'Install')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MarketplacePreviewModal;
