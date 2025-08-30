const config = require('./config.json');
const conditions = require('./conditions');
const { createRuleModule } = require('../../base-evaluator');

// Custom action processor to set today's date for urgent tasks
const processAction = (context) => {
    const result = { ...config.action };

    // Set due date to today for urgent tasks
    if (
        result.suggested_due_date &&
        result.suggested_due_date.type === 'relative' &&
        result.suggested_due_date.value === 'today'
    ) {
        const today = new Date().toISOString().split('T')[0];
        result.suggested_due_date = today;
    }

    return result;
};

module.exports = createRuleModule(config, conditions, processAction);
