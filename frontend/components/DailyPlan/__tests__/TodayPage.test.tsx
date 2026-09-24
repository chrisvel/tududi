import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TodayPage from '../TodayPage';
import DurationChips from '../DurationChips';
import {
    fetchDailyPlan,
    fetchPlanCandidates,
} from '../../../utils/dailyPlanService';
import {
    fetchCalendarEvents,
    fetchCalendarFeeds,
} from '../../../utils/calendarFeedsService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (
            _key: string,
            fallback: string,
            values?: Record<string, unknown>
        ) =>
            fallback.replace(/{{(\w+)}}/g, (_m, name) =>
                String(values?.[name] ?? '')
            ),
        i18n: { language: 'en' },
    }),
}));

jest.mock('react-router-dom', () => ({
    Link: ({ children, to, ...rest }: any) => (
        <a href={to} {...rest}>
            {children}
        </a>
    ),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast: jest.fn(), showSuccessToast: jest.fn() }),
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
            screen.getByText('Skip and show everything').closest('a')
        ).toHaveAttribute('href', '/today_legacy');
        await waitFor(() =>
            expect(screen.getByText('4')).toBeInTheDocument()
        );
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
        expect(await screen.findByTestId('not-planned-toggle')).toHaveTextContent(
            'Not planned (1)'
        );
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
