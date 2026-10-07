import {
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// Mouse drags start after a few pixels and touch drags after a short hold,
// so clicks and scrolling keep working on draggable lists.
export const useSortableSensors = () =>
    useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

// Links under the pointer would still get the click that ends a mouse drag,
// so swallow that one click.
export const swallowNextClick = () => {
    const swallow = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, true), 0);
};

// Keeps the grabbing cursor while the pointer is outside the dragged item.
export const sortableCursorHandlers = {
    onDragStart: () => {
        document.body.style.cursor = 'grabbing';
    },
    onDragCancel: () => {
        document.body.style.cursor = '';
    },
};

export const resetSortableCursor = () => {
    document.body.style.cursor = '';
};

// Lists are filtered or paged, so a drag reorders the visible items within
// the slots they already hold in the full order; hidden items stay put.
export const mergeVisibleOrder = (
    fullOrder: string[],
    visibleOrder: string[]
): string[] => {
    const visible = new Set(visibleOrder);
    let next = 0;
    return fullOrder.map((uid) =>
        visible.has(uid) ? visibleOrder[next++] : uid
    );
};
