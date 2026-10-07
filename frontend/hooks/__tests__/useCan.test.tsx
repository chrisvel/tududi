import { renderHook, act } from '@testing-library/react';
import { useCan } from '../useCan';
import { useStore } from '../../store/useStore';

const setCapabilities = (
    capabilities: Parameters<
        ReturnType<
            typeof useStore.getState
        >['userSettingsStore']['setCapabilities']
    >[0]
) =>
    act(() => {
        useStore.getState().userSettingsStore.setCapabilities(capabilities);
    });

describe('useCan', () => {
    afterEach(() => setCapabilities(null));

    it('answers yes until the capabilities have loaded', () => {
        setCapabilities(null);

        const { result } = renderHook(() => useCan('create_projects'));

        expect(result.current).toBe(true);
    });

    it('follows the loaded capabilities', () => {
        setCapabilities({
            create_people: true,
            invite_members: false,
            create_projects: false,
        });

        expect(renderHook(() => useCan('create_people')).result.current).toBe(
            true
        );
        expect(renderHook(() => useCan('invite_members')).result.current).toBe(
            false
        );
        expect(renderHook(() => useCan('create_projects')).result.current).toBe(
            false
        );
    });

    it('updates when the capabilities change', () => {
        setCapabilities({
            create_people: true,
            invite_members: false,
            create_projects: true,
        });
        const { result } = renderHook(() => useCan('create_projects'));
        expect(result.current).toBe(true);

        setCapabilities({
            create_people: true,
            invite_members: false,
            create_projects: false,
        });

        expect(result.current).toBe(false);
    });
});
