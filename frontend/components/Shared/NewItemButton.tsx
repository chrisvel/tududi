// LTD-PATCH(T-301): All entity primary actions read the shared accent and touch geometry.
import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

// The "New <entity>" action that sits at the right end of a list page's
// title row. Keep every entity page using this so the button stays in the
// same place with the same look. On phones it shrinks to the plus icon.
interface NewItemButtonProps {
    label: string;
    onClick: () => void;
    testId?: string;
}

const NewItemButton: React.FC<NewItemButtonProps> = ({
    label,
    onClick,
    testId,
}) => (
    <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        aria-label={label}
        title={label}
        className="flex shrink-0 items-center justify-center gap-1.5 h-11 min-w-11 px-2.5 sm:px-3 text-sm font-medium whitespace-nowrap ltd-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 transition-opacity"
    >
        <PlusIcon className="w-5 h-5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">{label}</span>
    </button>
);

export default NewItemButton;
