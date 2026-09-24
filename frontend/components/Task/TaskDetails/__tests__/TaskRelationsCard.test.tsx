import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskRelationsCard from '../TaskRelationsCard';
import {
    createTaskRelation,
    deleteTaskRelation,
    fetchTaskRelations,
} from '../../../../utils/tasksService';
import { searchUniversal } from '../../../../utils/searchService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

jest.mock('react-router-dom', () => ({
    Link: ({ children, to, className }: any) => (
        <a href={to} className={className}>
            {children}
        </a>
    ),
}));

jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({ showErrorToast: jest.fn() }),
}));

jest.mock('../../../../utils/tasksService', () => ({
    fetchTaskRelations: jest.fn(),
    createTaskRelation: jest.fn(),
    deleteTaskRelation: jest.fn(),
}));

jest.mock('../../../../utils/searchService', () => ({
    searchUniversal: jest.fn(),
}));

const mockFetch = fetchTaskRelations as jest.Mock;
const mockCreate = createTaskRelation as jest.Mock;
const mockDelete = deleteTaskRelation as jest.Mock;
const mockSearch = searchUniversal as jest.Mock;

describe('TaskRelationsCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockResolvedValue([
            {
                uid: 'rel-1',
                type: 'blocked_by',
                task: { uid: 'task-b', name: 'Buy paint', status: 0 },
            },
            {
                uid: 'rel-2',
                type: 'related_to',
                task: { uid: 'task-c', name: 'Pick colors', status: 2 },
            },
        ]);
    });

    it('groups relations by type and links to the other task', async () => {
        render(<TaskRelationsCard taskUid="task-a" />);

        expect(await screen.findByText('Buy paint')).toBeInTheDocument();
        expect(screen.getByText('Buy paint').closest('a')).toHaveAttribute(
            'href',
            '/task/task-b'
        );
        expect(screen.getByText('Pick colors')).toHaveClass('line-through');
        expect(screen.getByText('(2)')).toBeInTheDocument();
    });

    it('removes a relation and reports the change', async () => {
        const onChange = jest.fn();
        mockDelete.mockResolvedValue(undefined);
        render(
            <TaskRelationsCard taskUid="task-a" onRelationsChange={onChange} />
        );

        await screen.findByText('Buy paint');
        fireEvent.click(screen.getAllByLabelText('Remove relation')[0]);

        await waitFor(() =>
            expect(mockDelete).toHaveBeenCalledWith('task-a', 'rel-1')
        );
        await waitFor(() => expect(onChange).toHaveBeenCalled());
    });

    it('adds a relation from a search result', async () => {
        mockSearch.mockResolvedValue({
            results: [
                { uid: 'task-a', name: 'Itself' },
                { uid: 'task-b', name: 'Already linked' },
                { uid: 'task-d', name: 'Hang shelves' },
            ],
        });
        mockCreate.mockResolvedValue({});
        const onChange = jest.fn();
        render(
            <TaskRelationsCard taskUid="task-a" onRelationsChange={onChange} />
        );

        await screen.findByText('Buy paint');
        fireEvent.click(screen.getByTestId('task-relation-add'));
        fireEvent.change(screen.getByTestId('task-relation-type'), {
            target: { value: 'blocks' },
        });
        fireEvent.change(screen.getByTestId('task-relation-search'), {
            target: { value: 'shelves' },
        });

        const hit = await screen.findByText('Hang shelves');
        expect(screen.queryByText('Itself')).not.toBeInTheDocument();
        expect(screen.queryByText('Already linked')).not.toBeInTheDocument();

        fireEvent.click(hit);

        await waitFor(() =>
            expect(mockCreate).toHaveBeenCalledWith(
                'task-a',
                'task-d',
                'blocks'
            )
        );
        await waitFor(() => expect(onChange).toHaveBeenCalled());
    });
});
