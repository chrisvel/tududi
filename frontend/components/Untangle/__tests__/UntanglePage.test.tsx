import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import UntanglePage from '../UntanglePage';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, options?: any) => {
            let text = fallback ?? key;
            if (options) {
                for (const [k, v] of Object.entries(options)) {
                    text = text.replace(`{{${k}}}`, String(v));
                }
            }
            return text;
        },
        i18n: { language: 'en' },
    }),
}));

const navigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => navigate,
}));

const service = {
    isUntangleAvailable: jest.fn(),
    untangle: jest.fn(),
    keepUntangled: jest.fn(),
    stashPendingUntangle: jest.fn(),
};
jest.mock('../../../utils/untangleService', () => ({
    isUntangleAvailable: (...args: unknown[]) =>
        service.isUntangleAvailable(...args),
    untangle: (...args: unknown[]) => service.untangle(...args),
    keepUntangled: (...args: unknown[]) => service.keepUntangled(...args),
    stashPendingUntangle: (...args: unknown[]) =>
        service.stashPendingUntangle(...args),
}));

const result = {
    today: { title: 'Call the landlord', reason: 'Someone is waiting.' },
    drop: [{ title: 'Piano', reason: 'No date.' }],
    questions: [
        {
            text: 'Is Crete this month or someday?',
            options: ['This month', 'Someday'],
        },
        {
            text: 'When are the taxes due?',
            options: ['This month', 'Next month'],
        },
    ],
    areas: [
        {
            name: 'Home',
            goal: { title: 'Settle the flat', why: '' },
            projects: [
                {
                    name: 'Taxes',
                    tasks: [
                        { title: 'Gather receipts', due: null, minutes: 60 },
                    ],
                },
            ],
            items: [
                {
                    title: 'Contract from Maria',
                    kind: 'waiting',
                    due: null,
                    person: 'Maria',
                    minutes: 15,
                    habit_period: null,
                    habit_times: null,
                },
                {
                    title: 'Gym',
                    kind: 'habit',
                    due: null,
                    person: null,
                    minutes: 60,
                    habit_period: 'weekly',
                    habit_times: 3,
                },
            ],
        },
    ],
    week: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-10-1${i}`,
        weekday: 'Mon',
        minutes: i === 0 ? 30 : 0,
        titles: [],
    })),
};

const renderPage = (isSignedIn = false, onKept = jest.fn()) =>
    render(
        <MemoryRouter>
            <UntanglePage isSignedIn={isSignedIn} onKept={onKept} />
        </MemoryRouter>
    );

describe('UntanglePage', () => {
    beforeEach(() => {
        navigate.mockReset();
        Object.values(service).forEach((fn) => fn.mockReset());
        service.isUntangleAvailable.mockResolvedValue(true);
        service.untangle.mockResolvedValue({ result, token: 'signed.token' });
        service.stashPendingUntangle.mockReturnValue(true);
        window.scrollTo = jest.fn();
    });

    it('says so when the instance has it switched off', async () => {
        service.isUntangleAvailable.mockResolvedValue(false);
        renderPage();
        expect(
            await screen.findByText('Untangle is not available here')
        ).toBeInTheDocument();
    });

    it('wears its own name, not the app navbar', async () => {
        renderPage();
        expect(await screen.findByTestId('untangle-logo')).toHaveTextContent(
            'untangle.me'
        );
        expect(screen.queryByAltText('tududi')).not.toBeInTheDocument();
    });

    it('needs something pasted before it runs', async () => {
        renderPage();
        const run = await screen.findByTestId('untangle-run');
        expect(run).toBeDisabled();
        fireEvent.change(screen.getByTestId('untangle-textarea'), {
            target: { value: 'gym x3' },
        });
        expect(run).toBeEnabled();
    });

    it('fills the box with a sample list for people who keep their own private', async () => {
        renderPage();
        fireEvent.click(await screen.findByTestId('untangle-sample-moving'));
        const box = screen.getByTestId(
            'untangle-textarea'
        ) as HTMLTextAreaElement;
        expect(box.value).toContain('moving nov 1!!!');
        expect(box.value).toContain('ask Sara about the van');
        expect(screen.getByTestId('untangle-run')).toBeEnabled();
    });

    it('shows the structure, the week and the question after a parse', async () => {
        renderPage();
        fireEvent.change(await screen.findByTestId('untangle-textarea'), {
            target: { value: 'call landlord\ngym x3' },
        });
        fireEvent.click(screen.getByTestId('untangle-run'));

        expect(
            await screen.findByTestId('untangle-result')
        ).toBeInTheDocument();
        expect(service.untangle).toHaveBeenCalledWith(
            expect.objectContaining({
                text: 'call landlord\ngym x3',
                image: null,
                answers: [],
            })
        );
        expect(screen.getByText('Call the landlord')).toBeInTheDocument();
        expect(screen.getByText('Piano')).toBeInTheDocument();
        expect(screen.getByText('Goal: Settle the flat')).toBeInTheDocument();
        expect(screen.getByText('Taxes')).toBeInTheDocument();
        expect(screen.getByText('waiting for Maria')).toBeInTheDocument();
        expect(screen.getByText('habit, 3x weekly')).toBeInTheDocument();
        expect(screen.getByText('30m')).toBeInTheDocument();
        expect(screen.getByTestId('untangle-questions')).toHaveTextContent(
            'Is Crete this month or someday?'
        );
        expect(screen.getByTestId('untangle-questions')).toHaveTextContent(
            'When are the taxes due?'
        );
    });

    it('re-runs once with every answer after all questions are picked', async () => {
        renderPage();
        fireEvent.change(await screen.findByTestId('untangle-textarea'), {
            target: { value: 'crete??' },
        });
        fireEvent.click(screen.getByTestId('untangle-run'));
        await screen.findByTestId('untangle-result');

        const update = screen.getByTestId('untangle-answer');
        expect(update).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Someday' }));
        expect(update).toBeDisabled();
        expect(service.untangle).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
        expect(update).toBeEnabled();
        fireEvent.click(update);

        await waitFor(() => expect(service.untangle).toHaveBeenCalledTimes(2));
        expect(service.untangle).toHaveBeenLastCalledWith(
            expect.objectContaining({
                answers: [
                    {
                        question: 'Is Crete this month or someday?',
                        answer: 'Someday',
                    },
                    {
                        question: 'When are the taxes due?',
                        answer: 'Next month',
                    },
                ],
            })
        );
    });

    it('parks the plan and goes to sign-up on Keep it when signed out', async () => {
        renderPage(false);
        fireEvent.change(await screen.findByTestId('untangle-textarea'), {
            target: { value: 'gym x3' },
        });
        fireEvent.click(screen.getByTestId('untangle-run'));
        await screen.findByTestId('untangle-result');

        fireEvent.click(screen.getByTestId('untangle-keep'));

        expect(service.stashPendingUntangle).toHaveBeenCalledWith(
            'signed.token'
        );
        expect(navigate).toHaveBeenCalledWith('/register', {
            state: { untangle: true },
        });
        expect(service.keepUntangled).not.toHaveBeenCalled();
    });

    it('keeps the plan straight away when signed in', async () => {
        const kept = {
            onboarding_starter: 'untangle',
            onboarded_at: '2026-10-10T08:00:00.000Z',
            created: {
                areas: 1,
                goals: 1,
                projects: 1,
                tasks: 2,
                habits: 1,
                people: 1,
            },
        };
        service.keepUntangled.mockResolvedValue(kept);
        const onKept = jest.fn();
        renderPage(true, onKept);
        fireEvent.change(await screen.findByTestId('untangle-textarea'), {
            target: { value: 'gym x3' },
        });
        fireEvent.click(screen.getByTestId('untangle-run'));
        await screen.findByTestId('untangle-result');

        fireEvent.click(screen.getByTestId('untangle-keep'));

        await waitFor(() => expect(onKept).toHaveBeenCalledWith(kept));
        expect(service.keepUntangled).toHaveBeenCalledWith('signed.token');
        expect(service.stashPendingUntangle).not.toHaveBeenCalled();
    });

    it('stays on the input and shows the error when the parse fails', async () => {
        service.untangle.mockRejectedValue(new Error('Too many tries'));
        renderPage();
        fireEvent.change(await screen.findByTestId('untangle-textarea'), {
            target: { value: 'gym x3' },
        });
        fireEvent.click(screen.getByTestId('untangle-run'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Too many tries'
        );
        expect(screen.getByTestId('untangle-input')).toBeInTheDocument();
    });
});
