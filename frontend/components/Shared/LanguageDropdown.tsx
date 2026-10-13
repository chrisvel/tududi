import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface LanguageOption {
    code: string;
    name: string;
    flag: string;
}

interface LanguageDropdownProps {
    value: string;
    onChange: (languageCode: string) => void;
    className?: string;
}

const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
    value,
    onChange,
    className = '',
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const languages: LanguageOption[] = [
        { code: 'ar', name: t('profile.arabic'), flag: '🇸🇦' },
        { code: 'bg', name: t('profile.bulgarian'), flag: '🇧🇬' },
        { code: 'zh', name: t('profile.chinese'), flag: '🇨🇳' },
        { code: 'da', name: t('profile.danish'), flag: '🇩🇰' },
        { code: 'de', name: t('profile.deutsch'), flag: '🇩🇪' },
        { code: 'nl', name: t('profile.dutch'), flag: '🇳🇱' },
        { code: 'en', name: t('profile.english'), flag: '🇺🇸' },
        { code: 'fi', name: t('profile.finnish'), flag: '🇫🇮' },
        { code: 'fr', name: t('profile.french'), flag: '🇫🇷' },
        { code: 'el', name: t('profile.greek'), flag: '🇬🇷' },
        { code: 'id', name: t('profile.indonesian'), flag: '🇮🇩' },
        { code: 'it', name: t('profile.italian'), flag: '🇮🇹' },
        { code: 'jp', name: t('profile.japanese'), flag: '🇯🇵' },
        { code: 'ko', name: t('profile.korean'), flag: '🇰🇷' },
        { code: 'no', name: t('profile.norwegian'), flag: '🇳🇴' },
        { code: 'pl', name: t('profile.polish'), flag: '🇵🇱' },
        { code: 'pt', name: t('profile.portuguese'), flag: '🇵🇹' },
        { code: 'ro', name: t('profile.romanian'), flag: '🇷🇴' },
        { code: 'ru', name: t('profile.russian'), flag: '🇷🇺' },
        { code: 'sk', name: t('profile.slovak'), flag: '🇸🇰' },
        { code: 'sl', name: t('profile.slovenian'), flag: '🇸🇮' },
        { code: 'es', name: t('profile.spanish'), flag: '🇪🇸' },
        { code: 'sv', name: t('profile.swedish'), flag: '🇸🇪' },
        { code: 'tr', name: t('profile.turkish'), flag: '🇹🇷' },
        { code: 'ua', name: t('profile.ukrainian'), flag: '🇺🇦' },
        { code: 'vi', name: t('profile.vietnamese'), flag: '🇻🇳' },
    ].sort((a, b) => a.name.localeCompare(b.name));

    const selectedLanguage =
        languages.find((lang) => lang.code === value) || languages[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (languageCode: string) => {
        onChange(languageCode);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between text-sm font-medium"
            >
                <div className="flex items-center space-x-2">
                    <span className="text-sm">{selectedLanguage.flag}</span>
                    <span>{selectedLanguage.name}</span>
                </div>
                <ChevronDownIcon
                    className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div
                    className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto"
                    role="listbox"
                >
                    {languages.map((language) => (
                        <button
                            key={language.code}
                            type="button"
                            onClick={() => handleSelect(language.code)}
                            role="option"
                            aria-selected={value === language.code}
                            className={`w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-150 ${
                                value === language.code
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-900 dark:text-gray-100'
                            }`}
                        >
                            <span className="text-lg">{language.flag}</span>
                            <span>{language.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageDropdown;
