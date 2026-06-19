import React from 'react';
import { useTranslation } from 'react-i18next';

export const COLORS = [
    { name: 'None', value: '' },
    { name: 'Red', value: '#B71C1C' },
    { name: 'Orange', value: '#E65100' },
    { name: 'Amber', value: '#FF8F00' },
    { name: 'Green', value: '#2E7D32' },
    { name: 'Teal', value: '#00695C' },
    { name: 'Blue', value: '#1565C0' },
    { name: 'Indigo', value: '#283593' },
    { name: 'Purple', value: '#6A1B9A' },
    { name: 'Pink', value: '#AD1457' },
    { name: 'Grey', value: '#424242' },
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
