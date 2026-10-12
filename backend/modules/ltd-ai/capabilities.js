'use strict';
const { define, z } = require('../ltd-capabilities/registry');
const { FEATURES } = require('./context');
// Same definitions drive in-app calls and MCP discovery. Human manifest consent
// is enforced by the handler even if a remote client invokes this capability.
const AI_CAPABILITIES = FEATURES.map((feature) =>
    define({
        name: `ai_${feature}`,
        description: `Draft ${feature} using the configured provider, only after this feature's manifest has been approved in the app; writes remain pending Proposals.`,
        scope: ['why', 'review'].includes(feature) ? 'ltd.read' : 'ltd.propose',
        risk: ['why', 'review'].includes(feature) ? 'R0' : 'R2',
        input: z.strictObject({
            request: z.record(z.string(), z.unknown()),
            digest: z.string(),
            consent: z.literal(true),
        }),
        handler: (args, ctx) => {
            if (!ctx.human)
                throw new Error(
                    'Approve the context manifest in the app first'
                );
            return require('./service').generate(
                ctx.user,
                { ...args, request: { ...args.request, feature } },
                ctx.provider
            );
        },
    })
);
module.exports = { AI_CAPABILITIES };
