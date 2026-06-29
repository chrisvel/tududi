'use strict';

const SYSTEM_TAGS = ['someday', 'today'];

async function seedSystemTagsForUser(userId) {
    const { Tag } = require('../../models');

    for (const name of SYSTEM_TAGS) {
        await Tag.findOrCreate({
            where: { user_id: userId, name },
            defaults: {
                name,
                user_id: userId,
                tag_type: 'system',
                pinned: true,
            },
        });
    }
}

module.exports = { SYSTEM_TAGS, seedSystemTagsForUser };
