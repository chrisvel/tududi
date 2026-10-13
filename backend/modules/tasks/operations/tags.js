const { Tag } = require('../../../models');
const { validateTagName } = require('../../tags/tagsService');

// Tags live in a join table, so changing them alone leaves the task row (and
// its updated_at) untouched. CalDAV ETags, the collection CTag and the outbound
// sync all key off updated_at, so touch it when the set of tags really changed
// (#1822).
async function setTagsAndTouch(task, tags) {
    const before = (await task.getTags({ attributes: ['id'] }))
        .map((tag) => tag.id)
        .sort((a, b) => a - b);
    const after = tags.map((tag) => tag.id).sort((a, b) => a - b);

    await task.setTags(tags);

    if (before.join(',') !== after.join(',')) {
        task.changed('updated_at', true);
        await task.save();
    }
}

async function updateTaskTags(task, tagsData, userId) {
    if (!tagsData) return;

    const normalizedTags = tagsData.map((tag) =>
        typeof tag === 'string' ? { name: tag } : tag
    );

    const validTagNames = [];
    const invalidTags = [];

    for (const tag of normalizedTags) {
        const validation = validateTagName(tag.name);
        if (validation.valid) {
            if (!validTagNames.includes(validation.name)) {
                validTagNames.push(validation.name);
            }
        } else {
            invalidTags.push({ name: tag.name, error: validation.error });
        }
    }

    if (invalidTags.length > 0) {
        throw new Error(
            `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(', ')}`
        );
    }

    if (validTagNames.length === 0) {
        await setTagsAndTouch(task, []);
        return;
    }

    const existingTags = await Tag.findAll({
        where: { user_id: userId, name: validTagNames },
    });

    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = validTagNames.filter(
        (name) => !existingTagNames.includes(name)
    );

    const createdTags = await Promise.all(
        newTagNames.map((name) => Tag.create({ name, user_id: userId }))
    );

    const allTags = [...existingTags, ...createdTags];
    await setTagsAndTouch(task, allTags);
}

module.exports = {
    updateTaskTags,
};
