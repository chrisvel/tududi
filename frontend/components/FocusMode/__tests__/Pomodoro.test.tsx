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
import TaskEstimateCard from '../../Task/TaskDetails/TaskEstimateCard';
import { Task } from '../../../entities/Task';
import { FocusSession } from '../../../utils/todayService';
import fs from 'fs';
import path from 'path';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback ?? key,
        i18n: { language: 'en' },
    }),
}));
jest.mock('swr', () => ({
    __esModule: true,
    default: () => ({ data: undefined, mutate: jest.fn() }),
}));
jest.mock('../../Lessons/EffectLine', () => () => null);
jest.mock('../FocusSummaryLine', () => () => null);
jest.mock('../focusState', () => ({ refreshFocus: jest.fn() }));
const endFocus = jest.fn();
const startFocus = jest.fn();
let completeToday = 1;
jest.mock('../../../utils/todayService', () => ({
    ...jest.requireActual('../../../utils/todayService'),
    endFocus: (...args: unknown[]) => endFocus(...args),
    startFocus: (...args: unknown[]) => startFocus(...args),
    fetchPomodoroSettings: () =>
        Promise.resolve({
            focus_minutes: 25,
            short_break_minutes: 5,
            long_break_minutes: 15,
            long_every: 4,
            sound: false,
        }),
    fetchFocusToday: () =>
        Promise.resolve({ completed_count: completeToday, spent_minutes: 25 }),
}));
const T0 = new Date('2026-10-13T09:00:00Z').getTime();
const session: FocusSession = {
    uid: 's',
    task_uid: 't',
    task_name: 'Draft',
    started_at: new Date(T0).toISOString(),
    planned_minutes: 25,
    ended_at: null,
    actual_minutes: null,
    interrupted: false,
    resume_note: null,
    starter_step: null,
};

describe('T-1202 one-clock transitions', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(T0);
        endFocus.mockReset();
        startFocus.mockReset();
        completeToday = 1;
        endFocus.mockResolvedValue({
            ...session,
            ended_at: new Date(T0 + 25 * 60000).toISOString(),
            actual_minutes: 25,
        });
    });
    afterEach(() => jest.useRealTimers());
    const visibleAt = (minutes: number) =>
        act(() => {
            jest.setSystemTime(T0 + minutes * 60000);
            document.dispatchEvent(new Event('visibilitychange'));
        });
    it('does not end at the bell; taking a break sends the bell timestamp and creates no next session', async () => {
        render(<FocusMode session={session} onClose={jest.fn()} />);
        visibleAt(30);
        expect(endFocus).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('focus-break'));
        await waitFor(() =>
            expect(
                screen.getByText('Stand up and walk a little.')
            ).toBeInTheDocument()
        );
        expect(endFocus).toHaveBeenCalledWith('s', {
            interrupted: false,
            ended_at: new Date(T0 + 25 * 60000).toISOString(),
        });
        expect(screen.getByTestId('focus-clock')).toHaveTextContent('05:00');
        visibleAt(36);
        expect(screen.getByTestId('focus-next')).toBeInTheDocument();
        expect(startFocus).not.toHaveBeenCalled();
    });
    it('uses a long break after the fourth complete interval today', async () => {
        completeToday = 4;
        render(<FocusMode session={session} onClose={jest.fn()} />);
        visibleAt(25);
        fireEvent.click(screen.getByTestId('focus-break'));
        await waitFor(() =>
            expect(screen.getByTestId('focus-clock')).toHaveTextContent('15:00')
        );
    });
    it('continues with +mm:ss and ends using server time (no supplied ended_at)', async () => {
        render(<FocusMode session={session} onClose={jest.fn()} />);
        visibleAt(28);
        fireEvent.click(screen.getByTestId('focus-continue'));
        expect(screen.getByTestId('focus-clock')).toHaveTextContent('+03:00');
        expect(endFocus).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('focus-finish'));
        await waitFor(() =>
            expect(endFocus).toHaveBeenCalledWith('s', { interrupted: false })
        );
    });
    it('asks on visibility after +15 and closes at the bell after +120', async () => {
        render(<FocusMode session={session} onClose={jest.fn()} />);
        visibleAt(41);
        expect(screen.getByTestId('focus-still-here')).toBeInTheDocument();
        visibleAt(146);
        await waitFor(() =>
            expect(endFocus).toHaveBeenCalledWith('s', {
                ended_at: new Date(T0 + 25 * 60000).toISOString(),
            })
        );
        expect(
            await screen.findByText(
                'Session closed. Time after the bell was not counted.'
            )
        ).toBeInTheDocument();
    });
    it('removes ring transitions for reduced motion', () => {
        const css = fs.readFileSync(
            path.join(__dirname, '../focus.css'),
            'utf8'
        );
        expect(css).toMatch(/\.ltd-focus-progress\s*\{\s*transition: none/);
        expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
        expect(css).toContain('stroke-dashoffset 1s linear');
    });
});
describe('T-1203 one estimate', () => {
    it('writing two intervals writes 50, while changing length writes only the override', () => {
        const onChange = jest.fn();
        const onLengthChange = jest.fn();
        render(
            <TaskEstimateCard
                task={
                    {
                        uid: 't',
                        name: 'Draft',
                        focus_minutes: 25,
                        estimated_minutes: null,
                    } as Task
                }
                onChange={onChange}
                onLengthChange={onLengthChange}
            />
        );
        expect(screen.getByTestId('task-focus-count')).toHaveValue(null);
        fireEvent.change(screen.getByTestId('task-focus-count'), {
            target: { value: '2' },
        });
        expect(onChange).toHaveBeenCalledWith(50);
        onChange.mockClear();
        fireEvent.change(screen.getByTestId('task-focus-length'), {
            target: { value: '50' },
        });
        expect(onLengthChange).toHaveBeenCalledWith(50);
        expect(onChange).not.toHaveBeenCalled();
    });
});
