import React from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
    CONTENT_BACKGROUNDS,
    contentBackgroundUrl,
} from '../../constants/contentBackgrounds';

interface NoteBackgroundPickerProps {
    value?: string | null;
    onChange: (background: string | null) => void;
    disabled?: boolean;
    // 'large' shows wide previews, for dialogs with room for them.
    size?: 'small' | 'large';
}

// The content backgrounds as small swatches, plus "none".
const NoteBackgroundPicker: React.FC<NoteBackgroundPickerProps> = ({
    value,
    onChange,
    disabled,
    size = 'small',
}) => {
    const large = size === 'large';
    const { t } = useTranslation();
    const swatch = (selected: boolean) =>
        `${large ? 'w-full aspect-video hover:scale-105' : 'w-8 h-8 hover:scale-110'} rounded-md border-2 transition-all flex items-center justify-center bg-cover bg-center disabled:opacity-50 ${
            selected
                ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                : 'border-gray-300 dark:border-gray-600'
        }`;

    return (
        <div
            className={`grid gap-2 ${large ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-5'}`}
            data-testid="note-background-picker"
        >
            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(null)}
                className={`${swatch(!value)} bg-white dark:bg-gray-700`}
                title={t('notes.noBackground', 'No background')}
                aria-label={t('notes.noBackground', 'No background')}
                aria-pressed={!value}
            >
                <XMarkIcon className="h-5 w-5 text-gray-400" />
            </button>
            {CONTENT_BACKGROUNDS.map((bg) => (
                <button
                    key={bg.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(bg.id)}
                    className={swatch(value === bg.id)}
                    style={{
                        backgroundImage: `url(${contentBackgroundUrl(bg, large ? 320 : 96)})`,
                    }}
                    title={bg.name}
                    aria-label={bg.name}
                    aria-pressed={value === bg.id}
                />
            ))}
        </div>
    );
};

export default NoteBackgroundPicker;
