const InboxProcessingService = require('../../../services/inboxProcessingService');

function containsCode(value, context) {
    const result = InboxProcessingService.containsCode(context.content);
    return value ? result : !result;
}

module.exports = {
    contains_code: containsCode,
};
