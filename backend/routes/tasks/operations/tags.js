const { Tag } = require('../../../models');
const { validateTagName } = require('../../../services/tagsService');

async function updateTaskTags(task, tagsData, userId) {
    if (!tagsData) return;

    const validTagNames = [];
    const invalidTags = [];

    for (const tag of tagsData) {
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
        await task.setTags([]);
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
    await task.setTags(allTags);
}

module.exports = {
    updateTaskTags,
};
