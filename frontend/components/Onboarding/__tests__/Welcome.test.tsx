import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Welcome from '../Welcome';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string | object) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'fa', changeLanguage: jest.fn() },
    }),
}));

const applyStarter = jest.fn();
jest.mock('../../../utils/onboardingService', () => ({
    applyStarter: (...args: unknown[]) => applyStarter(...args),
}));
const updateUiSettings = jest.fn();
const updateProfile = jest.fn();
jest.mock('../../../utils/profileService', () => ({
    updateUiSettings: (...args: unknown[]) => updateUiSettings(...args),
    updateProfile: (...args: unknown[]) => updateProfile(...args),
}));
const fetchAreas = jest.fn();
const createArea = jest.fn();
jest.mock('../../../utils/areasService', () => ({
    fetchAreas: () => fetchAreas(),
    createArea: (...args: unknown[]) => createArea(...args),
}));
const createGoal = jest.fn();
jest.mock('../../../utils/goalsService', () => ({
    createGoal: (...args: unknown[]) => createGoal(...args),
}));
const createTask = jest.fn();
jest.mock('../../../utils/tasksService', () => ({
    createTask: (...args: unknown[]) => createTask(...args),
}));
const saveDailyPlanItems = jest.fn();
const startDailyPlan = jest.fn();
jest.mock('../../../utils/dailyPlanService', () => ({
    saveDailyPlanItems: (...args: unknown[]) => saveDailyPlanItems(...args),
    startDailyPlan: (...args: unknown[]) => startDailyPlan(...args),
}));
const saveWorkHours = jest.fn();
jest.mock('../../../utils/todayService', () => ({
    saveWorkHours: (...args: unknown[]) => saveWorkHours(...args),
}));

const result = {
    onboarding_starter: 'empty',
    onboarded_at: '2026-10-09T08:00:00.000Z',
    created: { areas: 0, goals: 0, projects: 0, tasks: 0, habits: 0, notes: 0 },
};

describe('Welcome (three skippable steps)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        applyStarter.mockResolvedValue(result);
        fetchAreas.mockResolvedValue([]);
        createArea.mockResolvedValue({ id: 7, name: 'Health' });
        createGoal
            .mockResolvedValueOnce({ goal: { uid: 'vision1' } })
            .mockResolvedValueOnce({ goal: { uid: 'season1' } });
        createTask.mockResolvedValue({ uid: 'task1', name: 'Call mom' });
        updateUiSettings.mockResolvedValue({});
        updateProfile.mockResolvedValue({});
    });

    it('defaults to Persian, Jalali and Persian digits, with no PWA or notification prompt', () => {
        render(<Welcome onDone={jest.fn()} />);
        expect(screen.getByTestId('welcome-language')).toHaveValue('fa');
        expect(screen.getByTestId('welcome-calendar')).toHaveValue('persian');
        expect(screen.getByTestId('welcome-persian-digits')).toBeChecked();
        expect(screen.queryByText(/install/i)).toBeNull();
        expect(screen.queryByText(/notification/i)).toBeNull();
    });

    it('walks the three steps to a started day with one task', async () => {
        const onDone = jest.fn();
        render(<Welcome onDone={onDone} />);

        fireEvent.click(screen.getByTestId('welcome-next-1'));
        await screen.findByTestId('welcome-step-2');
        expect(updateUiSettings).toHaveBeenCalledWith({
            locale: { calendarSystem: 'persian', latinDigits: false },
        });
        expect(updateProfile).toHaveBeenCalledWith({ language: 'fa' });

        // Empty Areas: three suggestions.
        await waitFor(() =>
            expect(screen.getAllByTestId('welcome-area-option')).toHaveLength(3)
        );
        fireEvent.change(screen.getByTestId('welcome-goal'), {
            target: { value: 'Run 5k' },
        });
        fireEvent.change(screen.getByTestId('welcome-vision'), {
            target: { value: 'A healthy life' },
        });
        fireEvent.click(screen.getAllByTestId('welcome-area-option')[0]);
        fireEvent.click(screen.getByTestId('welcome-next-2'));
        await screen.findByTestId('welcome-step-3');
        expect(createArea).toHaveBeenCalledWith({ name: 'Health' });
        expect(createGoal).toHaveBeenNthCalledWith(1, {
            title: 'A healthy life',
            horizon: 'vision',
        });
        expect(createGoal).toHaveBeenNthCalledWith(2, {
            title: 'Run 5k',
            horizon: 'season',
            area_id: 7,
            parent_goal_uid: 'vision1',
        });

        fireEvent.change(screen.getByTestId('welcome-work-start'), {
            target: { value: '08:30' },
        });
        fireEvent.change(screen.getByTestId('welcome-task'), {
            target: { value: 'Call mom' },
        });
        fireEvent.click(screen.getByTestId('welcome-finish'));

        await waitFor(() => expect(onDone).toHaveBeenCalledWith(result));
        expect(saveWorkHours).toHaveBeenCalledWith({ start: 510, end: 1020 });
        expect(saveDailyPlanItems).toHaveBeenCalledWith('today', [
            { task_uid: 'task1', start_minute: null, duration_minutes: 30 },
        ]);
        expect(startDailyPlan).toHaveBeenCalledWith('today');
    });

    it('lets every step be skipped and creates nothing', async () => {
        const onDone = jest.fn();
        render(<Welcome onDone={onDone} />);
        fireEvent.click(screen.getByText('Skip'));
        await screen.findByTestId('welcome-step-2');
        fireEvent.click(screen.getByText('Skip'));
        await screen.findByTestId('welcome-step-3');
        fireEvent.click(screen.getByText('Skip'));
        await waitFor(() => expect(onDone).toHaveBeenCalledWith(result));
        expect(createGoal).not.toHaveBeenCalled();
        expect(createTask).not.toHaveBeenCalled();
        expect(applyStarter).toHaveBeenCalledWith({ key: 'empty' });
    });

    it('Skip setup records the visit at once and shows errors', async () => {
        applyStarter.mockRejectedValueOnce(new Error('Network down'));
        const onDone = jest.fn();
        render(<Welcome onDone={onDone} />);
        fireEvent.click(screen.getByTestId('welcome-start'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Network down'
        );
        expect(onDone).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('welcome-start'));
        await waitFor(() => expect(onDone).toHaveBeenCalledWith(result));
    });
});
