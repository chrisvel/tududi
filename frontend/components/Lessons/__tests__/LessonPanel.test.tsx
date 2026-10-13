import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LessonPanel from '../LessonPanel';
import { createLesson } from '../../../utils/lessonsService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: unknown) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));
jest.mock('../../Shared/DatePicker', () => ({
    __esModule: true,
    default: ({ value }: { value: string }) => <span>{value}</span>,
}));
const toast = {
    showErrorToast: jest.fn(),
    showSuccessToast: jest.fn(),
    showUndoToast: jest.fn(),
};
jest.mock('../../Shared/ToastContext', () => ({ useToast: () => toast }));
// Store actions are stable, as in Zustand.
const mockState = {
    goalsStore: {
        goals: [{ uid: 'g1', title: 'Spanish B1' }],
        loadGoals: jest.fn(),
    },
    projectsStore: { projects: [], loadProjects: jest.fn() },
    areasStore: { areas: [], loadAreas: jest.fn() },
    tagsStore: { tags: [], loadTags: jest.fn() },
};
jest.mock('../../../store/useStore', () => ({
    useStore: (select: (state: unknown) => unknown) => select(mockState),
}));
jest.mock('../../../utils/lessonsService', () => ({
    createLesson: jest.fn(),
    updateLesson: jest.fn(),
    deleteLesson: jest.fn(),
    refreshLessons: jest.fn(),
}));

const open = () =>
    render(<LessonPanel isOpen lesson={null} onClose={jest.fn()} />);
const type = (testId: string, value: string) =>
    fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('LessonPanel (four boxes)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('has the four boxes and needs only a title', async () => {
        (createLesson as jest.Mock).mockResolvedValue({ lesson: {} });
        open();
        for (const id of [
            'lesson-expected',
            'lesson-happened',
            'lesson-if_text',
            'lesson-then_text',
        ])
            expect(screen.getByTestId(id)).toBeInTheDocument();
        type('lesson-title-input', 'Start small');
        fireEvent.change(screen.getByTestId('lesson-link-select'), {
            target: { value: 'goal:g1' },
        });
        fireEvent.click(screen.getByTestId('lesson-save-button'));
        await waitFor(() => expect(createLesson).toHaveBeenCalled());
        expect((createLesson as jest.Mock).mock.calls[0][0]).toMatchObject({
            title: 'Start small',
            if_text: null,
            then_text: null,
            links: [{ type: 'goal', uid: 'g1' }],
        });
    });

    it('refuses an if without a then before saving', () => {
        open();
        type('lesson-title-input', 'Rest');
        type('lesson-if_text', 'I am tired');
        fireEvent.click(screen.getByTestId('lesson-save-button'));
        expect(
            screen.getByText('Write both “if” and “then”, or leave both empty.')
        ).toBeInTheDocument();
        expect(createLesson).not.toHaveBeenCalled();
    });

    it('says "three is enough" after a fourth lesson on a goal, and keeps it', async () => {
        (createLesson as jest.Mock).mockResolvedValue({
            lesson: {},
            warning: 'three_is_enough',
        });
        open();
        type('lesson-title-input', 'Fourth');
        fireEvent.click(screen.getByTestId('lesson-save-button'));
        await waitFor(() => expect(toast.showSuccessToast).toHaveBeenCalled());
    });
});
