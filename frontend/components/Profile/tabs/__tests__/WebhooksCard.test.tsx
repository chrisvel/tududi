import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WebhooksCard from '../WebhooksCard';
import {
    createWebhook,
    deleteWebhook,
    listWebhooks,
    testWebhook,
} from '../../../../utils/webhooksService';
import { useTrialLock } from '../../../../hooks/useTrialStatus';

jest.mock('../../../../utils/webhooksService', () => ({
    ...jest.requireActual('../../../../utils/webhooksService'),
    listWebhooks: jest.fn(),
    createWebhook: jest.fn(),
    updateWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
    rotateWebhookSecret: jest.fn(),
    testWebhook: jest.fn(),
    listWebhookDeliveries: jest.fn(),
}));

jest.mock('../../../../hooks/useTrialStatus', () => ({
    useTrialLock: jest.fn(() => false),
}));

const mockList = listWebhooks as jest.Mock;
const mockCreate = createWebhook as jest.Mock;
const mockDelete = deleteWebhook as jest.Mock;
const mockTest = testWebhook as jest.Mock;
const mockLock = useTrialLock as jest.Mock;

const saved = {
    uid: 'wh1',
    name: 'n8n',
    host: 'n8n.example.com',
    events: ['task.completed'],
    summary_hour: 8,
    enabled: true,
    disabled_reason: null,
    failure_count: 0,
    last_delivery_at: null,
    last_delivery_status: null,
    created_at: '2026-10-24T08:00:00.000Z',
};

const renderCard = () =>
    render(
        <MemoryRouter>
            <WebhooksCard />
        </MemoryRouter>
    );

describe('WebhooksCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLock.mockReturnValue(false);
    });

    it('creates a webhook and shows its secret once', async () => {
        mockList.mockResolvedValue([]);
        mockCreate.mockResolvedValue({ ...saved, secret: 'whsec_abc' });

        renderCard();
        fireEvent.click(
            await screen.findByRole('button', { name: /add webhook/i })
        );

        fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
            target: { value: 'n8n' },
        });
        fireEvent.change(
            screen.getByRole('textbox', { name: /webhook address/i }),
            { target: { value: 'https://n8n.example.com/webhook/x' } }
        );
        // Due soon, overdue and reminder start picked; add completed.
        fireEvent.click(
            screen.getByRole('checkbox', { name: /task completed/i })
        );
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

        await waitFor(() =>
            expect(mockCreate).toHaveBeenCalledWith({
                name: 'n8n',
                url: 'https://n8n.example.com/webhook/x',
                events: [
                    'task.due_soon',
                    'task.overdue',
                    'task.reminder',
                    'task.completed',
                ],
                summary_hour: 8,
            })
        );
        expect(await screen.findByText('whsec_abc')).toBeInTheDocument();
        expect(screen.getByText('n8n.example.com')).toBeInTheDocument();
    });

    it('saves without submitting the settings form around it', async () => {
        mockList.mockResolvedValue([]);
        mockCreate.mockResolvedValue({ ...saved, secret: 'whsec_abc' });
        const outerSubmit = jest.fn((e) => e.preventDefault());

        render(
            <MemoryRouter>
                <form onSubmit={outerSubmit}>
                    <WebhooksCard />
                </form>
            </MemoryRouter>
        );
        fireEvent.click(
            await screen.findByRole('button', { name: /add webhook/i })
        );
        fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
            target: { value: 'n8n' },
        });
        fireEvent.change(
            screen.getByRole('textbox', { name: /webhook address/i }),
            { target: { value: 'https://n8n.example.com/webhook/x' } }
        );
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

        await waitFor(() => expect(mockCreate).toHaveBeenCalled());
        expect(outerSubmit).not.toHaveBeenCalled();
    });

    it('asks once more before deleting', async () => {
        mockList.mockResolvedValue([saved]);
        mockDelete.mockResolvedValue({ deleted: true });

        renderCard();
        const del = await screen.findByRole('button', { name: /^delete$/i });
        fireEvent.click(del);
        expect(mockDelete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /delete it\?/i }));

        await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('wh1'));
        await waitFor(() =>
            expect(screen.queryByText('n8n.example.com')).toBeNull()
        );
    });

    it('reports a failed test', async () => {
        mockList.mockResolvedValue([saved]);
        mockTest.mockRejectedValue(
            new Error('The webhook did not accept the message: HTTP 401')
        );

        renderCard();
        fireEvent.click(await screen.findByRole('button', { name: /^test$/i }));

        expect(await screen.findByRole('status')).toHaveTextContent('HTTP 401');
    });

    it('explains a webhook that turned itself off', async () => {
        mockList.mockResolvedValue([
            { ...saved, enabled: false, disabled_reason: 'failures' },
        ]);

        renderCard();
        expect(
            await screen.findByText(/too many failed deliveries/i)
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /turn on/i })).toBeEnabled();
    });

    it('offers nothing new on the trial', async () => {
        mockLock.mockReturnValue(true);
        mockList.mockResolvedValue([]);

        renderCard();
        await waitFor(() => expect(mockList).toHaveBeenCalled());
        expect(
            screen.queryByRole('button', { name: /add webhook/i })
        ).toBeNull();
    });
});
