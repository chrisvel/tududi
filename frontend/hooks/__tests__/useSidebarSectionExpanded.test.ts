import { act, renderHook } from '@testing-library/react';
import { useSidebarSectionExpanded } from '../useSidebarSectionExpanded';

describe('useSidebarSectionExpanded', () => {
    beforeEach(() => localStorage.clear());

    it('starts collapsed', () => {
        const { result } = renderHook(() =>
            useSidebarSectionExpanded('projects')
        );
        expect(result.current[0]).toBe(false);
    });

    it('remembers an expanded section for the next time it mounts', () => {
        const first = renderHook(() => useSidebarSectionExpanded('projects'));
        act(() => first.result.current[1]((v) => !v));
        expect(first.result.current[0]).toBe(true);
        first.unmount();

        const again = renderHook(() => useSidebarSectionExpanded('projects'));
        expect(again.result.current[0]).toBe(true);

        const other = renderHook(() => useSidebarSectionExpanded('tags'));
        expect(other.result.current[0]).toBe(false);
    });

    it('still works when storage is unavailable', () => {
        const setItem = jest
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        const { result } = renderHook(() => useSidebarSectionExpanded('areas'));
        act(() => result.current[1](true));
        expect(result.current[0]).toBe(true);
        setItem.mockRestore();
    });
});
