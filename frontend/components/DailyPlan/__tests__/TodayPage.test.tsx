import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TodayPage from '../TodayPage';
import DurationChips from '../DurationChips';
import {
    fetchDailyPlan,
    fetchPlanCandidates,
    saveDailyPlanItems,
} from '../../../utils/dailyPlanService';
import {
    fetchCalendarEvents,
    fetchCalendarFeeds,
} from '../../../utils/calendarFeedsService';

// A stable t, like i18next's: the page reloads when t changes.
jest.mock('react-i18next', () => {
    const t = (
        _key: string,
        fallback: string | Record<string, unknown>,
        values?: Record<string, unknown>
    ) => {
        const options = typeof fallback === 'object' ? fallback : values;
        const text =
            typeof fallback === 'string'
                ? fallback
                : String(fallback?.defaultValue ?? _key);
        return text.replace(/{{(\w+)}}/g, (_m, name) =>
            String(options?.[name] ?? '')
        );
    };
    const i18n = { language: 'en' };
    return { useTranslation: () => ({ t, i18n }) };
});

jest.mock('react-router-dom', () => ({
    Link: ({ children, to, ...rest }: any) => (
        <a href={to} {...rest}>
            {children}
        </a>
    ),
}));

jest.mock('../../Task/TaskRow', () => ({
    __esModule: true,
    default: ({ task, onTaskUpdate, onTaskCompletionToggle }: any) => (
        <div data-testid="task-row">
            {task.name}
            <button
                data-testid={`complete-${task.uid}`}
                onClick={() =>
                    onTaskCompletionToggle({
                        ...task,
                        status: 0,
                        due_date: '2026-10-01',
                    })
                }
            />
            <button
                data-testid={`move-${task.uid}`}
                onClick={() =>
                    onTaskUpdate({ ...task, due_date: '2026-10-01' })
                }
            />
        </div>
    ),
}));

let mockCalendarEnabled = true;
jest.mock('../../../store/useStore', () => ({
    useStore: (selector: any) =>
        selector({
            projectsStore: { projects: [] },
            userSettingsStore: {
                aiAssistantEnabled: false,
                calendarEnabled: mockCalendarEnabled,
            },
        }),
}));

const mockShowUndoToast = jest.fn();
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showErrorToast: jest.fn(),
        showSuccessToast: jest.fn(),
        showUndoToast: mockShowUndoToast,
    }),
}));

jest.mock('../../../utils/dateUtils', () => ({
    getUserTimezone: () => 'UTC',
}));

jest.mock('../../../utils/tasksService', () => ({
    toggleTaskCompletion: jest.fn(),
}));

jest.mock('../../../utils/dailyPlanService', () => ({
    ...jest.requireActual('../../../utils/dailyPlanService'),
    fetchDailyPlan: jest.fn(),
    fetchPlanCandidates: jest.fn(),
    saveDailyPlanItems: jest.fn(),
}));

jest.mock('../../../utils/calendarFeedsService', () => ({
    fetchCalendarFeeds: jest.fn(),
    fetchCalendarEvents: jest.fn(),
}));

const candidates = {
    in_progress: [],
    overdue: [{ uid: 'o1', name: 'Renew insurance', status: 0 }],
    due_today: [],
    suggested: [],
    inbox: [],
    inbox_count: 4,
};

