import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import CaptureHost from '../CaptureHost';
import {
    closeCapture,
    openCapture,
    toggleCapture,
} from '../../../utils/captureUi';

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
            getTags: () => [],
            setTags: jest.fn(),
            refreshTags: jest.fn().mockResolvedValue(undefined),
        },
        projectsStore: { projects: [], setProjects: jest.fn() },
    };
    return {
        useStore: Object.assign(
            (selector?: (s: typeof state) => unknown) =>
                selector ? selector(state) : state,
            { getState: () => state }
        ),
    };
});

jest.mock('../../../utils/inboxService', () => ({
    ...jest.requireActual('../../../utils/inboxService'),
    analyzeInboxText: jest.fn().mockResolvedValue(null),
    createInboxItemWithStore: jest.fn(),
    deleteInboxItemWithStore: jest.fn(),
}));

describe('CaptureHost', () => {
    const renderHost = (path = '/today') =>
        render(
            <MemoryRouter initialEntries={[path]}>
                <button data-testid="opener">opener</button>
                <CaptureHost />
            </MemoryRouter>
        );

    afterEach(() => {
        act(() => closeCapture());
    });

    it('shows nothing but the phone button until it is opened', () => {
        renderHost();
        expect(screen.queryByTestId('capture-dialog')).not.toBeInTheDocument();
        expect(screen.getByTestId('capture-phone-button')).toHaveTextContent(
            'Add'
        );
    });

    it('opens on Inbox from the phone button and hides the button', async () => {
        renderHost();
        fireEvent.click(screen.getByTestId('capture-phone-button'));

        const dialog = screen.getByTestId('capture-dialog');
        expect(dialog).not.toHaveAttribute('hidden');
        expect(screen.getByTestId('capture-target-inbox')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(
            screen.queryByTestId('capture-phone-button')
        ).not.toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByTestId('quick-capture-input')).toHaveFocus()
        );
    });

    it('opens on Task when asked to, and starts from Inbox on the next open', () => {
        renderHost();
        act(() => openCapture('task'));
        expect(screen.getByTestId('capture-target-task')).toHaveAttribute(
            'aria-checked',
            'true'
        );

        act(() => closeCapture());
        act(() => openCapture('inbox'));
        expect(screen.getByTestId('capture-target-inbox')).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    it('keeps half-typed text when it is closed and opened again', () => {
        renderHost();
        act(() => openCapture());
        fireEvent.change(screen.getByTestId('quick-capture-input'), {
            target: { value: 'half a thought' },
        });

        act(() => closeCapture());
        expect(screen.getByTestId('capture-dialog')).toHaveAttribute('hidden');

        act(() => openCapture());
        expect(screen.getByTestId('quick-capture-input')).toHaveValue(
            'half a thought'
        );
    });

    it('gives focus back to where it came from when closed', async () => {
        renderHost();
        const opener = screen.getByTestId('opener');
        opener.focus();

        act(() => toggleCapture());
        await waitFor(() =>
            expect(screen.getByTestId('quick-capture-input')).toHaveFocus()
        );

        fireEvent.keyDown(screen.getByTestId('quick-capture-input'), {
            key: 'Escape',
        });
        expect(opener).toHaveFocus();
    });

    it('focuses the field every time it opens', async () => {
        renderHost();
        act(() => toggleCapture());
        await waitFor(() =>
            expect(screen.getByTestId('quick-capture-input')).toHaveFocus()
        );

        act(() => toggleCapture());
        screen.getByTestId('opener').focus();
        act(() => toggleCapture());
        await waitFor(() =>
            expect(screen.getByTestId('quick-capture-input')).toHaveFocus()
        );
    });

    it('closes on a click outside the box', async () => {
        renderHost();
        act(() => toggleCapture());
        await waitFor(() =>
            expect(screen.getByTestId('capture-dialog')).toBeVisible()
        );

        fireEvent.pointerDown(screen.getByTestId('capture-dialog'));
        expect(screen.getByTestId('capture-dialog')).toBeVisible();

        fireEvent.pointerDown(document.body);
        expect(screen.getByTestId('capture-dialog')).not.toBeVisible();
    });

    it.each(['/inbox', '/task/abc', '/note/xyz'])(
        'keeps the phone button out of the way on %s',
        (path) => {
            renderHost(path);
            expect(
                screen.queryByTestId('capture-phone-button')
            ).not.toBeInTheDocument();
        }
    );
});
