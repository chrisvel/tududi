import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import QuickCaptureInput from '../QuickCaptureInput';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    useTranslation: () => ({
        t: (
            key: string,
            fallback?: string,
            values?: Record<string, string>
        ) =>
            (fallback || key).replace(
                /\{\{(\w+)\}\}/g,
                (_, name) => values?.[name] ?? ''
            ),
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../store/useStore', () => ({
    useStore: () => ({
        tagsStore: {
            getTags: () => [],
            setTags: jest.fn(),
            refreshTags: jest.fn(),
        },
    }),
}));

jest.mock('../../../utils/csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('test-token'),
}));

const jsonResponse = (body: unknown) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => body,
});

const baseAnalysis = {
    parsed_tags: [],
    parsed_projects: [],
    parsed_due_date: null,
    parsed_date_text: null,
    parsed_recurrence: null,
    parsed_person: null,
    parsed_assignee: null,
    suggested_type: null,
    suggested_reason: null,
};

describe('QuickCaptureInput dates and @people', () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    let analysis: Record<string, unknown>;

    const analyzeCalls = () =>
        fetchMock.mock.calls.filter(([url]) =>
            String(url).includes('inbox/analyze-text')
        );

    const typeAndAnalyze = async (value: string) => {
        fireEvent.change(screen.getByTestId('quick-capture-input'), {
            target: { value, selectionStart: value.length },
        });
        await act(async () => {
            jest.advanceTimersByTime(300);
        });
    };

    beforeEach(() => {
        jest.useFakeTimers();
        analysis = { ...baseAnalysis, cleaned_content: '' };
        fetchMock.mockReset();
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes('inbox/analyze-text')) {
                return jsonResponse(analysis);
            }
            if (url.includes('people/assignable')) {
                return jsonResponse({
                    people: [
                        { uid: 'maria-uid', name: 'Maria Lopez' },
                        { uid: 'bob-uid', name: 'Bob' },
                    ],
                });
            }
            return jsonResponse({});
        });
        global.fetch = fetchMock;
    });

    afterEach(() => {
        jest.useRealTimers();
        global.fetch = originalFetch;
    });

    it('applies the parsed date, recurrence and assignee to the task', async () => {
        const onTaskCreate = jest.fn<Promise<void>, [Task]>(async () => {});
        render(
            <MemoryRouter>
                <QuickCaptureInput openTaskModal={onTaskCreate} />
            </MemoryRouter>
        );
        analysis = {
            ...baseAnalysis,
            cleaned_content: 'Pay rent',
            parsed_due_date: '2026-10-01',
            parsed_date_text: 'every month on the 1st',
            parsed_recurrence: {
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: 1,
            },
            parsed_person: 'Maria',
            parsed_assignee: { uid: 'maria-uid', name: 'Maria Lopez' },
            suggested_type: 'task',
        };

        await typeAndAnalyze('Pay rent every month on the 1st @Maria');

        expect(screen.getByTestId('selected-due-date')).toHaveTextContent(
            'every month on the 1st, from'
        );
        expect(screen.getByTestId('selected-assignee')).toHaveTextContent(
            'Maria Lopez'
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Task' }));
        });

        expect(onTaskCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Pay rent',
                due_date: '2026-10-01',
                recurrence_type: 'monthly',
                recurrence_month_day: 1,
                assigned_to: 'maria-uid',
            })
        );
    });

    it('re-analyzes without dates after the date chip is dismissed', async () => {
        render(
            <MemoryRouter>
                <QuickCaptureInput openTaskModal={jest.fn()} />
            </MemoryRouter>
        );
        analysis = {
            ...baseAnalysis,
            cleaned_content: 'Read book',
            parsed_due_date: '2026-09-26',
            parsed_date_text: 'tomorrow',
        };

        await typeAndAnalyze('Read book tomorrow');
        expect(screen.getByTestId('selected-due-date')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByTitle('Keep as text'));
        });
        await act(async () => {
            jest.advanceTimersByTime(300);
        });

        expect(screen.queryByTestId('selected-due-date')).toBeNull();
        const lastCall = analyzeCalls()[analyzeCalls().length - 1];
        expect(JSON.parse(lastCall[1].body)).toMatchObject({
            content: 'Read book tomorrow',
            parse_dates: false,
        });
    });

    it('suggests people after @ and inserts a quoted full name', async () => {
        render(
            <MemoryRouter>
                <QuickCaptureInput openTaskModal={jest.fn()} />
            </MemoryRouter>
        );

        await typeAndAnalyze('Call @mar');

        const option = await screen.findByText('@Maria Lopez');
        expect(screen.queryByText('@Bob')).toBeNull();

        await act(async () => {
            fireEvent.click(option);
        });

        expect(screen.getByTestId('quick-capture-input')).toHaveValue(
            'Call @"Maria Lopez" '
        );
    });
});
