import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import FocusChip from '../FocusChip';
import { useStore } from '../../../store/useStore';
import { updateUiSettings } from '../../../utils/profileService';
import type { Area } from '../../../entities/Area';
import type { Project } from '../../../entities/Project';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (
            key: string,
            fallback?: string,
            values?: Record<string, string | number>
        ) =>
            (fallback || key).replace(/\{\{(\w+)\}\}/g, (_, name) =>
                String(values?.[name] ?? '')
            ),
    }),
}));

jest.mock('../../../utils/profileService', () => ({
    updateUiSettings: jest.fn(),
}));

jest.mock('../../Tag/TagInput', () => ({
    __esModule: true,
    default: ({
        initialTags,
        onTagsChange,
    }: {
        initialTags: string[];
        onTagsChange: (tags: string[]) => void;
    }) => (
        <input
            data-testid="focus-tags"
            value={initialTags.join(',')}
            onChange={(event) =>
                onTagsChange(event.target.value.split(',').filter(Boolean))
            }
        />
    ),
}));

describe('FocusChip', () => {
    beforeEach(() => {
        (updateUiSettings as jest.Mock)
            .mockReset()
            .mockResolvedValue({ success: true });
        const state = useStore.getState();
        state.areasStore.setAreas([
            { id: 1, uid: 'work', name: 'Work' },
            { id: 2, uid: 'home', name: 'Home' },
        ] as Area[]);
        state.projectsStore.setProjects([
            { id: 10, uid: 'launch', name: 'Launch', area_uid: 'work' },
            { id: 11, uid: 'garden', name: 'Garden', area_uid: 'home' },
        ] as unknown as Project[]);
        state.userSettingsStore.setFocus(null);
    });

    it('reads "Focus" without a scope and names the scope when one is set', () => {
        const { rerender } = render(<FocusChip />);
        expect(screen.getByTestId('focus-chip')).toHaveTextContent('Focus');
        expect(screen.queryByTestId('focus-chip-clear')).toBeNull();

        act(() => {
            useStore.getState().userSettingsStore.setFocus({
                area_uid: 'work',
                project_uid: 'launch',
                tags: ['urgent'],
            });
        });
        rerender(<FocusChip />);
        expect(screen.getByTestId('focus-chip')).toHaveTextContent(
            'Work › Launch · #urgent'
        );
        expect(screen.getByTestId('focus-chip-clear')).toBeInTheDocument();
    });

    it('saves the picked area, project and tags', async () => {
        render(<FocusChip />);
        fireEvent.click(screen.getByTestId('focus-chip'));
        fireEvent.change(screen.getByTestId('focus-area'), {
            target: { value: 'work' },
        });
        // Only projects of the chosen area are offered
        expect(
            Array.from(
                (screen.getByTestId('focus-project') as HTMLSelectElement)
                    .options
            ).map((option) => option.value)
        ).toEqual(['', 'launch']);
        fireEvent.change(screen.getByTestId('focus-project'), {
            target: { value: 'launch' },
        });
        fireEvent.change(screen.getByTestId('focus-tags'), {
            target: { value: 'urgent' },
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId('focus-apply'));
        });

        expect(updateUiSettings).toHaveBeenCalledWith({
            focus: {
                area_uid: 'work',
                project_uid: 'launch',
                tags: ['urgent'],
            },
        });
        expect(useStore.getState().userSettingsStore.focus).toEqual({
            area_uid: 'work',
            project_uid: 'launch',
            tags: ['urgent'],
        });
        expect(screen.queryByTestId('focus-popover')).toBeNull();
    });

    it('clears the focus from the chip', async () => {
        useStore.getState().userSettingsStore.setFocus({ area_uid: 'work' });
        render(<FocusChip />);
        await act(async () => {
            fireEvent.click(screen.getByTestId('focus-chip-clear'));
        });
        expect(updateUiSettings).toHaveBeenCalledWith({ focus: null });
        expect(useStore.getState().userSettingsStore.focus).toBeNull();
    });

    it('puts the previous focus back when saving fails', async () => {
        (updateUiSettings as jest.Mock).mockRejectedValue(new Error('down'));
        useStore.getState().userSettingsStore.setFocus({ area_uid: 'work' });
        render(<FocusChip />);
        fireEvent.click(screen.getByTestId('focus-chip'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('focus-clear'));
        });
        expect(useStore.getState().userSettingsStore.focus).toEqual({
            area_uid: 'work',
        });
        expect(screen.getByTestId('focus-popover')).toHaveTextContent(
            'Could not save the focus.'
        );
    });
});
