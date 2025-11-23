import React from 'react';

interface SuggestionsDropdownProps<T> {
    isVisible: boolean;
    items: T[];
    position: { left: number; top: number };
    selectedIndex: number;
    onSelect: (item: T) => void;
    renderLabel: (item: T) => React.ReactNode;
}

const SuggestionsDropdown = <T,>({
    isVisible,
    items,
    position,
    selectedIndex,
    onSelect,
    renderLabel,
}: SuggestionsDropdownProps<T>) => {
    if (!isVisible || items.length === 0) return null;

    return (
        <div
            className="absolute bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50"
            style={{
                left: `${position.left}px`,
                top: `${position.top + 4}px`,
                minWidth: '120px',
                maxWidth: '200px',
            }}
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    onClick={() => onSelect(item)}
                    className={`w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 first:rounded-t-md last:rounded-b-md ${
                        selectedIndex === index
                            ? 'bg-blue-100 dark:bg-blue-800'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                >
                    {renderLabel(item)}
                </button>
            ))}
        </div>
    );
};

export default SuggestionsDropdown;
