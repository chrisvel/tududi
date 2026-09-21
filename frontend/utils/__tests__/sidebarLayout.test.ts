import {
    DEFAULT_LINK_ORDER,
    DEFAULT_SECTION_ORDER,
    resolveOrder,
    sortByOrder,
} from '../sidebarLayout';

describe('resolveOrder', () => {
    it('returns the default order when nothing was saved', () => {
        expect(resolveOrder(undefined, DEFAULT_SECTION_ORDER)).toEqual([
            ...DEFAULT_SECTION_ORDER,
        ]);
        expect(resolveOrder(null, DEFAULT_LINK_ORDER)).toEqual([
            ...DEFAULT_LINK_ORDER,
        ]);
    });

    it('keeps the saved order and appends items it did not know about', () => {
        const result = resolveOrder(
            ['notes', 'projects'],
            DEFAULT_SECTION_ORDER
        );

        expect(result.slice(0, 2)).toEqual(['notes', 'projects']);
        expect(result).toHaveLength(DEFAULT_SECTION_ORDER.length);
        expect(result.slice(2)).toEqual(
            DEFAULT_SECTION_ORDER.filter(
                (id) => id !== 'notes' && id !== 'projects'
            )
        );
    });

    it('drops unknown, repeated and non-string ids', () => {
        const result = resolveOrder(
            ['notes', 'gone', 'notes', 7, null, 'projects'],
            DEFAULT_SECTION_ORDER
        );

        expect(result.slice(0, 2)).toEqual(['notes', 'projects']);
        expect(new Set(result).size).toBe(result.length);
        expect(result).not.toContain('gone');
    });

    it('falls back to the default for anything that is not an array', () => {
        expect(resolveOrder('notes', DEFAULT_SECTION_ORDER)).toEqual([
            ...DEFAULT_SECTION_ORDER,
        ]);
    });
});

describe('sortByOrder', () => {
    it('sorts items by their position in the order', () => {
        const items = [{ id: 'b' }, { id: 'c' }, { id: 'a' }];

        expect(sortByOrder(items, ['a', 'b', 'c']).map((i) => i.id)).toEqual([
            'a',
            'b',
            'c',
        ]);
    });

    it('puts items that are not in the order last and does not mutate the input', () => {
        const items = [{ id: 'z' }, { id: 'a' }];

        expect(sortByOrder(items, ['a']).map((i) => i.id)).toEqual(['a', 'z']);
        expect(items.map((i) => i.id)).toEqual(['z', 'a']);
    });
});
