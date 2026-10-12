'use strict';

// Life-to-Day (T-704): Proposals (blueprint 16.2, 16.3). An R2/R3 change from
// MCP or AI is stored here and changes nothing until the signed-in user
// applies it; apply and Undo go through the Journal.
const repository = require('./repository');
const { TYPES, applyOps } = require('./ops');
const journal = require('../ltd-journal/service');
const journalRepository = require('../ltd-journal/repository');
const {
    NotFoundError,
    ConflictError,
    ValidationError,
} = require('../../shared/errors');

const TTL_DAYS = 7;
const MAX_OPS = 50;
// Bulk changes are R3 (blueprint 16.3): in-app approval only, which is the
// only way any Proposal is applied in this phase.
const BULK_OPS = 10;

const decode = (value) =>
    typeof value === 'string' ? JSON.parse(value) : value;
const actorType = { mcp: 'mcp', in_app_ai: 'ai', rule: 'system' };

const serialize = (proposal) => ({
    uid: proposal.uid,
    origin: proposal.origin,
    client_id: proposal.client_id,
    title: proposal.title,
    rationale: proposal.rationale,
    ops: decode(proposal.ops),
    risk_tier: proposal.risk_tier,
    status: proposal.status,
    expires_at: proposal.expires_at,
    created_at: proposal.created_at,
    decided_at: proposal.decided_at,
});

async function propose(
    userId,
    { origin = 'mcp', client_id = null, title, rationale = null, ops }
) {
    if (!Array.isArray(ops) || !ops.length || ops.length > MAX_OPS)
        throw new ValidationError(`A proposal holds 1 to ${MAX_OPS} changes`);
    if (ops.some((op) => !TYPES.includes(op?.type)))
        throw new ValidationError('Unknown proposal operation');
    if (typeof title !== 'string' || !title.trim())
        throw new ValidationError('A proposal needs a title');
    const proposal = await repository.create({
        user_id: userId,
        origin,
        client_id,
        title: title.trim().slice(0, 255),
        rationale,
        ops: ops.map((op, index) => ({ ...op, id: `op${index + 1}` })),
        risk_tier: ops.length > BULK_OPS ? 'R3' : 'R2',
        expires_at: new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000),
    });
    return serialize(proposal);
}

async function find(userId, uid) {
    await repository.expire(userId);
    const proposal = await repository.find(userId, uid);
    if (!proposal) throw new NotFoundError('Proposal not found');
    return proposal;
}

async function list(userId, status) {
    await repository.expire(userId);
    return (await repository.list(userId, status)).map(serialize);
}

async function get(userId, uid) {
    return serialize(await find(userId, uid));
}

async function apply(user, uid, opIds) {
    const proposal = await find(user.id, uid);
    if (proposal.status !== 'pending')
        throw new ConflictError(`This proposal is ${proposal.status}`);
    const ops = decode(proposal.ops);
    if (
        opIds !== undefined &&
        (!Array.isArray(opIds) ||
            !opIds.length ||
            opIds.some((id) => !ops.some((op) => op.id === id)))
    )
        throw new ValidationError('op_ids must name changes in this proposal');
    const selected = opIds ? ops.filter((op) => opIds.includes(op.id)) : ops;
    const now = new Date();
    if (!(await repository.claim(proposal, now)))
        throw new ConflictError('This proposal is already being decided');
    const results = await applyOps(user, selected, {
        user_id: user.id,
        actor_type: actorType[proposal.origin],
        actor_id: proposal.client_id,
        proposal_id: proposal.id,
    });
    const next = ops.map((op) =>
        results[op.id]
            ? {
                  ...op,
                  result: results[op.id].error ? 'failed' : 'applied',
                  error: results[op.id].error || undefined,
              }
            : op
    );
    const applied = next.filter((op) => op.result === 'applied').length;
    if (!applied) {
        await proposal.update({ ops: next, decided_at: null });
        throw new ConflictError(
            next.find((op) => op.error)?.error || 'Nothing could be applied'
        );
    }
    await proposal.update({
        ops: next,
        status: applied === ops.length ? 'applied' : 'partially_applied',
        decided_at: now,
    });
    return serialize(proposal);
}

async function reject(userId, uid) {
    const proposal = await find(userId, uid);
    if (proposal.status !== 'pending')
        throw new ConflictError(`This proposal is ${proposal.status}`);
    await proposal.update({ status: 'rejected', decided_at: new Date() });
    return serialize(proposal);
}

// Undo every change the proposal made, newest first, in one transaction.
async function undo(userId, uid) {
    const proposal = await find(userId, uid);
    if (!['applied', 'partially_applied'].includes(proposal.status))
        throw new ConflictError('Only an applied proposal can be undone');
    const entries = await journalRepository.byProposal(userId, proposal.id);
    if (entries.length)
        await journal.revert(
            userId,
            entries.map((entry) => entry.uid)
        );
    await proposal.update({ status: 'reverted', decided_at: new Date() });
    return serialize(proposal);
}

module.exports = { propose, list, get, apply, reject, undo, TTL_DAYS };
