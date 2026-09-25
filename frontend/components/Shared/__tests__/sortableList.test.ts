import { mergeVisibleOrder } from '../sortableList';

describe('mergeVisibleOrder', () => {
    it('reorders the visible items within their own slots', () => {
        expect(
            mergeVisibleOrder(['a', 'b', 'c', 'd', 'e'], ['d', 'b'])
        ).toEqual(['a', 'd', 'c', 'b', 'e']);
    });

    it('returns the visible order when everything is visible', () => {
        expect(mergeVisibleOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([
            'c',
            'a',
            'b',
        ]);
    });
});
