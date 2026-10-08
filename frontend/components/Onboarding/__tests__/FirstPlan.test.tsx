import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
import FirstPlan from '../FirstPlan';

const WhereAmI: React.FC = () => {
    const location = useLocation();
    return <span data-testid="where">{location.pathname}</span>;
};

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
const carryOverTasks = jest.fn();
const emitCaptureSaved = jest.fn();
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
    carryOverTasks: (...args: unknown[]) => carryOverTasks(...args),
}));
jest.mock('../../../utils/captureUi', () => ({
    emitCaptureSaved: (...args: unknown[]) => emitCaptureSaved(...args),
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

const onClose = jest.fn();

const renderPlan = (
    onComplete = jest.fn(),
    firstVisit = true,
    path = '/today'
) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <FirstPlan
                open
                firstVisit={firstVisit}
                onClose={onClose}
                onComplete={onComplete}
            />
            <WhereAmI />
        </MemoryRouter>
    );

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
        carryOverTasks.mockResolvedValue({});
        completeOnboarding.mockResolvedValue({
            onboarded_at: '2026-10-08T10:00:00.000Z',
        });
    });

    it('adds a line per Enter and ticks the prompts off', async () => {
        renderPlan();

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
        renderPlan();

        typeLine('Call the dentist tomorrow #home +Kitchen');

        expect(await screen.findByText('#home')).toBeInTheDocument();
        expect(screen.getByText('Kitchen')).toBeInTheDocument();
        expect(screen.getByText('Call the dentist')).toBeInTheDocument();
        expect(screen.getByText(/9 Oct|Oct 9/)).toBeInTheDocument();
    });

    it('turns the lines into tasks, adds them to today and opens the planner', async () => {
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
        renderPlan(onComplete);

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
        expect(carryOverTasks).toHaveBeenCalledWith('2026-10-08', [
            'task-1',
            'task-2',
        ]);
        expect(completeOnboarding).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('where')).toHaveTextContent('/today/plan');
        expect(emitCaptureSaved).not.toHaveBeenCalled();
    });

    it('keeps created tasks on a retry after an error', async () => {
        carryOverTasks.mockRejectedValueOnce(new Error('Network down'));
        const onComplete = jest.fn();
        renderPlan(onComplete);

        typeLine('Send the report');
        fireEvent.click(screen.getByTestId('first-plan-submit'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Network down'
        );
        expect(onComplete).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('first-plan-submit'));

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(createTask).toHaveBeenCalledTimes(1);
        expect(carryOverTasks).toHaveBeenCalledTimes(2);
    });

    it('skipping only records the screen as seen', async () => {
        const onComplete = jest.fn();
        renderPlan(onComplete);

        fireEvent.click(screen.getByTestId('first-plan-skip'));

        await waitFor(() =>
            expect(onComplete).toHaveBeenCalledWith('2026-10-08T10:00:00.000Z')
        );
        expect(createTask).not.toHaveBeenCalled();
        expect(carryOverTasks).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('hands the tasks to the planner when it is already open', async () => {
        const onComplete = jest.fn();
        renderPlan(onComplete, false, '/today/plan');

        typeLine('Send the report');
        fireEvent.click(screen.getByTestId('first-plan-submit'));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(carryOverTasks).not.toHaveBeenCalled();
        expect(emitCaptureSaved).toHaveBeenCalledWith({
            scope: 'today',
            undone: false,
            items: [
                { target: 'task', uid: 'task-1', title: 'Send the report' },
            ],
        });
        expect(screen.getByTestId('where')).toHaveTextContent('/today/plan');
    });

    it('closing it on the first visit also counts as skipping', async () => {
        const onComplete = jest.fn();
        renderPlan(onComplete);

        fireEvent.keyDown(window, { key: 'Escape' });

        await waitFor(() => expect(onComplete).toHaveBeenCalled());
        expect(completeOnboarding).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalled();
    });

    it('renders nothing while closed', () => {
        render(
            <MemoryRouter>
                <FirstPlan
                    open={false}
                    firstVisit
                    onClose={onClose}
                    onComplete={jest.fn()}
                />
            </MemoryRouter>
        );
        expect(screen.queryByTestId('first-plan-input')).toBeNull();
    });

    it('reopened later it adds to the day without touching onboarding', async () => {
        const onComplete = jest.fn();
        renderPlan(onComplete, false);

        expect(screen.getByText('Brain dump')).toBeInTheDocument();
        typeLine('Send the report');
        fireEvent.click(screen.getByTestId('first-plan-submit'));

        await waitFor(() => expect(carryOverTasks).toHaveBeenCalled());
        expect(completeOnboarding).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
    });
});
