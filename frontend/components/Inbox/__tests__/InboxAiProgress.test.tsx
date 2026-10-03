import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import InboxAiProgress from '../InboxAiProgress';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback: string) => fallback,
    }),
}));

describe('InboxAiProgress', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('rotates through messages and counts seconds while it works', () => {
        render(<InboxAiProgress scope="all" />);
        const status = screen.getByTestId('inbox-ai-progress');

        expect(status).toHaveTextContent('Reading your inbox…');

        act(() => {
            jest.advanceTimersByTime(2800);
        });
        expect(status).toHaveTextContent('Spotting actions and deadlines…');
        expect(status).toHaveTextContent('2s');

        act(() => {
            jest.advanceTimersByTime(2800 * 9);
        });
        expect(status).toHaveTextContent('Reading your inbox…');
    });

    it('starts with the item message for a single item', () => {
        render(<InboxAiProgress scope="item" />);

        expect(screen.getByRole('status')).toHaveTextContent(
            'Reading this item…'
        );
    });
});
