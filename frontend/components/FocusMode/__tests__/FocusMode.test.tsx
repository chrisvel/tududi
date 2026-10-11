import React from 'react';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import FocusMode from '../FocusMode';
import { remainingSeconds } from '../../Shared/pomodoroClock';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string | object) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
}));

const endFocus = jest.fn();
jest.mock('../../../utils/todayService', () => ({
    endFocus: (...args: unknown[]) => endFocus(...args),
}));

const T0 = new Date('2026-10-11T09:00:00Z').getTime();
const session = {
    uid: 's1',
    task_uid: 't1',
    task_name: 'Draft chapter',
    starter_step: 'Reread the last paragraph',
    started_at: new Date(T0).toISOString(),
    ended_at: null,
    planned_minutes: 25,
    actual_minutes: null,
    interrupted: false,
    resume_note: null,
};

describe('Focus clock (T-502)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(T0);
        endFocus.mockReset();
    });
    afterEach(() => jest.useRealTimers());

    it('derives time left from started_at and the system clock', () => {
        expect(remainingSeconds(T0, 1500, T0)).toBe(1500);
        expect(remainingSeconds(T0, 1500, T0 + 12 * 60000)).toBe(780);
        expect(remainingSeconds(T0, 1500, T0 + 99 * 60000)).toBe(0);
        // A clock read just before the start never adds time.
        expect(remainingSeconds(T0, 1500, T0 - 5300)).toBe(1500);
    });

    it('is right after the tab was frozen in the background', () => {
        render(<FocusMode session={session} onClose={jest.fn()} />);
        expect(screen.getByTestId('focus-clock')).toHaveTextContent('25:00');
        // iOS freezes timers in the background: move the clock 12 minutes
        // without running any interval, then the page becomes visible.
        jest.setSystemTime(T0 + 12 * 60000);
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(screen.getByTestId('focus-clock')).toHaveTextContent('13:00');
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(screen.getByTestId('focus-clock')).toHaveTextContent('12:59');
    });

    it('shows one task with its starter step, full screen', () => {
        render(<FocusMode session={session} onClose={jest.fn()} />);
        expect(screen.getByRole('dialog')).toHaveAttribute(
            'aria-modal',
            'true'
        );
        expect(screen.getByText('Draft chapter').tagName).toBe('BDI');
        expect(
            screen.getByText('Reread the last paragraph')
        ).toBeInTheDocument();
    });

    it('interrupting at minute 12 saves the "where was I?" note', async () => {
        const onClose = jest.fn();
        const ended = {
            ...session,
            interrupted: true,
            resume_note: 'Section 2',
        };
        endFocus.mockResolvedValue(ended);
        render(<FocusMode session={session} onClose={onClose} />);
        jest.setSystemTime(T0 + 12 * 60000);
        fireEvent.click(screen.getByTestId('focus-interrupt'));
        fireEvent.change(screen.getByTestId('focus-note-input'), {
            target: { value: 'Section 2' },
        });
        fireEvent.click(screen.getByTestId('focus-save-interrupt'));
        await waitFor(() => expect(onClose).toHaveBeenCalledWith(ended));
        expect(endFocus).toHaveBeenCalledWith('s1', {
            interrupted: true,
            resume_note: 'Section 2',
        });
    });

    it('shows the resume note when continuing', () => {
        render(
            <FocusMode
                session={{ ...session, resume_note: 'Halfway, section 2' }}
                onClose={jest.fn()}
            />
        );
        expect(screen.getByTestId('focus-resume-note')).toHaveTextContent(
            'Halfway, section 2'
        );
    });
});
