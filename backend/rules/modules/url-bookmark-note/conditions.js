const InboxProcessingService = require('../../../services/inboxProcessingService');
const sharedConditions = require('../../shared-conditions');

function containsUrl(value, context) {
    const result = InboxProcessingService.containsUrl(context.content);
    return value ? result : !result;
}

module.exports = {
    has_project: sharedConditions.has_project,
    contains_url: containsUrl,
};
