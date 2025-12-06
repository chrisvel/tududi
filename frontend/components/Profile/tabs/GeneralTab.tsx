import React, { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
    SunIcon,
    MoonIcon,
    PhotoIcon,
    UserCircleIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../../config/paths';
import LanguageDropdown from '../../Shared/LanguageDropdown';
import TimezoneDropdown from '../../Shared/TimezoneDropdown';
import FirstDayOfWeekDropdown from '../../Shared/FirstDayOfWeekDropdown';
import type { ProfileFormData } from '../types';
import type {
    getRegionDisplayName,
    getTimezonesByRegion,
} from '../../../utils/timezoneUtils';

interface GeneralTabProps {
    isActive: boolean;
    formData: ProfileFormData;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onAppearanceChange: (appearance: 'light' | 'dark') => void;
    onLanguageChange: (languageCode: string) => void;
    onTimezoneChange: (timezone: string) => void;
    onFirstDayChange: (value: number) => void;
    avatarPreview: string | null;
    onAvatarSelect: (file: File) => void;
    onAvatarRemove: () => void;
    timezonesByRegion: ReturnType<typeof getTimezonesByRegion>;
    getRegionDisplayName: typeof getRegionDisplayName;
}

const GeneralTab: React.FC<GeneralTabProps> = ({
    isActive,
    formData,
    onChange,
    onAppearanceChange,
    onLanguageChange,
    onTimezoneChange,
    onFirstDayChange,
    avatarPreview,
    onAvatarSelect,
    onAvatarRemove,
    timezonesByRegion,
    getRegionDisplayName,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <UserIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t('profile.accountSettings', 'Account & Preferences')}
            </h3>

            <div className="mb-8 flex flex-col items-center">
                <div className="relative">
                    {avatarPreview || formData.avatar_image ? (
                        <img
                            src={
                                avatarPreview ||
                                getApiPath(formData.avatar_image || '')
                            }
                            alt="Avatar"
                            className="w-32 h-32 rounded-full object-cover border-4 border-blue-500"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full border-4 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <UserCircleIcon className="w-20 h-20 text-gray-400 dark:text-gray-500" />
                        </div>
                    )}
                    <label
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 cursor-pointer transition-colors"
                    >
                        <PhotoIcon className="w-5 h-5" />
                        <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    onAvatarSelect(file);
                                }
                            }}
                        />
                    </label>
                </div>
                {(formData.avatar_image || avatarPreview) && (
                    <button
                        type="button"
                        onClick={onAvatarRemove}
                        className="mt-3 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                        {t('profile.removeAvatar', 'Remove Avatar')}
                    </button>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {t(
                        'profile.avatarDescription',
                        'Upload a profile photo (max 5MB)'
                    )}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.name', 'Name')}
                    </label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name || ''}
                        onChange={onChange}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t('profile.enterName', 'Enter your name')}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.surname', 'Surname')}
                    </label>
                    <input
                        type="text"
                        name="surname"
                        value={formData.surname || ''}
                        onChange={onChange}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t(
                            'profile.enterSurname',
                            'Enter your surname'
                        )}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.appearance')}
                    </label>
                    <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => onAppearanceChange('light')}
                            className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors ${
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
                            className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors ${
                                formData.appearance === 'dark'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                        >
                            <MoonIcon className="h-4 w-4 mr-2" />
                            {t('profile.darkMode', 'Dark')}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.language')}
                    </label>
                    <LanguageDropdown
                        value={formData.language || 'en'}
                        onChange={onLanguageChange}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.timezone')}
                    </label>
                    <TimezoneDropdown
                        value={formData.timezone || 'UTC'}
                        onChange={onTimezoneChange}
                        timezonesByRegion={timezonesByRegion}
                        getRegionDisplayName={getRegionDisplayName}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.firstDayOfWeek', 'First day of week')}
                    </label>
                    <FirstDayOfWeekDropdown
                        value={formData.first_day_of_week ?? 1}
                        onChange={onFirstDayChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default GeneralTab;
