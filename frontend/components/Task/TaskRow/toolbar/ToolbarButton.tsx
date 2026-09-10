import React, { forwardRef } from 'react';

interface ToolbarButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick?: (e: React.MouseEvent) => void;
    active?: boolean;
    open?: boolean;
    // Small text/number shown next to the icon when the field has a value.
    badge?: React.ReactNode;
    tone?: 'default' | 'danger';
}

// The icon button used in the expanded row's bottom toolbar.
const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
    ({ icon, label, onClick, active, open, badge, tone = 'default' }, ref) => {
        const base =
            'inline-flex items-center gap-1 h-8 px-1.5 rounded-md text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
        const toneClass =
            tone === 'danger'
                ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                : active || open
                  ? 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700';
        return (
            <button
                ref={ref}
                type="button"
                onClick={onClick}
                title={label}
                aria-label={label}
                aria-haspopup={onClick ? 'dialog' : undefined}
                aria-expanded={open}
                className={`${base} ${toneClass}`}
            >
                <span className="h-4 w-4 flex-shrink-0">{icon}</span>
                {badge != null && badge !== '' && (
                    <span className="text-xs font-medium leading-none max-w-[8rem] truncate">
                        {badge}
                    </span>
                )}
            </button>
        );
    }
);

ToolbarButton.displayName = 'ToolbarButton';

export default ToolbarButton;
