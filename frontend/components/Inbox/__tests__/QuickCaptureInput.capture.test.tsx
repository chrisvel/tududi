import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuickCaptureInput, {
    QuickCaptureInputHandle,
} from '../QuickCaptureInput';
import { ToastProvider } from '../../Shared/ToastContext';
import { getApiPath } from '../../../config/paths';
import { resetCaptureSettingsCache } from '../../../utils/captureSettings';

jest.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    useTranslation: () => ({
        t: (
            key: string,
            fallback?: string | { defaultValue: string; message: string }
        ) =>
            typeof fallback === 'object'
                ? fallback.defaultValue.replace('{{message}}', fallback.message)
                : fallback || key,
    }),
}));

const addInboxItem = jest.fn();
jest.mock('../../../store/useStore', () => {
    const state = {
        tagsStore: {
            getTags: () => [],
            setTags: jest.fn(),
            refreshTags: jest.fn().mockResolvedValue(undefined),
        },
        inboxStore: { addInboxItem: (item: unknown) => addInboxItem(item) },
    };
    return { useStore: Object.assign(() => state, { getState: () => state }) };
});
jest.mock('../../../utils/csrfService', () => ({
    getCsrfToken: jest.fn().mockResolvedValue('test-token'),
}));

describe.each([false, true])(
    'Inbox submission with =Task (unified=%s)',
    (unified) => {
        const fetchMock = jest.fn();
        const originalFetch = global.fetch;
        const success = () => ({
            ok: true,
            status: 201,
            headers: new Headers(),
            json: async () => ({
                kind: 'task',
                task: { uid: 'created-task', name: 'My task name' },
            }),
        });

        beforeEach(() => {
            jest.useFakeTimers();
            localStorage.clear();
            resetCaptureSettingsCache();
            fetchMock.mockReset().mockResolvedValue(success());
            addInboxItem.mockClear();
            global.fetch = fetchMock;
        });
        afterEach(() => {
            jest.useRealTimers();
            global.fetch = originalFetch;
        });

        function setup(
            content = 'My task name +Personal =Task',
            multiline = true
        ) {
            const ref = React.createRef<QuickCaptureInputHandle>();
            const onTaskCreate = jest.fn();
            const onNoteCreate = jest.fn();
            render(
                <MemoryRouter initialEntries={['/inbox']}>
                    <ToastProvider>
                        <QuickCaptureInput
                            ref={ref}
                            unified={unified}
                            multiline={multiline}
                            onTaskCreate={onTaskCreate}
                            onNoteCreate={onNoteCreate}
                        />
                    </ToastProvider>
                </MemoryRouter>
            );
            const input = screen.getByTestId('quick-capture-input');
            fireEvent.change(input, { target: { value: content } });
            return { ref, input, onTaskCreate, onNoteCreate };
        }

        it.each(['button', 'enter', 'single-line enter', 'imperative'])(
            'creates a task via %s before analysis finishes',
            async (action) => {
                const { ref, input, onTaskCreate, onNoteCreate } = setup(
                    undefined,
                    action !== 'single-line enter'
                );
                await act(async () => {
                    if (action === 'button')
                        fireEvent.click(
                            unified
                                ? screen.getByTestId('capture-add')
                                : screen.getByTitle('Task')
                        );
                    else if (action === 'imperative')
                        await ref.current!.submit();
                    else fireEvent.keyDown(input, { key: 'Enter' });
                });
                expect(fetchMock).toHaveBeenCalledTimes(1);
                const [url, options] = fetchMock.mock.calls[0];
                expect(url).toBe(getApiPath('inbox/capture'));
                expect(JSON.parse(options.body)).toEqual({
                    content: 'My task name +Personal =Task',
                    request_id: expect.any(String),
                });
                expect(input).toHaveValue('');
                expect(
                    screen.getByRole('link', { name: 'My task name' })
                ).toHaveAttribute('href', '/task/created-task');
                expect(onTaskCreate).not.toHaveBeenCalled();
                expect(onNoteCreate).not.toHaveBeenCalled();
                expect(addInboxItem).not.toHaveBeenCalled();
            }
        );

        it('overrides note/URL classification', async () => {
            const { input, onNoteCreate } = setup(
                'https://example.com +Personal =Task'
            );
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    parsed_tags: ['bookmark'],
                    parsed_projects: ['Personal'],
                    cleaned_content: 'https://example.com',
                    suggested_type: 'note',
                    suggested_reason: 'url_detected',
                }),
            });
            await act(async () => {
                jest.advanceTimersByTime(300);
            });
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(
                fetchMock.mock.calls.some(
                    ([url]) => url === getApiPath('inbox/capture')
                )
            ).toBe(true);
            expect(onNoteCreate).not.toHaveBeenCalled();
            expect(
                screen.getByRole('link', { name: 'My task name' })
            ).toBeInTheDocument();
        });

        it('retains text, displays validation errors and reuses the ID when retrying', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    code: 'CAPTURE_PROJECT_UNAVAILABLE',
                    error: 'Project is unavailable.',
                }),
            });
            const { input } = setup();
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(input).toHaveValue('My task name +Personal =Task');
            expect(
                screen.getByText('Project is unavailable.')
            ).toBeInTheDocument();
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(JSON.parse(fetchMock.mock.calls[0][1].body).request_id).toBe(
                JSON.parse(fetchMock.mock.calls[1][1].body).request_id
            );
            expect(input).toHaveValue('');
        });

        it('keeps input on network failure without falling back to Inbox', async () => {
            fetchMock.mockRejectedValueOnce(new Error('Connection failed'));
            const { input } = setup();
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(input).toHaveValue('My task name +Personal =Task');
            expect(
                screen.getByText('Could not create task: Connection failed')
            ).toBeInTheDocument();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(addInboxItem).not.toHaveBeenCalled();
        });

        it('labels offline submissions as queued and uses a fresh ID for the next capture', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 202,
                headers: new Headers({ 'X-Tududi-Queued': '1' }),
                json: async () => ({ queued: true }),
            });
            const { input } = setup();
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(input).toHaveValue('');
            expect(
                screen.getByText(
                    "Saved offline. It'll sync automatically once you're back online."
                )
            ).toBeInTheDocument();
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
            fireEvent.change(input, {
                target: { value: 'My task name +Personal =Task' },
            });
            await act(async () => {
                fireEvent.keyDown(input, { key: 'Enter' });
            });
            expect(
                JSON.parse(fetchMock.mock.calls[0][1].body).request_id
            ).not.toBe(JSON.parse(fetchMock.mock.calls[1][1].body).request_id);
        });

        it('suppresses double submissions even before React commits saving state', async () => {
            const { ref } = setup();
            await act(async () => {
                await Promise.all([
                    ref.current!.submit(),
                    ref.current!.submit(),
                ]);
            });
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('keeps the force-Inbox override explicit', async () => {
            setup('My task name =Task');
            await act(async () => {
                fireEvent.click(
                    screen.getByText('Save as Inbox (ignore =Task)')
                );
            });
            expect(fetchMock.mock.calls[0][0]).toBe(getApiPath('inbox'));
            expect(addInboxItem).toHaveBeenCalledTimes(1);
        });

        it.each(['A thought', 'value=Task', '"=Task"', '=Taskforce'])(
            'preserves ordinary submission for %s',
            async (content) => {
                const { input } = setup(content);
                await act(async () => {
                    fireEvent.keyDown(input, { key: 'Enter' });
                });
                expect(fetchMock.mock.calls[0][0]).toBe(getApiPath('inbox'));
                expect(addInboxItem).toHaveBeenCalledTimes(1);
            }
        );
    }
);
