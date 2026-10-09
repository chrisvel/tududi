import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Welcome from '../Welcome';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

const applyStarter = jest.fn();
jest.mock('../../../utils/onboardingService', () => ({
    applyStarter: (...args: unknown[]) => applyStarter(...args),
}));

const result = {
    onboarding_starter: 'empty',
    onboarded_at: '2026-10-09T08:00:00.000Z',
    created: { areas: 0, goals: 0, projects: 0, tasks: 0, habits: 0, notes: 0 },
};

describe('Welcome', () => {
    beforeEach(() => {
        applyStarter.mockReset();
        applyStarter.mockResolvedValue(result);
    });

    it('shows the welcome video and one button', () => {
        render(<Welcome onDone={jest.fn()} />);

        expect(screen.getByTestId('welcome-video')).toHaveAttribute(
            'src',
            expect.stringContaining('youtube-nocookie.com/embed/hkwb9EmE4XE')
        );
        expect(screen.getByTestId('welcome-start')).toHaveTextContent(
            "I'm done, let's start"
        );
    });

    it("records the visit and reports back on Let's start", async () => {
        const onDone = jest.fn();
        render(<Welcome onDone={onDone} />);

        fireEvent.click(screen.getByTestId('welcome-start'));

        await waitFor(() => expect(onDone).toHaveBeenCalledWith(result));
        expect(applyStarter).toHaveBeenCalledWith({ key: 'empty' });
    });

    it('keeps the page and shows the error when it fails', async () => {
        applyStarter.mockRejectedValue(new Error('Network down'));
        const onDone = jest.fn();
        render(<Welcome onDone={onDone} />);

        fireEvent.click(screen.getByTestId('welcome-start'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Network down'
        );
        expect(onDone).not.toHaveBeenCalled();
        expect(screen.getByTestId('welcome-start')).not.toBeDisabled();
    });
});
