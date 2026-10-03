'use strict';

const crypto = require('crypto');
const moment = require('moment-timezone');
const ai = require('../ai-assistant/service');
const { User } = require('../../models');
const { languageInstruction } = require('../daily-plan/ai');
const repository = require('./repository');
const attachments = require('./operations/attachments');
const { getSafeTimezone } = require('../../utils/timezone-utils');
const {
    AppError,
    ForbiddenError,
    ValidationError,
} = require('../../shared/errors');

const MAX_ITEMS = 25;
const MAX_PROJECTS = 100;
const MAX_TAGS = 200;
const MAX_CONTENT = 1000;
const MAX_FILES = 5;
const MAX_OPTIONS = 3;
const MAX_SUGGESTED_TAGS = 5;
// Reasoning models think for roughly 800 tokens per item before the JSON
// starts (13 items measured at ~10k), and a cut-off answer is empty, so the
// budget grows with the batch instead of being one fixed number. Options
// add a little on top.
const BASE_TOKENS = 4000;
const TOKENS_PER_ITEM = 1300;
const MAX_TOKENS = 32000;
const KINDS = ['task', 'note', 'project', 'keep'];
const CONFIDENCE = ['sure', 'guess'];
const WHY_FIELDS = ['title', 'project', 'tags', 'due_date'];

const text = (value, max) =>
    typeof value === 'string' ? value.trim().slice(0, max) : '';

function cleanTags(tags) {
    const seen = new Set();
    const result = [];
    for (const raw of Array.isArray(tags) ? tags : []) {
        const name = text(raw, 50).replace(/^#+/, '').trim();
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        result.push(name);
        if (result.length >= MAX_SUGGESTED_TAGS) break;
    }
    return result;
}

function cleanDueDate(value, captureDay) {
    if (typeof value !== 'string') return null;
    const date = moment(value, 'YYYY-MM-DD', true);
    if (!date.isValid()) return null;
    const day = date.format('YYYY-MM-DD');
    return captureDay && day < captureDay ? null : day;
}

function sanitizeOption(entry, { captureDay, projectByName }) {
    if (!entry || !KINDS.includes(entry.kind)) return null;
    const keep = entry.kind === 'keep';
    const project =
        !keep && typeof entry.project_name === 'string'
            ? projectByName.get(entry.project_name.trim().toLowerCase())
            : null;
    const tags = keep ? [] : cleanTags(entry.tags);
    const dueDate =
        entry.kind === 'task' ? cleanDueDate(entry.due_date, captureDay) : null;
    const title = keep ? '' : text(entry.title, 200);
    // Something to create needs a name; without one the option is useless.
    if (!keep && !title) return null;

    const rawWhy = entry.why && typeof entry.why === 'object' ? entry.why : {};
    const kept = {
        title: !!title,
        project: !!project,
        tags: tags.length > 0,
        due_date: !!dueDate,
    };
    const why = {};
    for (const field of WHY_FIELDS) {
        why[field] = kept[field] ? text(rawWhy[field], 120) : '';
    }

    return {
        kind: entry.kind,
        confidence: CONFIDENCE.includes(entry.confidence)
            ? entry.confidence
            : 'guess',
        title,
        project_uid: project?.uid || null,
        project_name: project?.name || null,
        tags,
        due_date: dueDate,
        reason: text(entry.reason, 120),
        analysis: text(entry.analysis, 300),
        why,
    };
}

// Turns whatever the model proposed into suggestions the inbox can show:
// only the items asked about, known kinds, projects that really exist, an
// explanation only for the fields that survived, and up to three distinct
// options per item, best first.
function sanitizeSuggestions({ proposed, items, projects, timezone }) {
    const byUid = new Map(items.map((item) => [item.uid, item]));
    const projectByName = new Map(
        projects.map((project) => [project.name.toLowerCase(), project])
    );
    const seen = new Set();
    const result = [];

    for (const entry of Array.isArray(proposed) ? proposed : []) {
        const item = byUid.get(entry?.item_uid);
        if (!item || seen.has(item.uid)) continue;
        seen.add(item.uid);

        const captureDay = moment
            .tz(item.created_at, timezone)
            .format('YYYY-MM-DD');
        const options = [];
        const optionKeys = new Set();
        for (const raw of Array.isArray(entry.options) ? entry.options : []) {
            const option = sanitizeOption(raw, { captureDay, projectByName });
            if (!option) continue;
            const key = `${option.kind}:${option.title.toLowerCase()}`;
            if (optionKeys.has(key)) continue;
            optionKeys.add(key);
            options.push(option);
            if (options.length >= MAX_OPTIONS) break;
        }
        if (options.length > 0) {
            result.push({ item_uid: item.uid, options });
        }
    }

    return result;
}

const WHY_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        project: { type: 'string' },
        tags: { type: 'string' },
        due_date: { type: 'string' },
    },
    required: WHY_FIELDS,
    additionalProperties: false,
};

