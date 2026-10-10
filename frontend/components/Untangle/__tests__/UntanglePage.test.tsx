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
    fetchUntangleStatus: jest.fn(),
    untangle: jest.fn(),
    untangleSample: jest.fn(),
    keepUntangled: jest.fn(),
    stashPendingUntangle: jest.fn(),
    readPendingUntangle: jest.fn(),
    clearPendingUntangle: jest.fn(),
};
jest.mock('../../../utils/untangleService', () => ({
    fetchUntangleStatus: (...args: unknown[]) =>
        service.fetchUntangleStatus(...args),
    untangle: (...args: unknown[]) => service.untangle(...args),
    untangleSample: (...args: unknown[]) => service.untangleSample(...args),
    keepUntangled: (...args: unknown[]) => service.keepUntangled(...args),
    stashPendingUntangle: (...args: unknown[]) =>
        service.stashPendingUntangle(...args),
    readPendingUntangle: (...args: unknown[]) =>
        service.readPendingUntangle(...args),
    clearPendingUntangle: (...args: unknown[]) =>
        service.clearPendingUntangle(...args),
}));

const samples = [
    { key: 'family', label: 'Family week', text: 'dentist for Leo\ngym x3' },
    {
        key: 'moving',
        label: 'Moving flat',
        text: 'moving nov 1!!!\nask Sara about the van',
    },
];

const result = {
    today: { title: 'Call the landlord', reason: 'Someone is waiting.' },
    drop: [{ title: 'Piano', reason: 'No date.' }],
    tips: ['Two things wait on other people.'],
    people: [{ name: 'Maria', items: ['Contract from Maria'], waiting: 1 }],
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
                        {
                            title: 'Gather receipts',
                            due: null,
                            minutes: 60,
                            person: null,
                            tags: ['admin'],
                        },
                    ],
                },
            ],
            items: [
                {
                    title: 'Contract from Maria',
                    kind: 'waiting',
                    due: null,
                    person: 'Maria',
                    tags: [],
                    minutes: 15,
                    habit_period: null,
                    habit_times: null,
                },
                {
                    title: 'Gym',
                    kind: 'habit',
                    due: null,
                    person: null,
                    tags: [],
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
        service.fetchUntangleStatus.mockResolvedValue({
            available: true,
            samples,
        });
        service.untangle.mockResolvedValue({ result, token: 'signed.token' });
        service.untangleSample.mockResolvedValue({
            result,
            token: 'sample.token',
            sample: 'family',
        });
        service.stashPendingUntangle.mockReturnValue(true);
        service.readPendingUntangle.mockReturnValue(null);
        window.scrollTo = jest.fn();
    });

    it('says so when the instance has it switched off', async () => {
        service.fetchUntangleStatus.mockResolvedValue({
            available: false,
            samples: [],
        });
        renderPage();
        expect(
            await screen.findByText('Untangle is not available here')
        ).toBeInTheDocument();
    });

    it('wears its own name, not the app navbar', async () => {
        renderPage();
        expect(await screen.findByTestId('untangle-logo')).toHaveTextContent(
            'untangle.my'
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

    it('runs a sample for anyone, no account needed', async () => {
        renderPage(false);
        fireEvent.click(await screen.findByTestId('untangle-sample-moving'));
        const box = screen.getByTestId(
            'untangle-textarea'
        ) as HTMLTextAreaElement;
        expect(box.value).toContain('ask Sara about the van');
        fireEvent.click(screen.getByTestId('untangle-run'));

        expect(
            await screen.findByTestId('untangle-result')
        ).toBeInTheDocument();
        expect(service.untangleSample).toHaveBeenCalledWith(
            expect.objectContaining({ key: 'moving', answers: [] })
        );
        expect(service.untangle).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        // A sample result invites the person to try their own list
        expect(screen.getByTestId('untangle-own')).toBeInTheDocument();
        expect(screen.queryByTestId('untangle-keep')).not.toBeInTheDocument();
    });

    it('parks an own list and sends a stranger to sign up', async () => {
        renderPage(false);
        fireEvent.change(await screen.findByTestId('untangle-textarea'), {
            target: { value: 'call landlord\ngym x3' },
        });
        expect(screen.getByTestId('untangle-run')).toHaveTextContent(
            'free with an account'
        );
        fireEvent.click(screen.getByTestId('untangle-run'));

        expect(service.stashPendingUntangle).toHaveBeenCalledWith(
            expect.objectContaining({
                text: 'call landlord\ngym x3',
                image: null,
            })
        );
        expect(navigate).toHaveBeenCalledWith('/register', {
            state: { untangle: true },
        });
        expect(service.untangle).not.toHaveBeenCalled();
    });

    it('runs a parked list as soon as the person is signed in', async () => {
        service.readPendingUntangle.mockReturnValue({
            text: 'parked list',
            image: null,
            timezone: 'UTC',
            language: 'en',
        });
        renderPage(true);

        expect(
            await screen.findByTestId('untangle-result')
        ).toBeInTheDocument();
        expect(service.clearPendingUntangle).toHaveBeenCalled();
        expect(service.untangle).toHaveBeenCalledWith(
            expect.objectContaining({ text: 'parked list', answers: [] })
        );
        expect(screen.getByTestId('untangle-keep')).toBeInTheDocument();
    });

    it('explains when the free untangle is spent', async () => {
        const err = Object.assign(new Error('Your free plan allows 0'), {
            code: 'PLAN_LIMIT_REACHED',
        });
        service.untangle.mockRejectedValue(err);
        renderPage(true);
        fireEvent.change(await screen.findByTestId('untangle-textarea'), {
            target: { value: 'another list' },
        });
        fireEvent.click(screen.getByTestId('untangle-run'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'used your free untangle'
        );
    });

    it('shows the structure, the week and the question after a parse', async () => {
        renderPage(true);
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
        expect(screen.getAllByText('Taxes').length).toBeGreaterThan(0);
        expect(screen.getByText('waiting for Maria')).toBeInTheDocument();
        expect(screen.getByText('habit, 3x weekly')).toBeInTheDocument();
        expect(screen.getByText('30m')).toBeInTheDocument();
        // The sections: tips, the graph, people, habits, tags
        expect(screen.getByTestId('untangle-tips')).toHaveTextContent(
            'Two things wait on other people.'
        );
        expect(screen.getByTestId('untangle-graph')).toBeInTheDocument();
        expect(screen.getByTestId('untangle-people')).toHaveTextContent(
            'Maria'
        );
        expect(screen.getByTestId('untangle-habits')).toHaveTextContent('Gym');
        expect(screen.getByTestId('untangle-tags')).toHaveTextContent('#admin');
        expect(screen.getByTestId('untangle-questions')).toHaveTextContent(
            'Is Crete this month or someday?'
        );
        expect(screen.getByTestId('untangle-questions')).toHaveTextContent(
            'When are the taxes due?'
        );
    });

    it('re-runs once with every answer after all questions are picked', async () => {
        renderPage(true);
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

    it('goes back to an empty box for an own list after a sample', async () => {
        renderPage(false);
        fireEvent.click(await screen.findByTestId('untangle-sample-family'));
        fireEvent.click(screen.getByTestId('untangle-run'));
        await screen.findByTestId('untangle-result');

        fireEvent.click(screen.getByTestId('untangle-own'));

        const box = (await screen.findByTestId(
            'untangle-textarea'
        )) as HTMLTextAreaElement;
        expect(box.value).toBe('');
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
        renderPage(true);
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
