import React from 'react';
import { useTranslation } from 'react-i18next';

export const COLORS = [
    { name: 'None', value: '' },
    { name: 'Rose', value: '#f28b82' },
    { name: 'Peach', value: '#fbbc04' },
    { name: 'Sage', value: '#ccff90' },
    { name: 'Basil', value: '#34a853' },
    { name: 'Peacock', value: '#4ecde6' },
    { name: 'Blueberry', value: '#4285f4' },
    { name: 'Lavender', value: '#aecbfa' },
    { name: 'Grape', value: '#d7aefb' },
    { name: 'Flamingo', value: '#f7c8cb' },
    { name: 'Graphite', value: '#9e9e9e' },
];

interface ColorPickerProps {
    value?: string;
    onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
                <button
                    key={color.name}
                    type="button"
                    onClick={() => onChange(color.value)}
                    aria-label={t(`colors.${color.name.toLowerCase()}`, color.name)}
                    className={`w-7 h-7 rounded-full border-2 transition-all focus:outline-none ${
                        (value || '') === color.value
                            ? 'border-blue-500 scale-110'
                            : 'border-transparent hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    style={
                        color.value
                            ? { backgroundColor: color.value }
                            : { backgroundColor: 'transparent' }
                    }
                >
                    {!color.value && (
                        <span className="flex items-center justify-center w-full h-full rounded-full border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 text-xs">
                            ✕
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
};

export default ColorPicker;
