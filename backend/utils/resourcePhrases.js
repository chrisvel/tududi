'use strict';

// "a project", "an area": share notifications name the kind of thing shared,
// so each type carries its own article. Notification titles are English for
// now, like every other notification the server writes.
const RESOURCE_PHRASES = {
    project: 'a project',
    area: 'an area',
    goal: 'a goal',
    note: 'a note',
    task: 'a task',
};

function resourcePhrase(resourceType) {
    if (RESOURCE_PHRASES[resourceType]) return RESOURCE_PHRASES[resourceType];
    const type = String(resourceType || 'item');
    return /^[aeiou]/i.test(type) ? `an ${type}` : `a ${type}`;
}

module.exports = { resourcePhrase, RESOURCE_PHRASES };
