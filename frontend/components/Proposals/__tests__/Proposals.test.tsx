import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import useSWR from 'swr';
import ProposalCard from '../ProposalCard';
import McpClientsPanel from '../McpClientsPanel';
import {
    Proposal,
    applyProposal,
    rejectProposal,
    undoProposal,
    mcpKillSwitch,
    revokeMcpClient,
} from '../../../utils/proposalsService';

jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../utils/proposalsService', () => ({
    proposalKeys: { list: 'list', clients: 'clients' },
    applyProposal: jest.fn().mockResolvedValue({}),
    rejectProposal: jest.fn().mockResolvedValue({}),
    undoProposal: jest.fn().mockResolvedValue({}),
    fetchMcpAccess: jest.fn(),
    mcpKillSwitch: jest.fn(),
    revokeMcpClient: jest.fn(),
    enableMcpWrites: jest.fn(),
    setMcpReadOnly: jest.fn(),
}));

const proposal: Proposal = {
    uid: 'p1',
    origin: 'mcp',
    client_id: 'oauth:abc',
    title: 'Plan for 2026-10-13',
    rationale: 'Load 0.4',
    risk_tier: 'R2',
    status: 'pending',
    expires_at: '2026-10-20T00:00:00Z',
    created_at: '2026-10-12T10:00:00Z',
    decided_at: null,
    ops: [
        {
            id: 'op1',
            type: 'schedule_block',
            date: '2026-10-13',
            task_uid: 't1',
            task_name: 'نوشتن فصل',
            start_minute: 540,
            duration_minutes: 45,
        },
        {
            id: 'op2',
            type: 'update_task',
            task_uid: 't2',
            task_name: 'Email Sam',
            before_day: null,
            after: '2026-10-14',
        },
    ],
};

beforeEach(() => jest.clearAllMocks());

describe('ProposalCard', () => {
    it('previews each change with user text isolated in bdi', () => {
        const { container } = render(
            <ProposalCard proposal={proposal} onChanged={jest.fn()} />
        );
        expect(screen.getByText('09:00–09:45')).toBeInTheDocument();
        const bdis = Array.from(container.querySelectorAll('bdi')).map(
            (b) => b.textContent
        );
        expect(bdis).toEqual(
            expect.arrayContaining([
                'Plan for 2026-10-13',
                'Load 0.4',
                'نوشتن فصل',
                'Email Sam',
                'oauth:abc',
            ])
        );
        expect(
            screen.getByText('ltdProposals.nothingChanged')
        ).toBeInTheDocument();
    });

    it('applies all, a selection, or rejects', async () => {
        const onChanged = jest.fn();
        render(<ProposalCard proposal={proposal} onChanged={onChanged} />);
        fireEvent.click(screen.getByText('ltdProposals.applyAll'));
        await waitFor(() =>
            expect(applyProposal).toHaveBeenCalledWith('p1', undefined)
        );
        fireEvent.click(screen.getAllByLabelText('ltdProposals.include')[1]);
        fireEvent.click(screen.getByText('ltdProposals.applySelected'));
        await waitFor(() =>
            expect(applyProposal).toHaveBeenCalledWith('p1', ['op1'])
        );
        fireEvent.click(screen.getByText('ltdProposals.reject'));
        await waitFor(() => expect(rejectProposal).toHaveBeenCalledWith('p1'));
        expect(onChanged).toHaveBeenCalledTimes(3);
    });

    it('offers Undo once applied and shows a failed change', async () => {
        render(
            <ProposalCard
                proposal={{
                    ...proposal,
                    status: 'partially_applied',
                    ops: [
                        { ...proposal.ops[0], result: 'applied' },
                        {
                            ...proposal.ops[1],
                            result: 'failed',
                            error: 'Task not found',
                        },
                    ],
                }}
                onChanged={jest.fn()}
            />
        );
        expect(screen.queryByText('ltdProposals.applyAll')).toBeNull();
        expect(screen.getByText('Task not found')).toBeInTheDocument();
        fireEvent.click(screen.getByText('ltdProposals.undo'));
        await waitFor(() => expect(undoProposal).toHaveBeenCalledWith('p1'));
    });
});

describe('McpClientsPanel', () => {
    const access = {
        read_only: false,
        tokens_revoked_at: null,
        clients: [
            {
                key: 'oauth:abc',
                kind: 'oauth',
                name: 'Claude',
                redirect_host: 'claude.ai',
                scopes: ['ltd.read'],
                last_used_at: null,
                writes_disabled_at: null,
            },
        ],
    };

    it('revokes one client and asks before the kill switch', async () => {
        const mutate = jest.fn();
        (useSWR as jest.Mock).mockReturnValue({ data: access, mutate });
        (revokeMcpClient as jest.Mock).mockResolvedValue(access);
        (mcpKillSwitch as jest.Mock).mockResolvedValue(access);
        render(
            <MemoryRouter>
                <McpClientsPanel />
            </MemoryRouter>
        );
        expect(screen.getByText('claude.ai')).toBeInTheDocument();
        fireEvent.click(screen.getByText('ltdProposals.clients.revoke'));
        await waitFor(() =>
            expect(revokeMcpClient).toHaveBeenCalledWith('oauth:abc')
        );
        fireEvent.click(screen.getByText('ltdProposals.clients.kill'));
        expect(mcpKillSwitch).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('ltdProposals.clients.killYes'));
        await waitFor(() => expect(mcpKillSwitch).toHaveBeenCalled());
    });
});
