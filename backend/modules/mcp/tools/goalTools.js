'use strict';

// LTD-PATCH(T-407): Planning tools share owned progress reads; goal mutations await Journal/Proposal support.
// LTD-PATCH(T-703): the goal reads are defined once in the Capability Registry.
const { registerCapabilities } = require('../../ltd-capabilities/mcp');
const { GOAL_READS } = require('../../ltd-capabilities/catalog');

function registerGoalTools(server, context, tools) {
    registerCapabilities(context, tools, GOAL_READS);
}

module.exports = { registerGoalTools };
