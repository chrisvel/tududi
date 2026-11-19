'use strict';

const {
    registerViewTools,
} = require('../../../../modules/mcp/tools/viewTools');

const DATE_FILTERS = [
    'today',
    'tomorrow',
    'this_week',
    'next_week',
    'next_month',
];

function dueProperty(toolName) {
    const tools = [];
    registerViewTools(null, { userId: 1 }, tools);
    const tool = tools.find((entry) => entry.name === toolName);
    return tool.inputSchema.properties.due;
}

describe('view tool due filter schema', () => {
    it('lists the date filters create_view and update_view actually apply', () => {
        for (const toolName of ['create_view', 'update_view']) {
            const due = dueProperty(toolName);
            expect(due.enum).toEqual(DATE_FILTERS);
            for (const value of DATE_FILTERS) {
                expect(due.description).toContain(value);
            }
        }
    });
});
