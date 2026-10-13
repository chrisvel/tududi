// Life-to-Day (T-704, T-706): Proposals and MCP access controls.
import { request } from './planningService';

export type ProposalStatus =
    | 'pending'
    | 'applied'
    | 'partially_applied'
    | 'rejected'
    | 'expired'
    | 'reverted';

interface OpBase {
    id: string;
    result?: 'applied' | 'failed';
    error?: string;
}
export type ProposalOp = OpBase &
    (
        | {
              type: 'schedule_block' | 'move_block';
              from_date?: string;
              date: string;
              task_uid: string;
              task_name: string;
              start_minute: number;
              duration_minutes: number;
          }
        | {
              type: 'create_task';
              title: string;
              est_min: number;
              starter_step: string;
          }
        | {
              type: 'create_goal';
              title: string;
              horizon: string;
              why?: string;
              parent_title?: string | null;
          }
        | {
              type: 'update_task';
              task_uid: string;
              task_name: string;
              before_day?: string | null;
              after: string;
          }
        // T-1104: life lessons proposed over MCP.
        | {
              type: 'create_lesson';
              title: string;
              if_text?: string | null;
              then_text?: string | null;
              links?: { type: string; uid: string; title?: string }[];
          }
        | {
              type: 'update_lesson';
              lesson_uid: string;
              lesson_title: string;
              changes: Record<string, string | null>;
              links?: { type: string; uid: string; title?: string }[];
          }
    );

export interface Proposal {
    uid: string;
    origin: 'in_app_ai' | 'mcp' | 'rule';
    client_id: string | null;
    title: string;
    rationale: string | null;
    ops: ProposalOp[];
    risk_tier: 'R0' | 'R1' | 'R2' | 'R3';
    status: ProposalStatus;
    expires_at: string;
    created_at: string;
    decided_at: string | null;
}

export interface McpClient {
    key: string;
    kind: 'oauth' | 'token' | 'session';
    name?: string | null;
    redirect_host?: string | null;
    scopes?: string[];
    connected_at?: string;
    last_used_at: string | null;
    writes_disabled_at: string | null;
}
export interface McpAccess {
    read_only: boolean;
    tokens_revoked_at: string | null;
    clients: McpClient[];
}

export const proposalKeys = {
    list: 'ltd:proposals',
    clients: 'ltd:mcp-clients',
};

export const fetchProposals = () =>
    request<{ proposals: Proposal[] }>('proposals');
export const applyProposal = (uid: string, opIds?: string[]) =>
    request<Proposal>(
        `proposals/${uid}/apply`,
        'POST',
        opIds ? { op_ids: opIds } : {}
    );
export const rejectProposal = (uid: string) =>
    request<Proposal>(`proposals/${uid}/reject`, 'POST', {});
export const undoProposal = (uid: string) =>
    request<Proposal>(`proposals/${uid}/undo`, 'POST', {});

export const fetchMcpAccess = () => request<McpAccess>('mcp/clients');
export const revokeMcpClient = (key: string) =>
    request<McpAccess>(
        `mcp/clients/${encodeURIComponent(key)}/revoke`,
        'POST',
        {}
    );
export const enableMcpWrites = (key: string) =>
    request<McpAccess>(
        `mcp/clients/${encodeURIComponent(key)}/enable-writes`,
        'POST',
        {}
    );
export const mcpKillSwitch = () =>
    request<McpAccess>('mcp/kill-switch', 'POST', {});
export const setMcpReadOnly = (on: boolean) =>
    request<McpAccess>('mcp/read-only', 'PUT', { on });
