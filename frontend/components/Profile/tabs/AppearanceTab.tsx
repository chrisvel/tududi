import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    SunIcon,
    MoonIcon,
    ComputerDesktopIcon,
    SwatchIcon,
    ListBulletIcon,
    PhotoIcon,
} from '@heroicons/react/24/outline';
import type { ProfileFormData } from '../types';
import SelectMenu from '../../Shared/SelectMenu';
import PhotoCredit from '../../Shared/PhotoCredit';
import {
    CONTENT_BACKGROUNDS,
    CONTENT_BACKGROUND_OVERLAY,
    contentBackgroundUrl,
    findContentBackground,
} from '../../../constants/contentBackgrounds';

interface ToggleRowProps {
    label: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    last?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, value, onToggle, last }) => (
    <div
        className={`flex items-center justify-between py-4 ${last ? '' : 'border-b border-gray-200 dark:border-gray-700'}`}
    >
        <div className="pr-8">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        </div>
        <div
            className={`relative inline-block w-12 h-6 flex-shrink-0 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={onToggle}
        >
            <span
                className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                    value ? 'translate-x-6' : 'translate-x-0'
                }`}
            />
        </div>
    </div>
);

interface AppearanceTabProps {
    isActive: boolean;
    formData: ProfileFormData;
    onAppearanceChange: (appearance: 'light' | 'dark' | 'system') => void;
    showTaskContextMenu: boolean;
    onToggleTaskContextMenu: () => void;
    contentBackground: string | null;
    onContentBackgroundChange: (background: string | null) => void;
}

const NO_BACKGROUND = 'none';

interface BackgroundPreviewProps {
    backgroundId: string | null;
}

// A miniature of the content area: the photo, the same tint the app lays over
// it, a few placeholder rows standing in for page content, and the credit.
const BackgroundPreview: React.FC<BackgroundPreviewProps> = ({
    backgroundId,
}) => {
    const background = findContentBackground(backgroundId);

    return (
        <div
            className="relative mt-4 w-full max-w-md aspect-[16/10] overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
            data-testid="content-background-preview"
        >
            {background && (
                <>
                    <img
                        key={background.id}
                        src={contentBackgroundUrl(background, 800)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div
                        className={`absolute inset-0 ${CONTENT_BACKGROUND_OVERLAY}`}
                    />
                </>
            )}
            <div className="relative p-5 space-y-2.5">
                <div className="h-3 w-24 rounded bg-gray-400/60 dark:bg-gray-500/60" />
                {[80, 64, 72].map((width) => (
                    <div
                        key={width}
                        className="flex items-center gap-2 rounded-md bg-white/90 dark:bg-gray-900/80 px-3 py-2 shadow-sm"
                    >
                        <span className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span
                            className="h-2 rounded bg-gray-300 dark:bg-gray-600"
                            style={{ width: `${width}%` }}
                        />
                    </div>
                ))}
            </div>
            {background && (
                <PhotoCredit
                    background={background}
                    className="absolute bottom-2 left-2"
                />
            )}
        </div>
    );
};

const AppearanceTab: React.FC<AppearanceTabProps> = ({
    isActive,
    formData,
    onAppearanceChange,
    showTaskContextMenu,
    onToggleTaskContextMenu,
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
                <div className="max-w-md">
                    <SelectMenu
                        id="content-background"
                        testId="content-background-select"
                        value={contentBackground ?? NO_BACKGROUND}
                        options={[
                            {
                                value: NO_BACKGROUND,
                                label: t(
                                    'profile.contentBackgroundNone',
                                    'None'
                                ),
                            },
                            ...CONTENT_BACKGROUNDS.map((bg) => ({
                                value: bg.id,
                                label: bg.name,
                                hint: bg.photographer,
                            })),
                        ]}
                        onChange={(value) =>
                            onContentBackgroundChange(
                                value === NO_BACKGROUND ? null : value
                            )
                        }
                    />
                </div>
                <BackgroundPreview backgroundId={contentBackground} />
            </div>

            {/* Tasks */}
            <div>
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ListBulletIcon className="w-4 h-4" />
                    {t('profile.tasks', 'Tasks')}
                </h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg px-4">
                    <h5 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-4 pb-2">
                        {t('profile.taskItem', 'Task Item')}
                    </h5>
                    <ToggleRow
                        label={t('profile.showTaskContextMenu', 'Show context menu button')}
                        description={t(
                            'profile.showTaskContextMenuDescription',
                            'Display a three-dot button on each task with Edit and Delete actions'
                        )}
                        value={showTaskContextMenu}
                        onToggle={onToggleTaskContextMenu}
                        last
                    />
                </div>
            </div>
        </div>
    );
};

export default AppearanceTab;
