'use strict';
// T-801/803: safe tools for bounded provider loops, from the same registry.
// Domain writes are compiled into Proposals outside the model tool loop.
const { DATA } = require('../ltd-ai/context');
function toAiTools(capabilities, ctx) {
    return Object.fromEntries(
        capabilities
            .filter(
                (c) =>
                    c.risk === 'R0' &&
                    !c.name.startsWith('ai_') &&
                    c.name !== 'get_calendar_events'
            )
            .map((c) => [
                c.name,
                {
                    description: c.description,
                    inputSchema: c.input,
                    execute: async (args) => ({
                        label: DATA,
                        data: await c.handler(c.input.parse(args), ctx),
                    }),
                },
            ])
    );
}
module.exports = { toAiTools };
