'use strict';

const { registerTaskTools } = require('./tools/taskTools');
const { registerCommentTools } = require('./tools/commentTools');
const { registerProjectTools } = require('./tools/projectTools');
const { registerInboxTools } = require('./tools/inboxTools');
const { registerMiscTools } = require('./tools/miscTools');
const { registerHabitTools } = require('./tools/habitTools');
const { registerAreaTools } = require('./tools/areaTools');
const { registerTagTools } = require('./tools/tagTools');
const { registerNoteTools } = require('./tools/noteTools');
const { registerViewTools } = require('./tools/viewTools');
const { registerPeopleTools } = require('./tools/peopleTools');
// LTD-PATCH(T-703): Life-to-Day tools come from the Capability Registry.
const { registerCapabilities, clientOf } = require('../ltd-capabilities/mcp');

// LTD-PATCH(T-407): Neither MCP transport may advertise or dispatch legacy hard deletion tools.
const isDestructiveTool = (name) => /^(delete|remove)_/.test(name);
const isLegacyRead = (name) => /^(list|get)_/.test(name) || name === 'search';

function registerAllTools(server, context, tools) {
    registerTaskTools(server, context, tools);
    registerCommentTools(server, context, tools);
    registerProjectTools(server, context, tools);
    registerInboxTools(server, context, tools);
    registerMiscTools(server, context, tools);
    registerHabitTools(server, context, tools);
    registerAreaTools(server, context, tools);
    registerTagTools(server, context, tools);
    registerNoteTools(server, context, tools);
    registerViewTools(server, context, tools);
    registerPeopleTools(server, context, tools);
    // LTD-PATCH(T-703): legacy writes bypass the Journal, so an OAuth client
    // sees only legacy reads; read-only mode stops legacy writes for tokens.
    const client = clientOf(context);
    for (let index = tools.length - 1; index >= 0; index--) {
        const tool = tools[index];
        const read = isLegacyRead(tool.name);
        if (
            isDestructiveTool(tool.name) ||
            (client.kind === 'oauth' &&
                (!read || !client.scopes.includes('ltd.read')))
        ) {
            tools.splice(index, 1);
        } else if (!read) {
            const handler = tool.handler;
            tool.handler = (...args) => {
                if (client.readOnly)
                    throw new Error(
                        'read_only: Life-to-Day is in read-only mode for MCP'
                    );
                return handler(...args);
            };
        }
    }
    registerCapabilities(context, tools);
}

module.exports = { registerAllTools, isDestructiveTool };
