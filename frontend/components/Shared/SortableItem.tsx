import React, { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { ArrowsPointingOutIcon } from '@heroicons/react/24/solid';

interface SortableItemProps {
    id: string;
    label: string;
    // Announced by screen readers, e.g. "sortable project".
    roleDescription: string;
    testIdPrefix: string;
    children: React.ReactNode;
}

// Presses on controls inside the item (menus, checkboxes) are not drags.
const isControl = (target: EventTarget) =>
    target instanceof Element &&
    !!target.closest('button, input, select, textarea, [role="menu"]');

// Makes a whole card or row draggable inside a SortableContext. Mouse drags
// start after a few pixels so plain clicks still reach links and menus.
const SortableItem: React.FC<SortableItemProps> = ({
    id,
    label,
    roleDescription,
    testIdPrefix,
    children,
}) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    // Shows the move badge once the item is held, before the drag activates
    // (mouse needs a few pixels, touch a short hold). The delay keeps plain
    // clicks from flashing it.
    const [isPressed, setIsPressed] = useState(false);
    const pressTimer = useRef<number | null>(null);

    const release = () => {
        if (pressTimer.current !== null) {
            window.clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
        setIsPressed(false);
    };

    const press = () => {
        release();
        pressTimer.current = window.setTimeout(() => setIsPressed(true), 150);
        window.addEventListener('mouseup', release, { once: true });
        window.addEventListener('touchend', release, { once: true });
        window.addEventListener('touchcancel', release, { once: true });
    };

    useEffect(
        () => () => {
            if (pressTimer.current !== null) {
                window.clearTimeout(pressTimer.current);
            }
        },
        []
    );

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Space/Enter on a button inside the item must not start a keyboard drag.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) listeners?.onKeyDown?.(e);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button === 0 && !isControl(e.target)) press();
        listeners?.onMouseDown?.(e);
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!isControl(e.target)) press();
        listeners?.onTouchStart?.(e);
    };

    const isActive = isPressed || isDragging;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            aria-roledescription={roleDescription}
            aria-label={label}
            data-testid={`${testIdPrefix}-${id}`}
            data-dragging={isDragging || undefined}
            className={`relative rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isDragging
                    ? 'z-20 cursor-grabbing shadow-2xl ring-2 ring-blue-500'
                    : isPressed
                      ? 'z-10 scale-[1.01] cursor-grabbing shadow-lg'
                      : 'cursor-grab'
            }`}
        >
            {children}
            {isActive && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-blue-500/10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-md">
                        <ArrowsPointingOutIcon className="h-4 w-4" />
                        {t('sortable.move', 'Move')}
                    </span>
                </div>
            )}
        </div>
    );
};

export default SortableItem;
