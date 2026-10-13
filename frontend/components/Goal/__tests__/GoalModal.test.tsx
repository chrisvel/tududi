import React from 'react';
import {
    render,
    screen,
    fireEvent,
    act,
    waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import GoalModal from '../GoalModal';
import { createGoal } from '../../../utils/goalsService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en' },
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/goalsService', () => ({
    createGoal: jest.fn(),
    updateGoal: jest.fn(),
}));

jest.mock('../../../store/useStore', () => {
    const state: any = {
        areasStore: { areas: [{ id: 1, name: 'Home' }] },
        goalsStore: {
            goals: [],
            loadGoals: jest.fn(),
            setGoals: jest.fn(),
        },
    };
    const useStore: any = (selector: (s: any) => any) => selector(state);
    useStore.getState = () => state;
    return { useStore };
});

const renderPanel = (isOpen = true) => {
    const onClose = jest.fn();
    render(
        <MemoryRouter>
            <GoalModal isOpen={isOpen} onClose={onClose} />
        </MemoryRouter>
    );
    return { onClose };
};

describe('GoalModal', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });
    afterEach(() => jest.useRealTimers());

    it('shows the create fields and the area list', () => {
        renderPanel();
        expect(screen.getByTestId('goal-title-input')).toBeInTheDocument();
        expect(
            screen.getByRole('option', { name: 'Home' })
        ).toBeInTheDocument();
    });

    it('does not save without a title', () => {
        renderPanel();
        // The required attribute stops the form before it submits
        expect(screen.getByTestId('goal-title-input')).toBeRequired();
        fireEvent.click(screen.getByTestId('goal-save-button'));
        expect(createGoal).not.toHaveBeenCalled();
    });

    it('creates the goal and closes', async () => {
        (createGoal as jest.Mock).mockResolvedValue({
            goal: { uid: 'g-1', title: 'Run a half marathon' },
        });
        const { onClose } = renderPanel();

        fireEvent.change(screen.getByTestId('goal-title-input'), {
            target: { value: 'Run a half marathon' },
        });
        fireEvent.click(screen.getByTestId('goal-save-button'));

        await waitFor(() =>
            expect(createGoal).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Run a half marathon' })
            )
        );
        await act(async () => {
            jest.advanceTimersByTime(500);
        });
        expect(onClose).toHaveBeenCalled();
    });
});
