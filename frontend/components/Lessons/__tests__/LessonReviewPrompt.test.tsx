import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SWRConfig } from 'swr';
import LessonReviewPrompt from '../LessonReviewPrompt';
import { fetchDueLesson, reviewLesson } from '../../../utils/lessonsService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, a?: unknown) => {
            const options = (typeof a === 'object' ? a : {}) as Record<
                string,
                string
            >;
            const text =
                typeof a === 'string' ? a : (options.defaultValue ?? key);
            return text.replace(/{{(\w+)}}/g, (_, n) => options[n] ?? '');
        },
    }),
}));
const toast = { showErrorToast: jest.fn(), showUndoToast: jest.fn() };
jest.mock('../../Shared/ToastContext', () => ({ useToast: () => toast }));
jest.mock('../../../utils/lessonsService', () => ({
    ...jest.requireActual('../../../utils/lessonsService'),
    fetchDueLesson: jest.fn(),
    reviewLesson: jest.fn(),
    refreshLessons: jest.fn(),
}));

const renderPrompt = () =>
    render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <LessonReviewPrompt />
        </SWRConfig>
    );

describe('LessonReviewPrompt (one question a day)', () => {
    it('asks about one lesson and records the answer with Undo', async () => {
        (fetchDueLesson as jest.Mock).mockResolvedValue({
            uid: 'l1',
            title: 'Short sessions',
            if_text: 'I sit down',
            then_text: 'I set a timer',
        });
        (reviewLesson as jest.Mock).mockResolvedValue({ journal_uid: 'j1' });
        renderPrompt();
        expect(await screen.findByTestId('lesson-review')).toHaveTextContent(
            'If I sit down, then I set a timer.'
        );
        expect(screen.getAllByTestId('lesson-review')).toHaveLength(1);
        fireEvent.click(screen.getByTestId('lesson-review-holds'));
        await waitFor(() =>
            expect(reviewLesson).toHaveBeenCalledWith('l1', 'holds')
        );
        expect(toast.showUndoToast).toHaveBeenCalled();
    });

    it('shows nothing when no lesson is due', async () => {
        (fetchDueLesson as jest.Mock).mockResolvedValue(null);
        const { container } = renderPrompt();
        await waitFor(() => expect(fetchDueLesson).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
