import React from 'react';
import { useTranslation } from 'react-i18next';
import { PALETTE, resolveColor } from '../../constants/colorPalette';

// Kept for callers that list the palette themselves (for example the note
// background menu). The empty entry means "no color".
export const COLORS = [
    { name: 'None', value: '' },
    ...PALETTE.map(({ name, value }) => ({ name, value })),
];

interface ColorPickerProps {
    value?: string | null;
    onChange: (color: string) => void;
    allowNone?: boolean;
    // What "no color" looks like where it is used, e.g. a habit's default.
    noneLabel?: string;
    disabled?: boolean;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
    value,
    onChange,
    allowNone = true,
    noneLabel,
    disabled,
}) => {
    const { t } = useTranslation();
    const selected = resolveColor(value)?.value.toLowerCase() || '';
    const options = allowNone ? COLORS : COLORS.filter((c) => c.value);

    return (
        <div
            role="radiogroup"
            aria-label={t('colors.label', 'Color')}
            className="flex flex-wrap gap-2"
        >
            {options.map((color) => {
                const isSelected = selected === color.value.toLowerCase();
                const label = color.value
                    ? t(`colors.${color.name.toLowerCase()}`, color.name)
                    : noneLabel || t('colors.none', 'None');
                return (
                    <button
                        key={color.name}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={label}
                        title={label}
                        disabled={disabled}
                        onClick={() => onChange(color.value)}
                        className={`w-7 h-7 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 ${
                            isSelected
                                ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white ring-offset-white dark:ring-offset-gray-900 scale-110'
                                : 'hover:scale-110'
                        }`}
                        style={
                            color.value
                                ? { backgroundColor: color.value }
                                : undefined
                        }
                    >
                        {!color.value && (
                            <span className="flex items-center justify-center w-full h-full rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs">
                                ✕
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default ColorPicker;