describe('TodayPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCalendarEnabled = true;
        (fetchPlanCandidates as jest.Mock).mockResolvedValue(candidates);
        (fetchCalendarFeeds as jest.Mock).mockResolvedValue([]);
        (fetchCalendarEvents as jest.Mock).mockResolvedValue({
            events: [],
            errors: [],
        });
    });

    it('asks you to plan when today has no started plan', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: null,
        });

        render(<TodayPage />);

        expect(
            await screen.findByText("You haven't planned today yet")
        ).toBeInTheDocument();
        expect(screen.getByTestId('plan-your-day')).toHaveAttribute(
            'href',
            '/today/plan'
        );
        expect(
            screen.queryByText('Skip and show everything')
        ).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
    });

    it('offers to connect a calendar when the Calendar feature is on', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: null,
        });

        render(<TodayPage />);

        expect(
            await screen.findByText('Connect a calendar')
        ).toBeInTheDocument();
    });

    it('leaves calendars out when the Calendar feature is off', async () => {
        mockCalendarEnabled = false;
        (fetchCalendarFeeds as jest.Mock).mockResolvedValue([
            { uid: 'f1', name: 'Work' },
        ]);
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: null,
        });

        render(<TodayPage />);

        await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
        expect(fetchCalendarFeeds).not.toHaveBeenCalled();
        expect(fetchCalendarEvents).not.toHaveBeenCalled();
        expect(
            screen.queryByText('Connect a calendar')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('From your calendar')
        ).not.toBeInTheDocument();
    });

    it('leaves out calendars switched off in Profile', async () => {
        (fetchCalendarFeeds as jest.Mock).mockResolvedValue([
            { uid: 'f1', name: 'Work', show_on_calendar: false },
        ]);
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: null,
        });

        render(<TodayPage />);

        await waitFor(() => expect(fetchCalendarFeeds).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
        expect(fetchCalendarEvents).not.toHaveBeenCalled();
        expect(
            screen.queryByText('From your calendar')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('Connect a calendar')
        ).not.toBeInTheDocument();
    });

    it('offers to continue a draft plan', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: {
                uid: 'p',
                date: '2026-09-24',
                started_at: null,
                items: [
                    {
                        task_uid: 't1',
                        position: 0,
                        start_minute: 600,
                        duration_minutes: 30,
                        task: { uid: 't1', name: 'Write spec', status: 0 },
                    },
                ],
            },
        });

        render(<TodayPage />);

        expect(
            await screen.findByText('Continue planning')
        ).toBeInTheDocument();
    });

    it('warns about a timed task whose slot has passed', async () => {
        jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval'] });
        jest.setSystemTime(new Date('2026-09-24T12:00:00Z'));
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: {
                uid: 'p',
                date: '2026-09-24',
                started_at: '2026-09-24T06:00:00Z',
                items: [
                    {
                        task_uid: 'late',
                        position: 0,
                        start_minute: 480,
                        duration_minutes: 30,
                        task: { uid: 'late', name: 'Missed it', status: 0 },
                    },
                    {
                        task_uid: 'done',
                        position: 1,
                        start_minute: 540,
                        duration_minutes: 30,
                        task: { uid: 'done', name: 'Did it', status: 2 },
                    },
                    {
                        task_uid: 'later',
                        position: 2,
                        start_minute: 900,
                        duration_minutes: 30,
                        task: { uid: 'later', name: 'Not yet', status: 0 },
                    },
                ],
            },
        });

        render(<TodayPage />);

        expect(await screen.findByTestId('late-late')).toBeInTheDocument();
        expect(screen.queryByTestId('late-done')).not.toBeInTheDocument();
        expect(screen.queryByTestId('late-later')).not.toBeInTheDocument();
        const order = Array.from(
            screen.getByTestId('agenda-list').children
        ).map((el) => el.getAttribute('data-testid'));
        expect(order).toEqual([
            'agenda-task-late',
            'agenda-task-done',
            'now-marker',
            'agenda-task-later',
        ]);
        jest.useRealTimers();
    });

    it('shows only the plan once the day is started', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: {
                uid: 'p',
                date: '2026-09-24',
                started_at: '2026-09-24T06:00:00Z',
                items: [
                    {
                        task_uid: 't1',
                        position: 0,
                        start_minute: null,
                        duration_minutes: 60,
                        task: { uid: 't1', name: 'Write spec', status: 0 },
                    },
                    {
                        task_uid: 't2',
                        position: 1,
                        start_minute: null,
                        duration_minutes: 30,
                        task: { uid: 't2', name: 'Pay invoice', status: 2 },
                    },
                ],
            },
        });

        render(<TodayPage />);

        expect(await screen.findByTestId('now-card')).toHaveTextContent(
            'Write spec'
        );
        expect(screen.getByText('1 of 2 done · 1h left')).toBeInTheDocument();
        expect(screen.queryByTestId('today-unplanned')).not.toBeInTheDocument();
        expect(
            await screen.findByTestId('not-planned-toggle')
        ).toHaveTextContent('Not planned (1)');
    });

    const startedPlan = (items: any[]) => ({
        date: '2026-09-24',
        plan: {
            uid: 'p',
            date: '2026-09-24',
            started_at: '2026-09-24T06:00:00Z',
            items: items.map((item, position) => ({
                position,
                start_minute: null,
                duration_minutes: 30,
                ...item,
            })),
        },
    });

    it('shows a recurring task completed today as done', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue(
            startedPlan([
                {
                    task_uid: 'r1',
                    occurrence_done: true,
                    task: {
                        uid: 'r1',
                        name: 'Water plants',
                        status: 0,
                        recurrence_type: 'daily',
                        due_date: '2026-09-25',
                    },
                },
                {
                    task_uid: 't1',
                    task: { uid: 't1', name: 'Write spec', status: 0 },
                },
            ])
        );

        render(<TodayPage />);

        const row = await screen.findByTestId('occurrence-done-r1');
        expect(row).toHaveTextContent('Water plants');
        expect(row).toHaveTextContent('Next on Sep 25');
        expect(screen.getByText('1 of 2 done · 30m left')).toBeInTheDocument();
    });

    it('marks the day done when a recurring task moves on', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue(
            startedPlan([
                {
                    task_uid: 'r1',
                    task: {
                        uid: 'r1',
                        name: 'Water plants',
                        status: 0,
                        recurrence_type: 'daily',
                        due_date: '2026-09-24',
                    },
                },
            ])
        );

        render(<TodayPage />);

        fireEvent.click(await screen.findByTestId('complete-r1'));

        expect(
            await screen.findByTestId('occurrence-done-r1')
        ).toBeInTheDocument();
        expect(screen.getByText('1 of 1 done')).toBeInTheDocument();
        expect(saveDailyPlanItems).not.toHaveBeenCalled();
    });

    it('marks the day done when a planned habit is checked in', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue(
            startedPlan([
                {
                    task_uid: 'h1',
                    task: {
                        uid: 'h1',
                        name: 'Stretch',
                        status: 0,
                        habit_mode: true,
                        recurrence_type: 'daily',
                        habit_frequency_period: 'weekly',
                        habit_target_count: 3,
                        habit_progress: {
                            period_start: '2026-09-21',
                            period_end: '2026-09-27',
                            today: '2026-09-24',
                            first_day: '2026-09-01',
                            progress: 1,
                            check_ins: 1,
                            today_check_ins: 1,
                            goal: 3,
                            met: false,
                            skipped: false,
                            scheduled_today: true,
                            multiple_per_day: false,
                        },
                    },
                },
            ])
        );

        render(<TodayPage />);

        fireEvent.click(await screen.findByTestId('complete-h1'));

        expect(
            await screen.findByTestId('occurrence-done-h1')
        ).toBeInTheDocument();
        expect(screen.getByText('1 of 1 done')).toBeInTheDocument();
    });

    it('takes a task off the plan when its due date moves later', async () => {
        const plan = startedPlan([
            {
                task_uid: 't1',
                task: {
                    uid: 't1',
                    name: 'Write spec',
                    status: 0,
                    due_date: '2026-09-24',
                },
            },
            {
                task_uid: 't2',
                task: { uid: 't2', name: 'Pay invoice', status: 0 },
            },
        ]);
        (fetchDailyPlan as jest.Mock).mockResolvedValue(plan);
        (saveDailyPlanItems as jest.Mock).mockResolvedValue(
            startedPlan([plan.plan.items[1]])
        );

        render(<TodayPage />);

        fireEvent.click(await screen.findByTestId('move-t1'));

        await waitFor(() =>
            expect(saveDailyPlanItems).toHaveBeenCalledWith('2026-09-24', [
                { task_uid: 't2', start_minute: null, duration_minutes: 30 },
            ])
        );
        expect(screen.queryByTestId('agenda-task-t1')).not.toBeInTheDocument();
        expect(mockShowUndoToast).toHaveBeenCalledWith(
            "'Write spec' is no longer due today, so it left today's plan.",
            expect.any(Function)
        );
    });

    it('keeps a task on the plan when its due date was already later', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue(
            startedPlan([
                {
                    task_uid: 't1',
                    task: {
                        uid: 't1',
                        name: 'Write spec',
                        status: 0,
                        due_date: '2026-09-28',
                    },
                },
            ])
        );

        render(<TodayPage />);

        fireEvent.click(await screen.findByTestId('move-t1'));

        expect(screen.getByTestId('agenda-task-t1')).toBeInTheDocument();
        expect(saveDailyPlanItems).not.toHaveBeenCalled();
    });

    it('lets you drag the Anytime tasks but not the timed ones', async () => {
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: {
                uid: 'p',
                date: '2026-09-24',
                started_at: '2026-09-24T06:00:00Z',
                items: [
                    {
                        task_uid: 'timed',
                        position: 0,
                        start_minute: 600,
                        duration_minutes: 30,
                        task: { uid: 'timed', name: 'Standup', status: 0 },
                    },
                    {
                        task_uid: 'a1',
                        position: 1,
                        start_minute: null,
                        duration_minutes: 30,
                        task: { uid: 'a1', name: 'Write spec', status: 0 },
                    },
                    {
                        task_uid: 'a2',
                        position: 2,
                        start_minute: null,
                        duration_minutes: 30,
                        task: { uid: 'a2', name: 'Pay invoice', status: 0 },
                    },
                ],
            },
        });

        render(<TodayPage />);

        expect(
            await screen.findByTestId('sortable-agenda-task-a1')
        ).toHaveAttribute('aria-roledescription', 'sortable task');
        expect(
            screen.getByTestId('sortable-agenda-task-a2')
        ).toBeInTheDocument();
        expect(
            screen.queryByTestId('sortable-agenda-task-timed')
        ).not.toBeInTheDocument();
    });
});

describe('DurationChips', () => {
    it('marks the selected length and reports clicks', () => {
        const onChange = jest.fn();
        render(<DurationChips value={30} onChange={onChange} />);

        expect(screen.getByRole('radio', { name: '30m' })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        fireEvent.click(screen.getByRole('radio', { name: '2h' }));
        expect(onChange).toHaveBeenCalledWith(120);
    });
});
