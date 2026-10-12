import React from 'react';
import {
    ArrowPathIcon,
    CalendarIcon,
    FolderIcon,
    PlusIcon,
    Squares2X2Icon,
    TagIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import type { SlashIcon, SlashItem } from '../../utils/slashMenu';

const ICONS: Record<SlashIcon, React.ComponentType<{ className?: string }>> = {
    tag: TagIcon,
    project: FolderIcon,
    person: UserIcon,
    area: Squares2X2Icon,
    date: CalendarIcon,
    repeat: ArrowPathIcon,
    create: PlusIcon,
};

// One row of the capture box's "/" menu, laid out like the note editor's
// slash menu: an icon badge, the name, and the syntax under it.
const SlashItemRow: React.FC<{ item: SlashItem }> = ({ item }) => {
    const Icon = ICONS[item.icon];
    return (
        <>
            <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium leading-tight truncate">
                    {item.label}
                </span>
                {item.description && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400 leading-tight truncate">
                        {item.description}
                    </span>
                )}
            </span>
        </>
    );
};

export default SlashItemRow;
