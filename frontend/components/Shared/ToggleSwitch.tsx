import React from 'react';

interface ToggleSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
    className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
    checked,
    onChange,
    label,
    description,
    disabled = false,
    className = '',
}) => {
    const handleToggle = () => {
        if (!disabled) {
            onChange(!checked);
        }
    };

    return (
        <div className={`flex items-start space-x-3 ${className}`}>
            <button
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${
              checked
                  ? 'bg-blue-600 dark:bg-blue-500'
                  : 'bg-gray-200 dark:bg-gray-600'
          }
        `}
                role="switch"
                aria-checked={checked}
                aria-disabled={disabled}
            >
                <span className="sr-only">{label}</span>
                <span
                    className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
            transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
                />
            </button>

            <div className="flex-1">
                <label
                    className={`text-sm font-medium cursor-pointer ${
                        disabled
                            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'text-gray-700 dark:text-gray-300'
                    }`}
                    onClick={handleToggle}
                >
                    {label}
                </label>
                {description && (
                    <p
                        className={`text-xs mt-1 ${
                            disabled
                                ? 'text-gray-400 dark:text-gray-500'
                                : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ToggleSwitch;
