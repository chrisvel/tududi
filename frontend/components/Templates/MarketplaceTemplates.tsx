import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { MarketplaceTemplate } from '../../entities/Template';
import { fetchMarketplaceTemplates, installMarketplaceTemplate } from '../../utils/templatesService';
import { useToast } from '../Shared/ToastContext';
import MarketplaceTemplateCard from './MarketplaceTemplateCard';

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
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('templates.marketplace.search', 'Search marketplace...')}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                {categories.length > 1 && (
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat === 'all' ? t('templates.allCategories', 'All Categories') : cat}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
                    {t('templates.noResults', 'No templates match your search.')}
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((tpl) => (
                        <MarketplaceTemplateCard
                            key={tpl.uid}
                            template={tpl}
                            onInstall={handleInstall}
                            installing={installingUid === tpl.uid}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default MarketplaceTemplates;
