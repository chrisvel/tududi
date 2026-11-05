import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskDetailsHeader from '../TaskDetailsHeader';

jest.mock('react-router-dom', () => ({
    Link: ({ children }: any) => <a>{children}</a>,
    useNavigate: () => jest.fn(),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
}));

jest.mock('../../../../i18n', () => ({
    __esModule: true,
    default: { language: 'en' },
}));

jest.mock('../../TaskStatusControl', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../../Inbox/QuickCaptureInput', () => ({
    __esModule: true,
    default: () => null,
}));

const task: any = {
    id: 1,
    uid: 'task-1',
    name: 'Write report',
    status: 'not_started',
    priority: null,
};

describe('TaskDetailsHeader copy link', () => {
    it('copies the direct task link from the icon next to the title', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });

        render(
            <TaskDetailsHeader
                task={task}
                onTitleUpdate={jest.fn()}
                onStatusUpdate={jest.fn()}
                onPriorityUpdate={jest.fn()}
                onDelete={jest.fn()}
                activePill="overview"
                onPillChange={jest.fn()}
            />
        );

        const link = screen.getByTestId('task-copy-link');
        const expected = `${window.location.origin}/task/task-1`;
        expect(link).toHaveAttribute('href', expected);

        fireEvent.click(link);

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith(expected);
            expect(link).toHaveAttribute('title', 'Link copied');
        });
    });
});