const OPTION_SCHEMA = {
    type: 'object',
    properties: {
        kind: { type: 'string', enum: KINDS },
        confidence: { type: 'string', enum: CONFIDENCE },
        title: { type: 'string' },
        project_name: { type: ['string', 'null'] },
        tags: { type: 'array', items: { type: 'string' } },
        due_date: { type: ['string', 'null'] },
        reason: { type: 'string' },
        analysis: { type: 'string' },
        why: WHY_SCHEMA,
    },
    required: [
        'kind',
        'confidence',
        'title',
        'project_name',
        'tags',
        'due_date',
        'reason',
        'analysis',
        'why',
    ],
    additionalProperties: false,
};

const SUGGESTIONS_SCHEMA = {
    type: 'object',
    properties: {
        suggestions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    item_uid: { type: 'string' },
                    options: { type: 'array', items: OPTION_SCHEMA },
                },
                required: ['item_uid', 'options'],
                additionalProperties: false,
            },
        },
    },
    required: ['suggestions'],
    additionalProperties: false,
};

const SYSTEM_PROMPT = `You help one person sort their Tududi inbox. For each captured item, suggest what it should become and explain why.

Kinds:
- task: one concrete action the person can do.
- note: reference material to keep (a link, an idea, information, a file, a quote).
- project: several steps toward one outcome.
- keep: leave it in the inbox. Use only when nothing sensible can be guessed.

Options:
- Give 1 to 3 options per item, best first. Add a second or third only when it is a real alternative (e.g. a link that could be a note to keep or a task to read it).
- confidence: "sure" when the item says clearly what it is; "guess" when it is unclear (e.g. only a file name, one vague word, no title). For an unclear item still make your best guess instead of choosing keep, and mark it "guess".

Fields of each option:
- title: a short, clear name (a task starts with a verb). Keep the person's own words where they work. When the item has no usable text (e.g. only a file), make one from the file name and type. Empty for keep.
- project_name: exactly one name from the project list when the item clearly belongs there, otherwise null. Never invent a project.
- tags: 0 to 3 tags, preferring existing tags; no # sign.
- due_date: YYYY-MM-DD only for a task whose item names a date or deadline, counted from the capture date; otherwise null.
- reason: at most 12 words, the headline of the choice.
- analysis: at most 40 words on what the item is about and why this option fits.
- why: one line of at most 12 words per field explaining where its value came from (e.g. project: "Mentions the kitchen, matches Home renovation"); an empty string for a field left empty.

Ground every explanation in the item's own words and files; do not invent facts. Plain text, no markdown. Return only the JSON object with one entry per item_uid given.`;

// Unlike the brief and planning, inbox help does not wait for the AI
// assistant switch in Profile -> Features: it is there whenever a provider
// is set up. Hosted instances always have the operator's; self-hosted ones
// need a key in Profile -> AI Assistant (or the server's .env).
async function assertAiAvailable(userId) {
    if (!(await ai.isAIConfigured(userId))) {
        throw new ForbiddenError(
            'Add your AI provider in Profile -> AI Assistant to use AI assist.'
        );
    }
    return User.findByPk(userId, {
        attributes: ['id', 'ai_profile', 'timezone', 'language'],
    });
}

// Suggestions are saved on the item (ai_suggestion), so they show again
// when the inbox is reopened and pressing AI assist again does not spend
// another credit. The key fingerprints the text and file names they were
// made from; a changed item is asked about again. regenerate asks again
// regardless.
const suggestionKey = (item, files) =>
    crypto
        .createHash('sha256')
        .update(String(item.content || ''))
        .update(files.map((f) => f.original_filename).join('\n'))
        .digest('hex');

