import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StarterPicker from '../StarterPicker';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, vars?: Record<string, unknown>) => {
            let text = fallback ?? key;
            if (vars) {
                for (const [name, value] of Object.entries(vars)) {
                    text = text.replace(`{{${name}}}`, String(value));
                }
            }
            return text;
        },
    }),
}));

const applyStarter = jest.fn();
jest.mock('../../../utils/onboardingService', () => ({
    applyStarter: (...args: unknown[]) => applyStarter(...args),
}));

const result = {
    onboarding_starter: 'household',
    onboarded_at: '2026-10-09T08:00:00.000Z',
    created: { areas: 4, goals: 4, projects: 3, tasks: 5, habits: 2, notes: 1 },
};

describe('StarterPicker', () => {
    beforeEach(() => {
        applyStarter.mockReset();
        applyStarter.mockResolvedValue(result);
    });

    it('shows the four starters, the video and the household preview first', () => {
        render(<StarterPicker onDone={jest.fn()} />);

        expect(screen.getByTestId('starter-video')).toHaveAttribute(
            'src',
            expect.stringContaining('youtube-nocookie.com/embed/hkwb9EmE4XE')
        );
        expect(screen.getAllByRole('radio')).toHaveLength(4);
        expect(screen.getByTestId('starter-card-household')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(screen.getByTestId('starter-submit')).toHaveTextContent(
            'Set up Running a household'
        );
        expect(screen.getByTestId('starter-preview')).toHaveTextContent(
            'Fix-ups around the house'
        );
    });

    it('switches the preview and button when another card is picked', () => {
        render(<StarterPicker onDone={jest.fn()} />);

        fireEvent.click(screen.getByTestId('starter-card-studying'));

        expect(screen.getByTestId('starter-card-studying')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(screen.getByTestId('starter-submit')).toHaveTextContent(
            'Set up Studying'
        );
        expect(screen.getByTestId('starter-preview')).toHaveTextContent(
            'Thesis'
        );
    });

    it('moves the selection with the arrow keys', () => {
        render(<StarterPicker onDone={jest.fn()} />);

        fireEvent.keyDown(screen.getByTestId('starter-card-household'), {
            key: 'ArrowDown',
        });

        expect(screen.getByTestId('starter-card-work-side')).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });

    it('sends the chosen starter with its structure and reports back', async () => {
        const onDone = jest.fn();
        render(<StarterPicker onDone={onDone} />);

        fireEvent.click(screen.getByTestId('starter-submit'));

        await waitFor(() =>
            expect(onDone).toHaveBeenCalledWith(result, 'household')
        );
        const payload = applyStarter.mock.calls[0][0];
        expect(payload.key).toBe('household');
        expect(payload.areas.map((a: { name: string }) => a.name)).toEqual([
            'Home',
            'Kids',
            'Money',
            'Me',
        ]);
        expect(payload.habits).toHaveLength(2);
        expect(payload.note.title).toBe('How this is set up');
        expect(payload.areas[0].tasks[0]).toEqual({
            name: 'Call the dentist',
            due: 'today',
            tags: ['home'],
        });
    });

    it('records "empty" for Start empty', async () => {
        const onDone = jest.fn();
        applyStarter.mockResolvedValue({
            ...result,
            onboarding_starter: 'empty',
        });
        render(<StarterPicker onDone={onDone} />);

        fireEvent.click(screen.getByTestId('starter-empty'));

        await waitFor(() => expect(onDone).toHaveBeenCalled());
        expect(applyStarter).toHaveBeenCalledWith({ key: 'empty' });
        expect(onDone.mock.calls[0][1]).toBe('empty');
    });

    it('keeps the screen and shows the error when setting up fails', async () => {
        applyStarter.mockRejectedValue(new Error('Plan limit reached'));
        const onDone = jest.fn();
        render(<StarterPicker onDone={onDone} />);

        fireEvent.click(screen.getByTestId('starter-submit'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Plan limit reached'
        );
        expect(onDone).not.toHaveBeenCalled();
        expect(screen.getByTestId('starter-submit')).not.toBeDisabled();
    });
});
