import React from 'react';

interface SuggestionsDropdownProps<T> {
    isVisible: boolean;
    items: T[];
    // `bottom` opens the list upward, ending that many pixels above the
    // bottom of the window.
    position: { left: number; top: number; bottom?: number };
    selectedIndex: number;
    onSelect: (item: T) => void;
    renderLabel: (item: T) => React.ReactNode;
    // A wider list for rows with an icon and a second line, like the note
    // editor's slash menu.
    rich?: boolean;
}

const SuggestionsDropdown = <T,>({
    isVisible,
    items,
    position,
    selectedIndex,
    onSelect,
    renderLabel,
    rich = false,
}: SuggestionsDropdownProps<T>) => {
    if (!isVisible || items.length === 0) return null;

    return (
        <div
            data-testid={rich ? 'slash-menu' : undefined}
            className={`fixed bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-lg z-50 ${
                rich
                    ? 'rounded-lg dark:bg-gray-800 dark:border-gray-700 overflow-y-auto'
                    : 'rounded-md'
            }`}
            style={{
                left: `${position.left}px`,
                ...(position.bottom !== undefined
                    ? { bottom: `${position.bottom}px` }
                    : { top: `${position.top}px` }),
                minWidth: rich ? '220px' : '120px',
                maxWidth: rich ? '320px' : '200px',
                ...(rich ? { maxHeight: '352px' } : {}),
            }}
            // Keep the caret in the text box while picking with the mouse
            onMouseDown={rich ? (e) => e.preventDefault() : undefined}
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    type="button"
                    onClick={() => onSelect(item)}
                    className={
                        rich
                            ? `w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                                  selectedIndex === index
                                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`
                            : `w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 first:rounded-t-md last:rounded-b-md ${
                                  selectedIndex === index
                                      ? 'bg-blue-100 dark:bg-blue-800'
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                              }`
                    }
                >
                    {renderLabel(item)}
                </button>
            ))}
        </div>
    );
};

export default SuggestionsDropdown;
