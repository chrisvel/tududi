import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FirstPlan from '../FirstPlan';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        i18n: { language: 'en' },
    }),
}));

const analyzeInboxText = jest.fn();
const createTask = jest.fn();
const createProject = jest.fn();
const fetchDailyPlan = jest.fn();
const saveDailyPlanItems = jest.fn();
const startDailyPlan = jest.fn();
const completeOnboarding = jest.fn();

jest.mock('../../../utils/inboxService', () => ({
    analyzeInboxText: (...args: unknown[]) => analyzeInboxText(...args),
    applyAnalysisToTask: (task: any, analysis: any) =>
        analysis?.parsed_due_date
            ? { ...task, due_date: analysis.parsed_due_date }
            : task,
}));
jest.mock('../../../utils/tasksService', () => ({
    createTask: (...args: unknown[]) => createTask(...args),
}));
jest.mock('../../../utils/projectsService', () => ({
    createProject: (...args: unknown[]) => createProject(...args),
}));
jest.mock('../../../utils/dailyPlanService', () => ({
    fetchDailyPlan: (...args: unknown[]) => fetchDailyPlan(...args),
    saveDailyPlanItems: (...args: unknown[]) => saveDailyPlanItems(...args),
    startDailyPlan: (...args: unknown[]) => startDailyPlan(...args),
}));
jest.mock('../../../utils/onboardingService', () => ({
    completeOnboarding: (...args: unknown[]) => completeOnboarding(...args),
}));

const analysis = (overrides: Record<string, unknown> = {}) => ({
    parsed_tags: [],
    parsed_projects: [],
    cleaned_content: '',
    parsed_due_date: null,
    parsed_date_text: null,
    parsed_recurrence: null,
    parsed_person: null,
    parsed_assignee: null,
    suggested_type: null,
    suggested_reason: null,
    ...overrides,
});

const typeLine = (text: string) => {
    const input = screen.getByTestId('first-plan-input');
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
};

describe('FirstPlan', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        analyzeInboxText.mockImplementation(async (text: string) =>
            analysis({ cleaned_content: text })
        );
        let n = 0;
        createTask.mockImplementation(async (task: any) => ({
            ...task,
            uid: `task-${++n}`,
        }));
        createProject.mockImplementation(async (p: any) => ({
            ...p,
            uid: 'proj-1',
        }));
        fetchDailyPlan.mockResolvedValue({ date: '2026-10-08', plan: null });
        saveDailyPlanItems.mockResolvedValue({});
        startDailyPlan.mockResolvedValue({});
        completeOnboarding.mockResolvedValue({
            onboarded_at: '2026-10-08T10:00:00.000Z',
        });
    });

    it('adds a line per Enter and ticks the prompts off', async () => {
        render(<FirstPlan onComplete={jest.fn()} />);

        expect(screen.getByTestId('first-plan-submit')).toBeDisabled();

        typeLine('Send the report');
        typeLine('Book the dentist');

        const lines = screen.getByTestId('first-plan-lines');
        expect(lines.children).toHaveLength(2);
        expect(screen.getByTestId('first-plan-submit')).toBeEnabled();
        expect(screen.getByTestId('first-plan-input')).toHaveValue('');
        await waitFor(() => expect(analyzeInboxText).toHaveBeenCalledTimes(2));
    });

    it('shows what it parsed on each line', async () => {
        analyzeInboxText.mockResolvedValueOnce(
            analysis({
                cleaned_content: 'Call the dentist',
                parsed_tags: ['home'],
                parsed_projects: ['Kitchen'],
                parsed_due_date: '2026-10-09',
            })
        );
        render(<FirstPlan onComplete={jest.fn()} />);

        typeLine('Call the dentist tomorrow #home +Kitchen');

        expect(await screen.findByText('#home')).toBeInTheDocument();
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('Call the dentist')).toBeInTheDocument();
        expect(screen.getByText(/9 Oct|Oct 9/)).toBeInTheDocument();
    });

    it('turns the lines into tasks, plans today and starts the day', async () => {
        analyzeInboxText.mockImplementation(async (text: string) =>
            text.includes('Friday')
                ? analysis({
                      cleaned_content: 'Pay the plumber',
                      parsed_due_date: '2026-10-10',
                  })
                : analysis({
                      cleaned_content: text,
                      parsed_tags: text.includes('#work') ? ['work'] : [],
                      parsed_projects: text.includes('+Move') ? ['Move'] : [],
                  })
        );
        const onComplete = jest.fn();
        render(<FirstPlan onComplete={onComplete} />);

        typeLine('Send the report #work');
        typeLine('Pack the books +Move');
        typeLine('Pay the plumber Friday');
        await waitFor(() => expect(analyzeInboxText).toHaveBeenCalledTimes(3));

        fireEvent.click(screen.getByTestId('first-plan-submit'));

        await waitFor(() =>
            expect(onComplete).toHaveBeenCalledWith('2026-10-08T10:00:00.000Z')
        );
        expect(createTask).toHaveBeenCalledTimes(3);
        expect(createTask.mock.calls[0][0]).toMatchObject({
            tags: [{ name: 'work' }],
        });
        expect(createProject).toHaveBeenCalledWith({
            name: 'Move',
            status: 'planned',
        });
        expect(createTask.mock.calls[1][0]).toMatchObject({
            project_uid: 'proj-1',
        });
        expect(createTask.mock.calls[2][0]).toMatchObject({
            due_date: '2026-10-10',
        });
        // The Friday line is a task but not part of today's plan.
        expect(saveDailyPlanItems).toHaveBeenCalledWith('2026-10-08', [
            { task_uid: 'task-1', start_minute: null, duration_minutes: 30 },
            { task_uid: 'task-2', start_minute: null, duration_minutes: 30 },
        ]);
        expect(startDailyPlan).toHaveBeenCalledWith('2026-10-08');
        expect(completeOnboarding).toHaveBeenCalledTimes(1);
    });

    it('keeps created tasks on a retry after an error', async () => {
        saveDailyPlanItems.mockRejectedValueOnce(new Error('Network down'));
        const onComplete = jest.fn();
        render(<FirstPlan onComplete={onComplete} />);

        typeLine('Send the report');
        fireEvent.click(screen.getByTestId('first-plan-submit'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Network down'
        );
        expect(onComplete).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('first-plan-submit'));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(createTask).toHaveBeenCalledTimes(1);
        expect(saveDailyPlanItems).toHaveBeenCalledTimes(2);
    });

    it('skipping only records the screen as seen', async () => {
        const onComplete = jest.fn();
        render(<FirstPlan onComplete={onComplete} />);

        fireEvent.click(screen.getByTestId('first-plan-skip'));

        await waitFor(() =>
            expect(onComplete).toHaveBeenCalledWith('2026-10-08T10:00:00.000Z')
        );
        expect(createTask).not.toHaveBeenCalled();
        expect(saveDailyPlanItems).not.toHaveBeenCalled();
    });
});
