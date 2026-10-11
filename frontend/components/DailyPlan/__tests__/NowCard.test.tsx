import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NowCard from '../NowCard';
import { DailyPlanItem } from '../../../utils/dailyPlanService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string | object) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

const item = (task: Record<string, unknown>): DailyPlanItem =>
    ({
        task_uid: 't1',
        position: 0,
        start_minute: null,
        duration_minutes: 30,
        task: { uid: 't1', name: 'Write report', status: 0, ...task },
    }) as unknown as DailyPlanItem;

const renderCard = (props: Partial<React.ComponentProps<typeof NowCard>>) =>
    render(
        <NowCard
            items={[item({})]}
            events={[]}
            now={600}
            onDone={jest.fn()}
            onPushLater={jest.fn()}
            busyUid={null}
            {...props}
        />
    );

describe('NowCard starter step (T-503)', () => {
    it('shows the starter step first when set', () => {
        renderCard({ items: [item({ starter_step: 'Open the doc' })] });
        expect(screen.getByTestId('now-card-starter-step')).toHaveTextContent(
            'Open the doc'
        );
        expect(screen.queryByTestId('now-card-five-minutes')).toBeNull();
    });

    it('suggests a five-minute start when empty', () => {
        renderCard({ items: [item({ starter_step: null })] });
        expect(screen.getByTestId('now-card-five-minutes')).toBeInTheDocument();
    });

    it('starts Focus and offers Continue with the note for an interrupted session', () => {
        const onFocus = jest.fn();
        const onResume = jest.fn();
        const resumable = {
            uid: 's1',
            task_uid: 't1',
            task_name: 'Write report',
            starter_step: null,
            started_at: '2026-10-11T09:00:00Z',
            ended_at: '2026-10-11T09:12:00Z',
            planned_minutes: 25,
            actual_minutes: 12,
            interrupted: true,
            resume_note: 'Intro done',
        };
        const { rerender } = renderCard({ onFocus });
        fireEvent.click(screen.getByTestId('now-card-focus'));
        expect(onFocus).toHaveBeenCalled();
        rerender(
            <NowCard
                items={[item({})]}
                events={[]}
                now={600}
                onDone={jest.fn()}
                onPushLater={jest.fn()}
                busyUid={null}
                onFocus={onFocus}
                resumable={resumable}
                onResume={onResume}
            />
        );
        expect(screen.getByTestId('now-card-resume-note')).toHaveTextContent(
            'Intro done'
        );
        fireEvent.click(screen.getByTestId('now-card-resume'));
        expect(onResume).toHaveBeenCalledWith(resumable);
    });
});
