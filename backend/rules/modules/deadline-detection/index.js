const config = require('./config.json');
const conditions = require('./conditions');
const { createRuleModule } = require('../../base-evaluator');

// Custom action processor to extract due date
const processAction = (context) => {
    const result = { ...config.action };

    // Extract due date if action specifies it
    if (
        result.suggested_due_date &&
        result.suggested_due_date.type === 'extracted'
    ) {
        const extractedDate = conditions.extractDueDate(context);
        if (extractedDate) {
            result.suggested_due_date = extractedDate;
        } else {
            delete result.suggested_due_date;
        }
    }

    return result;
};

module.exports = createRuleModule(config, conditions, processAction);
