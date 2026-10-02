import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    SunIcon,
    MoonIcon,
    ComputerDesktopIcon,
    SwatchIcon,
    PhotoIcon,
    NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import type { ProfileFormData } from '../types';
import {
    CONTENT_BACKGROUNDS,
    contentBackgroundUrl,
} from '../../../constants/contentBackgrounds';

interface AppearanceTabProps {
    isActive: boolean;
    formData: ProfileFormData;
    onAppearanceChange: (appearance: 'light' | 'dark' | 'system') => void;
    contentBackground: string | null;
    onContentBackgroundChange: (background: string | null) => void;
}

interface BackgroundCardProps {
    label: string;
    caption?: string;
    imageUrl?: string;
    selected: boolean;
    onSelect: () => void;
}

const BackgroundCard: React.FC<BackgroundCardProps> = ({
    label,
    caption,
    imageUrl,
    selected,
    onSelect,
}) => (
    <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="group text-left focus:outline-none"
    >
        <div
            className={`relative aspect-[16/10] overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800 transition-shadow ${
                selected
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
                    : 'group-focus-visible:ring-2 group-focus-visible:ring-blue-400'
            }`}
        >
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
            ) : (
                <NoSymbolIcon className="absolute inset-0 m-auto h-5 w-5 text-gray-400 dark:text-gray-500" />
            )}
            {selected && (
                <CheckCircleIcon className="absolute top-1 right-1 h-4 w-4 text-white drop-shadow" />
            )}
        </div>
        <p className="mt-1 text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
            {label}
        </p>
        {caption && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {caption}
            </p>
        )}
    </button>
);

const AppearanceTab: React.FC<AppearanceTabProps> = ({
    isActive,
    formData,
    onAppearanceChange,
    contentBackground,
    onContentBackgroundChange,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <SwatchIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t('profile.appearance', 'Appearance')}
            </h3>

            {/* Theme */}
            <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    {t('profile.theme', 'Theme')}
                </h4>
                <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => onAppearanceChange('light')}
                        className={`flex items-center justify-center px-5 py-2 text-sm font-medium transition-colors ${
                            formData.appearance === 'light'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                    >
                        <SunIcon className="h-4 w-4 mr-2" />
                        {t('profile.lightMode', 'Light')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onAppearanceChange('dark')}
                        className={`flex items-center justify-center px-5 py-2 text-sm font-medium border-l border-gray-300 dark:border-gray-600 transition-colors ${
                            formData.appearance === 'dark'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                    >
                        <MoonIcon className="h-4 w-4 mr-2" />
                        {t('profile.darkMode', 'Dark')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onAppearanceChange('system')}
                        className={`flex items-center justify-center px-5 py-2 text-sm font-medium border-l border-gray-300 dark:border-gray-600 transition-colors ${
                            formData.appearance === 'system'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                    >
                        <ComputerDesktopIcon className="h-4 w-4 mr-2" />
                        {t('profile.systemMode', 'System')}
                    </button>
                </div>
            </div>

            {/* Background */}
            <div className="mb-8">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <PhotoIcon className="w-4 h-4" />
                    {t('profile.contentBackground', 'Background')}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {t(
                        'profile.contentBackgroundDescription',
                        'Show a photo behind the main content area. Photos come from Unsplash and are credited to their photographers.'
                    )}
                </p>
                <div
                    className="grid grid-cols-3 sm:grid-cols-4 gap-3"
                    data-testid="content-background-cards"
                >
                    <BackgroundCard
                        label={t('profile.contentBackgroundNone', 'None')}
                        selected={!contentBackground}
                        onSelect={() => onContentBackgroundChange(null)}
                    />
                    {CONTENT_BACKGROUNDS.map((bg) => (
                        <BackgroundCard
                            key={bg.id}
                            label={bg.name}
                            caption={bg.photographer}
                            imageUrl={contentBackgroundUrl(bg, 320)}
                            selected={contentBackground === bg.id}
                            onSelect={() => onContentBackgroundChange(bg.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AppearanceTab;
