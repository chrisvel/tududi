import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalendarDayView from '../Calendar/CalendarDayView';
import CalendarWeekView from '../Calendar/CalendarWeekView';

jest.mock('../../utils/profileService', () => ({
    getFirstDayOfWeek: jest.fn().mockResolvedValue(1),
    getLocaleFirstDayOfWeek: jest.fn().mockReturnValue(1),
}));

const event = (
    id: string,
    title: string,
    start: Date,
    end: Date,
    color = '#3b82f6'
) => ({
    id,
    title,
    start,
    end,
    type: 'event' as const,
    color,
});

const day = new Date(2026, 8, 24);

describe('Calendar view event durations', () => {
    it('renders a longer event taller than a short event in the day view', () => {
        render(
            <CalendarDayView
                currentDate={day}
                events={[
                    event(
                        'a',
                        'Long event',
                        new Date(2026, 8, 24, 9, 0),
                        new Date(2026, 8, 24, 10, 45)
                    ),
                    event(
                        'b',
                        'Short event',
                        new Date(2026, 8, 24, 11, 0),
                        new Date(2026, 8, 24, 11, 15)
                    ),
                ]}
            />
        );

        const long = screen.getByTitle(/Long event/);
        const short = screen.getByTitle(/Short event/);

        expect(parseFloat(long.style.height)).toBeGreaterThan(
            parseFloat(short.style.height)
        );
    });

    it('renders a longer event taller than a short event in the week view', async () => {
        render(
            <CalendarWeekView
                currentDate={day}
                events={[
                    event(
                        'a',
                        'Long event',
                        new Date(2026, 8, 24, 9, 0),
                        new Date(2026, 8, 24, 10, 45)
                    ),
                    event(
                        'b',
                        'Short event',
                        new Date(2026, 8, 24, 11, 0),
                        new Date(2026, 8, 24, 11, 15)
                    ),
                ]}
            />
        );

        const long = await screen.findByTitle(/Long event/);
        const short = await screen.findByTitle(/Short event/);

        expect(parseFloat(long.style.height)).toBeGreaterThan(
            parseFloat(short.style.height)
        );
    });

    it('does not overlap adjacent non-overlapping events in the day view', () => {
        render(
            <CalendarDayView
                currentDate={day}
                events={[
                    event(
                        'a',
                        'First',
                        new Date(2026, 8, 24, 9, 0),
                        new Date(2026, 8, 24, 10, 0)
                    ),
                    event(
                        'b',
                        'Second',
                        new Date(2026, 8, 24, 11, 0),
                        new Date(2026, 8, 24, 12, 0)
                    ),
                ]}
            />
        );

        const first = screen.getByTitle(/First/);
        const second = screen.getByTitle(/Second/);

        const firstBottom =
            parseFloat(first.style.top) + parseFloat(first.style.height);
        const secondTop = parseFloat(second.style.top);

        expect(firstBottom).toBeLessThanOrEqual(secondTop);
    });

    it('clamps an event ending at midnight of the next day to the end of the grid', () => {
        render(
            <CalendarDayView
                currentDate={day}
                events={[
                    event(
                        'a',
                        'Late event',
                        new Date(2026, 8, 24, 23, 0),
                        new Date(2026, 8, 25, 0, 0)
                    ),
                ]}
            />
        );

        const late = screen.getByTitle(/Late event/);

        const bottom =
            parseFloat(late.style.top) + parseFloat(late.style.height);

        expect(bottom).toBe(24 * 48);
    });

    it('positions a 2.5 hour event across the correct pitch in the day view', () => {
        render(
            <CalendarDayView
                currentDate={day}
                events={[
                    event(
                        'a',
                        'Two and a half',
                        new Date(2026, 8, 24, 11, 0),
                        new Date(2026, 8, 24, 13, 30)
                    ),
                ]}
            />
        );

        const el = screen.getByTitle(/Two and a half/);

        expect(parseFloat(el.style.top)).toBe(11 * 48);
        expect(parseFloat(el.style.height)).toBe(2.5 * 48);
    });

    it('positions a 2.5 hour event across the correct pitch in the week view', async () => {
        render(
            <CalendarWeekView
                currentDate={day}
                events={[
                    event(
                        'a',
                        'Two and a half',
                        new Date(2026, 8, 24, 11, 30),
                        new Date(2026, 8, 24, 14, 0)
                    ),
                ]}
            />
        );

        const el = await screen.findByTitle(/Two and a half/);

        // The block sits in its 11:00 row, so only the 30 minutes move it down.
        expect(el.style.top).toContain('36px');
        expect(el.style.top).toContain('0.25rem');
        expect(parseFloat(el.style.height)).toBe(2.5 * 72 - 8);
    });
});
