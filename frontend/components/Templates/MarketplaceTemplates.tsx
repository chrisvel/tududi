import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { MarketplaceTemplate } from '../../entities/Template';
import { fetchMarketplaceTemplates, installMarketplaceTemplate } from '../../utils/templatesService';
import { useToast } from '../Shared/ToastContext';
import MarketplaceTemplateCard from './MarketplaceTemplateCard';
import MarketplacePreviewModal from './MarketplacePreviewModal';

interface MarketplaceTemplatesProps {
    onInstalled: () => void;
}

const MarketplaceTemplates: React.FC<MarketplaceTemplatesProps> = ({ onInstalled }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [installingUid, setInstallingUid] = useState<string | null>(null);
    const [previewTarget, setPreviewTarget] = useState<MarketplaceTemplate | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const results = await fetchMarketplaceTemplates();
            setTemplates(results);
        } catch {
            showErrorToast(t('templates.marketplace.fetchError', 'Failed to load marketplace templates.'));
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (template: MarketplaceTemplate) => {
        if (!template.uid) return;
        setInstallingUid(template.uid);
        try {
            await installMarketplaceTemplate(template.uid);
            showSuccessToast(t('templates.marketplace.installed', '"{{name}}" installed to your templates.', { name: template.name }));
            onInstalled();
        } catch (err: any) {
            showErrorToast(err?.message || t('templates.marketplace.installError', 'Failed to install template.'));
        } finally {
            setInstallingUid(null);
        }
    };

    const categories = ['all', ...Array.from(new Set(templates.map((t) => t.category).filter(Boolean) as string[]))];

    const filtered = templates.filter((tpl) => {
        const matchSearch = !search || tpl.name.toLowerCase().includes(search.toLowerCase()) || tpl.description?.toLowerCase().includes(search.toLowerCase());
        const matchCategory = categoryFilter === 'all' || tpl.category === categoryFilter;
        return matchSearch && matchCategory;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
        );
    }

    if (templates.length === 0) {
        return (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <p className="text-sm">{t('templates.marketplace.empty', 'No templates available in the marketplace yet.')}</p>
            </div>
        );
    }

    return (
        <>
        <div className="flex flex-col gap-5">
            <div className="pb-2 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('templates.marketplace.title', 'Marketplace')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('templates.marketplace.subtitle', 'Browse and install ready-made templates from the community')}
                </p>
            </div>

            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('templates.marketplace.search', 'Search marketplace...')}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {categories.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                                categoryFilter === cat
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                            }`}
                        >
                            {cat === 'all' ? t('templates.allCategories', 'All') : cat}
                        </button>
                    ))}
                </div>
            )}

            {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
                    {t('templates.noResults', 'No templates match your search.')}
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {filtered.length} {filtered.length === 1 ? t('templates.result', 'template') : t('templates.results', 'templates')}
                        {categoryFilter !== 'all' && <span> {t('templates.inCategory', 'in')} <span className="font-medium text-gray-600 dark:text-gray-300">{categoryFilter}</span></span>}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((tpl) => (
                            <MarketplaceTemplateCard
                                key={tpl.uid}
                                template={tpl}
                                onInstall={handleInstall}
                                onPreview={setPreviewTarget}
                                installing={installingUid === tpl.uid}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>

        {previewTarget && (
            <MarketplacePreviewModal
                template={previewTarget}
                onClose={() => setPreviewTarget(null)}
                onInstall={(tpl) => { setPreviewTarget(null); handleInstall(tpl); }}
                installing={installingUid === previewTarget.uid}
            />
        )}
        </>
    );
};

export default MarketplaceTemplates;
