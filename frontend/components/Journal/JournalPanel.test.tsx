import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useSWR from 'swr';
import JournalPanel from './JournalPanel';
import {
    refreshPlanning,
    revertJournal,
    revertJournalGroup,
} from '../../utils/planningService';
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));
jest.mock('../../utils/planningService', () => ({
    planningKeys: { journal: 'journal' },
    fetchJournal: jest.fn(),
    refreshPlanning: jest.fn().mockResolvedValue(undefined),
    revertJournal: jest.fn(),
    revertJournalGroup: jest.fn(),
}));
const entries = [
    {
        uid: 'a',
        op: 'reparent',
        entity_type: 'goal',
        created_at: '2026-10-10T12:00:00Z',
    },
    {
        uid: 'b',
        op: 'checkin',
        entity_type: 'metric',
        created_at: '2026-10-10T13:00:00Z',
    },
];
beforeEach(() => {
    jest.clearAllMocks();
    (useSWR as jest.Mock).mockReturnValue({ data: { entries } });
});
it('reverts one operation and revalidates planning', async () => {
    (revertJournal as jest.Mock).mockResolvedValue({});
    render(<JournalPanel />);
    fireEvent.click(
        screen.getAllByRole('button', { name: 'ltdPlanning.undo' })[0]
    );
    await waitFor(() => expect(revertJournal).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(refreshPlanning).toHaveBeenCalled());
});
it('submits selected operations to the atomic group endpoint', async () => {
    (revertJournalGroup as jest.Mock).mockResolvedValue({});
    render(<JournalPanel />);
    screen
        .getAllByRole('checkbox')
        .forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(
        screen.getByRole('button', { name: 'ltdPlanning.undoSelected' })
    );
    await waitFor(() =>
        expect(revertJournalGroup).toHaveBeenCalledWith(['a', 'b'])
    );
});
it('retains visible history and displays an Undo conflict', async () => {
    (revertJournal as jest.Mock).mockRejectedValue(
        new Error('Undo newer changes first')
    );
    render(<JournalPanel />);
    fireEvent.click(
        screen.getAllByRole('button', { name: 'ltdPlanning.undo' })[0]
    );
    await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Undo newer changes first'
        )
    );
    expect(
        screen.getAllByRole('button', { name: 'ltdPlanning.undo' })
    ).toHaveLength(2);
    expect(refreshPlanning).not.toHaveBeenCalled();
});
