import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskRecurringHistory from '../TaskRecurringHistory';
import { fetchRecurringHistory } from '../../../../utils/tasksService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string, options?: any) =>
            Object.entries(options || {}).reduce(
                (text, [name, value]) =>
                    text.replace(`{{${name}}}`, String(value)),
                fallback
            ),
        i18n: { language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('../../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en', t: (key: string) => key },
}));

jest.mock('../../../../utils/tasksService', () => ({
    fetchRecurringHistory: jest.fn(),
}));

const fetchMock = fetchRecurringHistory as jest.Mock;

const occurrence = (id: number, overrides = {}) => ({
    id,
    scheduled_for: '2030-03-01',
    completed_at: '2030-03-04T12:00:00.000Z',
    completed_date: '2030-03-04',
    skipped: false,
    ...overrides,
});

const history = (overrides = {}) => ({
    occurrences: [occurrence(1)],
    total: 1,
    completed_count: 1,
    skipped_count: 0,
    has_more: false,
    ...overrides,
});

describe('TaskRecurringHistory', () => {
    beforeEach(() => fetchMock.mockReset());

    it('shows scheduled and completed dates, and marks skips', async () => {
        fetchMock.mockResolvedValue(
            history({
                occurrences: [
                    occurrence(2, {
                        scheduled_for: '2030-03-08',
                        skipped: true,
                    }),
                    occurrence(1),
                ],
                total: 2,
                skipped_count: 1,
            })
        );

        render(<TaskRecurringHistory taskUid="t-1" />);

        expect(
            await screen.findByText('1 completed, 1 skipped')
        ).toBeInTheDocument();
        expect(screen.getByText('Mar 1, 2030')).toBeInTheDocument();
        expect(screen.getByText('Completed Mar 4, 2030')).toBeInTheDocument();
        expect(screen.getByText('Mar 8, 2030')).toBeInTheDocument();
        expect(screen.getByText('Skipped')).toBeInTheDocument();
    });

    it('renders nothing when there is no history', async () => {
        fetchMock.mockResolvedValue(
            history({ occurrences: [], total: 0, completed_count: 0 })
        );

        const { container } = render(<TaskRecurringHistory taskUid="t-1" />);

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it('appends the next page on Show more', async () => {
        fetchMock
            .mockResolvedValueOnce(history({ total: 2, has_more: true }))
            .mockResolvedValueOnce(
                history({
                    occurrences: [
                        occurrence(2, { scheduled_for: '2030-02-22' }),
                    ],
                    total: 2,
                })
            );

        render(<TaskRecurringHistory taskUid="t-1" />);

        fireEvent.click(await screen.findByText('Show more'));

        expect(await screen.findByText('Feb 22, 2030')).toBeInTheDocument();
        expect(screen.getByText('Mar 1, 2030')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenLastCalledWith('t-1', 1);
        expect(screen.queryByText('Show more')).not.toBeInTheDocument();
    });

    it('loads again when an occurrence is completed', async () => {
        fetchMock.mockResolvedValue(history());

        const { rerender } = render(
            <TaskRecurringHistory taskUid="t-1" refreshKey="2030-03-01" />
        );
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        rerender(
            <TaskRecurringHistory taskUid="t-1" refreshKey="2030-03-08" />
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    });

    it('says so when the history cannot be loaded', async () => {
        fetchMock.mockRejectedValue(new Error('nope'));

        render(<TaskRecurringHistory taskUid="t-1" />);

        expect(
            await screen.findByText('Could not load the history.')
        ).toBeInTheDocument();
    });
});
