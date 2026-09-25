import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import QuickCaptureInput from '../QuickCaptureInput';
import { createTask } from '../../../utils/tasksService';
import { getApiPath } from '../../../config/paths';
import { Task } from '../../../entities/Task';

jest.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback || key,
    }),
}));

jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../store/useStore', () => {
    const state = {
        tagsStore: {
            getTags: () => [{ id: 1, name: 'errands' }],
            setTags: jest.fn(),
            refreshTags: jest.fn().mockResolvedValue(undefined),
        },
    };
    return {
        useStore: Object.assign(() => state, { getState: () => state }),
    };
});

jest.mock('../../../utils/csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('test-token'),
}));

describe('QuickCaptureInput Task action', () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    const projects = [
        { id: 11, uid: 'personal-uid', name: 'Personal' },
        { id: 12, uid: 'home-projects-uid', name: 'Home Projects' },
    ];

    beforeEach(() => {
        jest.useFakeTimers();
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({
            ok: true,
            status: 201,
            headers: new Headers(),
            json: async () => ({ uid: 'created-task' }),
        });
        global.fetch = fetchMock;
    });

    afterEach(() => {
        jest.useRealTimers();
        global.fetch = originalFetch;
    });

    it.each([
        ['My task name +Personal', 'personal-uid', []],
        ['My task name +"Home Projects"', 'home-projects-uid', []],
        ['My task name', undefined, []],
        [
            'My task name +Personal #errands #new-tag',
            'personal-uid',
            [{ id: 1, name: 'errands' }, { name: 'new-tag' }],
        ],
    ])(
        'sends the correct task request for %s before analysis completes',
        async (text, projectUid, tags) => {
            // InboxItems passes the Task action's payload directly to createTask.
            const onTaskCreate = jest.fn(async (task: Task) => {
                await createTask(task);
            });
            render(
                <MemoryRouter>
                    <QuickCaptureInput
                        projects={projects}
                        openTaskModal={onTaskCreate}
                    />
                </MemoryRouter>
            );

            fireEvent.change(screen.getByTestId('quick-capture-input'), {
                target: { value: text },
            });
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Task' }));
            });

            expect(onTaskCreate).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe(getApiPath('task'));
            expect(options.method).toBe('POST');
            expect(JSON.parse(options.body)).toEqual({
                name: 'My task name',
                status: 'not_started',
                priority: null,
                tags,
                ...(projectUid ? { project_uid: projectUid } : {}),
                completed_at: null,
            });
            expect(screen.getByTestId('quick-capture-input')).toHaveValue('');
        }
    );
});
