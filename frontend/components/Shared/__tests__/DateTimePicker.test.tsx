import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DateTimePicker from '../DateTimePicker';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
        i18n: { language: 'en' },
    }),
}));

jest.mock('../../../utils/localeUtils', () => ({
    resolveUserLocale: () => 'en-US',
}));

jest.mock('../../../utils/profileService', () => ({
    getFirstDayOfWeek: jest.fn().mockResolvedValue(1),
    getLocaleFirstDayOfWeek: jest.fn().mockReturnValue(1),
}));

describe('DateTimePicker shortcuts', () => {
    beforeEach(() => {
        jest.useFakeTimers({ now: new Date(2026, 9, 28, 16, 10) }); // Wednesday
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const open = (value: string, onChange: jest.Mock) => {
        render(<DateTimePicker value={value} onChange={onChange} />);
        fireEvent.click(screen.getAllByRole('button')[0]);
    };

    it('sets a whole-day date at local midnight when empty', () => {
        const onChange = jest.fn();
        open('', onChange);

        fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));

        expect(onChange).toHaveBeenCalledWith(
            new Date(2026, 9, 29, 0, 0).toISOString()
        );
        expect(
            screen.queryByRole('button', { name: 'Weekend' })
        ).not.toBeInTheDocument();
    });

    it('keeps the time of an existing value', () => {
        const onChange = jest.fn();
        open(new Date(2026, 9, 20, 9, 30).toISOString(), onChange);

        fireEvent.click(screen.getByRole('button', { name: 'Weekend' }));

        expect(onChange).toHaveBeenCalledWith(
            new Date(2026, 9, 31, 9, 30).toISOString()
        );
    });
});
