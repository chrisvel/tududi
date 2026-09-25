import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlanMyDay from '../PlanMyDay';
import {
    draftDayWithAi,
    estimateWithAi,
    fetchDailyPlan,
    fetchPlanCandidates,
} from '../../../utils/dailyPlanService';

let aiEnabled = false;

// A stable t, like the real one: the planner reloads when t changes.
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
    const value = { t, i18n: { language: 'en' } };
    return { useTranslation: () => value };
});

jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/today/plan' }),
    Link: ({ to, children, className }: any) => (
        <a href={to} className={className}>
            {children}
        </a>
    ),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: (selector: any) =>
        selector({ userSettingsStore: { aiAssistantEnabled: aiEnabled } }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showErrorToast: jest.fn(),
        showSuccessToast: jest.fn(),
    }),
}));

jest.mock('../../../utils/dateUtils', () => ({
    getUserTimezone: () => 'UTC',
}));

jest.mock('../../../utils/tasksService', () => ({
    createTask: jest.fn(),
    updateTask: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/inboxService', () => ({
    processInboxItem: jest.fn(),
}));

jest.mock('../../../utils/calendarFeedsService', () => ({
    fetchCalendarEvents: jest
        .fn()
        .mockResolvedValue({ events: [], errors: [] }),
}));

jest.mock('../../../utils/dailyPlanService', () => ({
    ...jest.requireActual('../../../utils/dailyPlanService'),
    fetchDailyPlan: jest.fn(),
    fetchPlanCandidates: jest.fn(),
    saveDailyPlanItems: jest.fn().mockResolvedValue({}),
    startDailyPlan: jest.fn(),
    draftDayWithAi: jest.fn(),
    estimateWithAi: jest.fn(),
}));

const candidates = {
    in_progress: [],
    overdue: [],
    due_today: [
        { uid: 'a', name: 'Pay invoice', status: 0, completed_at: null },
    ],
    suggested: [],
    inbox: [],
    inbox_count: 0,
};

const existing = {
    task_uid: 'kept',
    position: 0,
    start_minute: null,
    duration_minutes: 30,
    task: { uid: 'kept', name: 'Already planned', status: 0 },
};

describe('PlanMyDay AI help', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fetchDailyPlan as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            plan: {
                uid: 'p',
                date: '2026-09-24',
                started_at: null,
                items: [existing],
            },
        });
        (fetchPlanCandidates as jest.Mock).mockResolvedValue(candidates);
        (estimateWithAi as jest.Mock).mockResolvedValue({ a: 15 });
    });

    it('shows no AI controls while the AI assistant is off', async () => {
        aiEnabled = false;
        render(<PlanMyDay />);

        expect(await screen.findByText('Pay invoice')).toBeInTheDocument();
        expect(screen.queryByTestId('ai-draft-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('plan-tips')).not.toBeInTheDocument();
        expect(estimateWithAi).not.toHaveBeenCalled();
    });

    it('fills free time with a draft and undoes it', async () => {
        aiEnabled = true;
        (draftDayWithAi as jest.Mock).mockResolvedValue({
            date: '2026-09-24',
            mode: 'fill',
            summary: 'One quick win',
            items: [
                {
                    task_uid: 'a',
                    start_minute: null,
                    duration_minutes: 15,
                    reason: 'Due today',
                    task: candidates.due_today[0],
                },
            ],
            skipped: [],
        });
        render(<PlanMyDay />);

        await waitFor(() => expect(estimateWithAi).toHaveBeenCalledWith(['a']));
        fireEvent.click(await screen.findByTestId('ai-draft-button'));
        fireEvent.click(screen.getByText('Fill free time'));

        expect(await screen.findByTestId('ai-draft-banner')).toHaveTextContent(
            'One quick win'
        );
        expect(draftDayWithAi).toHaveBeenCalledWith('2026-09-24', 'fill');
        expect(screen.getByTestId('capacity')).toHaveTextContent('45m planned');

        fireEvent.click(screen.getByTestId('ai-draft-undo'));

        expect(screen.queryByTestId('ai-draft-banner')).not.toBeInTheDocument();
        expect(screen.getByTestId('capacity')).toHaveTextContent('30m planned');
    });
});
