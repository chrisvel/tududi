import { mutate } from 'swr';
import { useStore } from '../../store/useStore';
import { useDailyPlanProgress } from '../../store/dailyPlanStore';
import { resetSessionState } from '../sessionReset';
import { getCsrfToken } from '../csrfService';

jest.mock('swr', () => ({
    mutate: jest.fn(),
}));

describe('resetSessionState', () => {
    it("drops the previous account's loaded data so the next login refetches it", () => {
        useStore.setState((state) => ({
            projectsStore: {
                ...state.projectsStore,
                projects: [{ id: 1, name: 'Owner project' } as any],
                hasLoaded: true,
            },
            areasStore: {
                ...state.areasStore,
                areas: [{ id: 1, name: 'Owner area' } as any],
                hasLoaded: true,
            },
            userSettingsStore: {
                ...state.userSettingsStore,
                role: 'admin' as any,
            },
        }));
        useDailyPlanProgress.getState().setProgress({ done: 1, total: 3 });

        resetSessionState();

        const state = useStore.getState();
        expect(state.projectsStore.projects).toEqual([]);
        expect(state.projectsStore.hasLoaded).toBe(false);
        expect(state.areasStore.areas).toEqual([]);
        expect(state.areasStore.hasLoaded).toBe(false);
        expect(state.userSettingsStore.role).toBeNull();
        expect(useDailyPlanProgress.getState().progress).toBeNull();
        expect(mutate).toHaveBeenCalledWith(expect.any(Function), undefined, {
            revalidate: false,
        });
    });

    it('keeps the store actions working after a reset', () => {
        resetSessionState();

        useStore
            .getState()
            .projectsStore.setProjects([{ id: 2, name: 'Mine' } as any]);

        expect(useStore.getState().projectsStore.projects).toHaveLength(1);
    });

    it("forgets the old session's CSRF token so the next login fetches a new one", async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrfToken: 'old-session' }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ csrfToken: 'new-session' }),
            });
        global.fetch = fetchMock as any;

        expect(await getCsrfToken()).toBe('old-session');
        resetSessionState();
        expect(await getCsrfToken()).toBe('new-session');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
