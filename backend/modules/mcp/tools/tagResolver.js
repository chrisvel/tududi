'use strict';

const { Op } = require('sequelize');
const { Tag } = require('../../../models');
const { validateTagName } = require('../../tags/tagsService');

// Some MCP clients serialize array arguments to a JSON string before sending,
// so a string holding a JSON array is decoded here. Any other string is left
// as-is and rejected below.
function decodeTagsInput(tagsInput) {
    if (typeof tagsInput !== 'string') {
        return tagsInput;
    }
    try {
        const parsed = JSON.parse(tagsInput);
        return Array.isArray(parsed) ? parsed : tagsInput;
    } catch {
        return tagsInput;
    }
}

// Validates and dedupes an MCP tool's `tags` input, creates any missing
// tags, and returns the Tag instances to associate, all within `transaction`.
// Returns `undefined` when `tagsInput` is `undefined` so the caller can leave
// existing tag associations untouched; returns `[]` for an explicit empty array.
async function resolveTagsForTransaction(tagsInput, userId, transaction) {
    if (tagsInput === undefined) {
        return undefined;
    }
    const tagNames = decodeTagsInput(tagsInput);
    if (!Array.isArray(tagNames)) {
        throw new Error(
            'tags must be an array of tag names, e.g. ["work", "urgent"]'
        );
    }

    const validTagNames = [];
    const invalidTags = [];
    for (const name of tagNames) {
        if (typeof name !== 'string') {
            invalidTags.push({ name, error: 'Tag name must be a string' });
            continue;
        }
        const validation = validateTagName(name);
        if (validation.valid) {
            if (!validTagNames.includes(validation.name)) {
                validTagNames.push(validation.name);
            }
        } else {
            invalidTags.push({ name, error: validation.error });
        }
    }
    if (invalidTags.length > 0) {
        throw new Error(
            `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(', ')}`
        );
    }
    if (validTagNames.length === 0) {
        return [];
    }

    await Tag.bulkCreate(
        validTagNames.map((name) => ({ name, user_id: userId })),
        { ignoreDuplicates: true, transaction }
    );

    return Tag.findAll({
        where: {
            name: { [Op.in]: validTagNames },
            user_id: userId,
        },
        transaction,
    });
}

module.exports = { resolveTagsForTransaction };
