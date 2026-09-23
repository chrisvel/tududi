import { resolveViewFilters } from '../searchService';

describe('resolveViewFilters', () => {
    it('defaults to Task-only when a view has no entity-type filter configured', () => {
        expect(resolveViewFilters([])).toEqual(['Task']);
        expect(resolveViewFilters(null)).toEqual(['Task']);
        expect(resolveViewFilters(undefined)).toEqual(['Task']);
    });

    it('keeps the view filters as-is when they are set', () => {
        expect(resolveViewFilters(['Project'])).toEqual(['Project']);
        expect(resolveViewFilters(['Task', 'Note'])).toEqual(['Task', 'Note']);
    });
});
