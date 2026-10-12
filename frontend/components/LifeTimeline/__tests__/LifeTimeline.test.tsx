import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LifeTimeline, { TimelineItem } from '../LifeTimeline';
import { setLocalePreferences } from '../../../utils/jalali';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const iso = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('en-CA');

const milestone: TimelineItem = {
    id: 'm1',
    title: 'Moved city',
    date: iso(-400),
    precision: 'day',
};
const goal: TimelineItem = {
    id: 'g1',
    title: 'Run a marathon',
    date: iso(200),
    precision: 'day',
};

describe('LifeTimeline', () => {
    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
            configurable: true,
            get: () => 1000,
        });
    });
    afterEach(() => setLocalePreferences({ calendarSystem: 'gregorian' }));

    const setup = (
        props: Partial<React.ComponentProps<typeof LifeTimeline>> = {}
    ) => {
        const onMilestoneClick = jest.fn();
        const onGoalClick = jest.fn();
        render(
            <LifeTimeline
                milestones={[milestone]}
                goals={[goal]}
                showMilestones
                showGoals
                axisRtl={false}
                onMilestoneClick={onMilestoneClick}
                onGoalClick={onGoalClick}
                {...props}
            />
        );
        return { onMilestoneClick, onGoalClick };
    };

    it('renders both layers and routes clicks to the right handler', () => {
        const { onMilestoneClick, onGoalClick } = setup();
        fireEvent.click(screen.getByTestId('life-goal-g1'));
        expect(onGoalClick).toHaveBeenCalledWith('g1');
        expect(onMilestoneClick).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('life-milestone-m1'));
        expect(onMilestoneClick).toHaveBeenCalledWith('m1');
        expect(onGoalClick).toHaveBeenCalledTimes(1);
    });

    it('keeps user text inside bdi', () => {
        setup();
        expect(screen.getByText('Moved city').tagName).toBe('BDI');
    });

    it('hides a layer when it is switched off', () => {
        setup({ showGoals: false });
        expect(screen.queryByTestId('life-goal-g1')).toBeNull();
        expect(screen.getByTestId('life-milestone-m1')).toBeTruthy();
    });

    it('zooms from decades to weeks and drops cards outside the range', () => {
        setup();
        fireEvent.click(screen.getByTestId('life-zoom-decades'));
        expect(screen.getByTestId('life-milestone-m1')).toBeTruthy();
        fireEvent.click(screen.getByTestId('life-zoom-weeks'));
        // 13 weeks either side of today: −400 days is out of view.
        expect(screen.queryByTestId('life-milestone-m1')).toBeNull();
        expect(
            screen.getByTestId('life-zoom-weeks').getAttribute('aria-pressed')
        ).toBe('true');
    });

    it('mirrors positions when the axis runs right to left', () => {
        setup({ axisRtl: false });
        const ltr = screen.getByTestId('life-goal-g1').style.transform;
        document.body.innerHTML = '';
        setup({ axisRtl: true });
        const rtl = screen.getByTestId('life-goal-g1').style.transform;
        const x = (t: string) => parseFloat(t.slice('translate('.length));
        // Card left edges mirror around the centre: x_rtl + card width = 1000 - x_ltr.
        expect(x(rtl) + 144).toBeCloseTo(1000 - x(ltr), 3);
    });

    it('labels the axis with Jalali years in the Persian calendar', () => {
        setLocalePreferences({ calendarSystem: 'persian', latinDigits: true });
        setup();
        const year = new Intl.DateTimeFormat('en-u-ca-persian', {
            year: 'numeric',
        })
            .format(new Date())
            .replace(/\D/g, '');
        expect(screen.getByTestId('life-timeline').textContent).toContain(year);
    });
});
