// Life-to-Day (T-301/T-303): calendar system and digit preferences, stored in
// ui_settings.locale and applied immediately without a reload.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchProfile, updateUiSettings } from '../../utils/profileService';
import {
    setLocalePreferences,
    type LocalePreferences,
} from '../../utils/jalali';

const LocalePreferencesSection: React.FC = () => {
    const { t } = useTranslation();
    const [prefs, setPrefs] = useState<LocalePreferences>({});
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchProfile()
            .then((profile) => {
                if (cancelled) return;
                const locale =
                    (
                        profile.ui_settings as
                            { locale?: LocalePreferences } | undefined
                    )?.locale || {};
                setPrefs(locale);
                setLocalePreferences(locale);
                setLoaded(true);
            })
            .catch(() => setLoaded(true));
        return () => {
            cancelled = true;
        };
    }, []);

    const save = (next: LocalePreferences) => {
        setPrefs(next);
        setLocalePreferences(next);
        updateUiSettings({ locale: next }).catch((error) => {
            console.error('Failed to save locale preferences:', error);
        });
    };

    if (!loaded) return null;

    return (
        <>
            <div>
                <label
                    htmlFor="locale-calendar-system"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                    {t('profile.calendarSystem', 'Calendar')}
                </label>
                <select
                    id="locale-calendar-system"
                    value={prefs.calendarSystem || ''}
                    onChange={(e) =>
                        save({
                            ...prefs,
                            calendarSystem: e.target.value
                                ? (e.target
                                      .value as LocalePreferences['calendarSystem'])
                                : undefined,
                        })
                    }
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
                >
                    <option value="">
                        {t('profile.calendarSystemAuto', 'Match language')}
                    </option>
                    <option value="gregorian">
                        {t('profile.calendarGregorian', 'Gregorian')}
                    </option>
                    <option value="persian">
                        {t('profile.calendarPersian', 'Persian (Jalali)')}
                    </option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('profile.latinDigits', 'Digits')}
                </label>
                <label className="flex items-center gap-2 px-1 py-2 text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={prefs.latinDigits || false}
                        onChange={(e) =>
                            save({ ...prefs, latinDigits: e.target.checked })
                        }
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    {t(
                        'profile.latinDigitsDescription',
                        'Show Latin digits (0-9) instead of Persian digits'
                    )}
                </label>
            </div>
        </>
    );
};

export default LocalePreferencesSection;
