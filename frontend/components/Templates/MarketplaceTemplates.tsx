import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBagIcon } from '@heroicons/react/24/outline';

interface MarketplaceTemplatesProps {
    onInstalled: () => void;
}

const MarketplaceTemplates: React.FC<MarketplaceTemplatesProps> = () => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center">
                    <ShoppingBagIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('templates.marketplace.comingSoon', 'Marketplace coming soon')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
                        {t('templates.marketplace.underDevelopment', 'The template marketplace is currently under development. Check back later.')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MarketplaceTemplates;
