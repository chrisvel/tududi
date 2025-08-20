const sharedConditions = require('../../shared-conditions');

function extractDueDate(context) {
    const content = context.content.toLowerCase();
    const now = new Date();

    if (content.includes('today')) {
        return now.toISOString().split('T')[0];
    }

    if (content.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    // Look for "by friday", "next monday", etc.
    const dayMatches = content.match(
        /(by|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/
    );
    if (dayMatches) {
        const dayName = dayMatches[2];
        const targetDay = getNextWeekday(dayName);
        return targetDay.toISOString().split('T')[0];
    }

    return null;
}

function getNextWeekday(dayName) {
    const days = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
    ];
    const targetDay = days.indexOf(dayName.toLowerCase());

    const now = new Date();
    const currentDay = now.getDay();

    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) {
        daysToAdd += 7; // Next week
    }

    const result = new Date(now);
    result.setDate(result.getDate() + daysToAdd);
    return result;
}

module.exports = {
    contains_keywords: sharedConditions.contains_keywords,
    starts_with_verb: sharedConditions.starts_with_verb,
    extractDueDate,
};
