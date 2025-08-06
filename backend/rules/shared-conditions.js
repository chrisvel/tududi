const InboxProcessingService = require('../services/inboxProcessingService');

function hasProject(value, context) {
    const hasProjects = context.parsed_projects.length > 0;
    return value ? hasProjects : !hasProjects;
}

function containsKeywords(keywords, context) {
    if (!Array.isArray(keywords)) return false;

    const contentLower = context.content.toLowerCase();
    return keywords.some((keyword) =>
        contentLower.includes(keyword.toLowerCase())
    );
}

function startsWithVerb(value, context) {
    const result = InboxProcessingService.startsWithVerb(
        context.cleaned_content
    );
    return value ? result : !result;
}

function isLongText(value, context) {
    const result = InboxProcessingService.isLongText(context.content);
    return value ? result : !result;
}

function textLength(value, context, operator = 'eq') {
    const wordCount = context.cleaned_content
        .split(/\s+/)
        .filter((word) => word.length > 0).length;

    switch (operator) {
        case 'gt':
            return wordCount > value;
        case 'lt':
            return wordCount < value;
        case 'eq':
            return wordCount === value;
        case 'gte':
            return wordCount >= value;
        case 'lte':
            return wordCount <= value;
        default:
            return wordCount === value;
    }
}

module.exports = {
    has_project: hasProject,
    contains_keywords: containsKeywords,
    starts_with_verb: startsWithVerb,
    is_long_text: isLongText,
    text_length: textLength,
};
