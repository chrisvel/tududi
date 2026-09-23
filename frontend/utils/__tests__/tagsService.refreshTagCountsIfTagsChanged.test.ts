import { refreshTagCountsIfTagsChanged } from '../tagsService';
import { useStore } from '../../store/useStore';

jest.mock('../../store/useStore', () => ({
    useStore: { getState: jest.fn() },
}));

describe('refreshTagCountsIfTagsChanged', () => {
    let refreshTags: jest.Mock;

    beforeEach(() => {
        refreshTags = jest.fn().mockResolvedValue(undefined);
        (useStore.getState as jest.Mock).mockReturnValue({
            tagsStore: { refreshTags },
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('refreshes tag counts when the payload includes tags', () => {
        refreshTagCountsIfTagsChanged({ tags: [{ name: 'work' }] });

        expect(refreshTags).toHaveBeenCalledTimes(1);
    });

    it('refreshes tag counts when called with no payload (e.g. after a delete)', () => {
        refreshTagCountsIfTagsChanged();

        expect(refreshTags).toHaveBeenCalledTimes(1);
    });

    it('does not refresh tag counts when the payload omits tags entirely', () => {
        refreshTagCountsIfTagsChanged({ status: 'done' } as any);

        expect(refreshTags).not.toHaveBeenCalled();
    });

    it('swallows refresh errors instead of throwing', () => {
        refreshTags.mockRejectedValue(new Error('network error'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        expect(() =>
            refreshTagCountsIfTagsChanged({ tags: [] })
        ).not.toThrow();
    });
});