async function suggestForItems(userId, itemUids, { regenerate = false } = {}) {
    const user = await assertAiAvailable(userId);
    if (
        !Array.isArray(itemUids) ||
        itemUids.some((uid) => typeof uid !== 'string')
    ) {
        throw new ValidationError(
            'item_uids must be a list of inbox item uids'
        );
    }
    const uids = [...new Set(itemUids)].slice(0, MAX_ITEMS);
    if (uids.length === 0) return { suggestions: [] };

    const items = await repository.findActiveByUids(userId, uids);
    const filesByItem = await attachments.listForItems(items);
    const filesOf = (item) => filesByItem.get(item.id) || [];

    const results = new Map();
    const missing = [];
    for (const item of items) {
        const saved =
            !regenerate &&
            item.ai_suggestion &&
            item.ai_suggestion_key === suggestionKey(item, filesOf(item));
        if (saved) {
            results.set(item.uid, item.ai_suggestion);
        } else {
            missing.push(item);
        }
    }

    if (missing.length > 0) {
        const timezone = getSafeTimezone(user.timezone);
        const [projects, tagNames] = await Promise.all([
            repository.findOpenProjectsForUser(userId, MAX_PROJECTS),
            repository.findTagNamesForUser(userId, MAX_TAGS),
        ]);

        await ai.chargeAiCall(userId);
        const parsed = await ai.askJson(userId, {
            name: 'inbox_suggestions',
            maxTokens: ai.getMaxTokens(
                'LLM_MAX_TOKENS_INBOX',
                Math.min(
                    BASE_TOKENS + TOKENS_PER_ITEM * missing.length,
                    MAX_TOKENS
                )
            ),
            schema: SUGGESTIONS_SCHEMA,
            system: `${SYSTEM_PROMPT}${languageInstruction(user.language)}`,
            user: [
                `Today: ${moment.tz(timezone).format('YYYY-MM-DD')}.`,
                user.ai_profile ? `About the user: ${user.ai_profile}` : '',
                `Projects: ${projects.map((p) => p.name).join(' | ') || 'none'}`,
                `Existing tags: ${tagNames.join(', ') || 'none'}`,
                '',
                'Inbox items (JSON, one per line):',
                ...missing.map((item) =>
                    JSON.stringify({
                        item_uid: item.uid,
                        captured: moment
                            .tz(item.created_at, timezone)
                            .format('YYYY-MM-DD'),
                        content: String(item.content || item.title || '').slice(
                            0,
                            MAX_CONTENT
                        ),
                        files: filesOf(item)
                            .slice(0, MAX_FILES)
                            .map((f) => ({
                                name: f.original_filename,
                                type: f.mime_type,
                            })),
                    })
                ),
            ].join('\n'),
        });

        // No list at all means the answer never arrived (usually cut off by
        // the token budget), not that the model had nothing to say.
        if (!Array.isArray(parsed.suggestions)) {
            throw new AppError(
                'The AI ran out of room before answering. Try again with fewer items, or raise LLM_MAX_TOKENS_INBOX.',
                502,
                'AI_NO_ANSWER'
            );
        }

        const fresh = sanitizeSuggestions({
            proposed: parsed.suggestions,
            items: missing,
            projects,
            timezone,
        });
        const freshByUid = new Map(fresh.map((s) => [s.item_uid, s]));
        const generatedAt = new Date().toISOString();
        // An item the model skipped loses its old suggestion too: it was
        // asked about again, so the old answer is no longer current.
        for (const item of missing) {
            const suggestion = freshByUid.get(item.uid);
            const stored = suggestion
                ? { ...suggestion, generated_at: generatedAt }
                : null;
            await repository.updateItem(item, {
                ai_suggestion: stored,
                ai_suggestion_key: stored
                    ? suggestionKey(item, filesOf(item))
                    : null,
            });
            if (stored) results.set(item.uid, stored);
        }
    }

    // Same order as the inbox shows the items.
    return {
        suggestions: items.map((item) => results.get(item.uid)).filter(Boolean),
    };
}

module.exports = {
    sanitizeSuggestions,
    suggestForItems,
};
