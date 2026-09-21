export const DEFAULT_LINK_ORDER = [
    'inbox',
    'today',
    'upcomingTasks',
    'calendar',
    'allTasks',
    'assignedToMe',
    'everyone',
] as const;

export const DEFAULT_SECTION_ORDER = [
    'favorites',
    'projects',
    'areas',
    'goals',
    'notes',
    'tags',
    'people',
    'habits',
    'views',
    'boards',
    'insights',
] as const;

// Templates and Access sit in a fixed group at the bottom of the sidebar:
// they can be switched off but not moved.
export const FIXED_BOTTOM_ITEMS = ['templates', 'access'] as const;

export type SidebarLinkId = (typeof DEFAULT_LINK_ORDER)[number];
export type SidebarSectionId = (typeof DEFAULT_SECTION_ORDER)[number];

// Keeps the saved order for the ids that still exist, drops unknown or
// repeated ones, and puts any id the saved order does not know about at the
// end, so a newly added item never disappears for existing users.
export const resolveOrder = <T extends string>(
    saved: unknown,
    defaults: readonly T[]
): T[] => {
    const known = new Set<string>(defaults);
    const result: T[] = [];
    if (Array.isArray(saved)) {
        for (const id of saved) {
            if (
                typeof id === 'string' &&
                known.has(id) &&
                !result.includes(id as T)
            ) {
                result.push(id as T);
            }
        }
    }
    for (const id of defaults) {
        if (!result.includes(id)) result.push(id);
    }
    return result;
};

export const sortByOrder = <T extends { id: string }>(
    items: T[],
    order: readonly string[]
): T[] => {
    const position = new Map(order.map((id, index) => [id, index]));
    return [...items].sort(
        (a, b) =>
            (position.get(a.id) ?? order.length) -
            (position.get(b.id) ?? order.length)
    );
};
