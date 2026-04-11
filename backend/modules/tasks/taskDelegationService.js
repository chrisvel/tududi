const https = require('https');
const { getConfig } = require('../../config/config');
const { logError } = require('../../services/logService');

const MAX_CONTEXT_ITEMS = 8;
const DEFAULT_SUBTASK_COUNT = 6;

const PRIORITY_LABELS = {
    2: 'high',
    1: 'medium',
    0: 'low',
    high: 'high',
    medium: 'medium',
    low: 'low',
};

function normalizePriority(priority) {
    if (priority === null || priority === undefined) return null;
    return PRIORITY_LABELS[priority] || String(priority);
}

function collectNames(list, fallbackKey) {
    if (!Array.isArray(list)) return [];
    return list
        .map((item) => item?.name || item?.[fallbackKey])
        .filter(Boolean);
}

function getExistingSubtasks(task) {
    return task?.Subtasks || task?.subtasks || [];
}

function deriveContextBullets(task) {
    const context = [];
    const projectName = task?.Project?.name || task?.project?.name;
    const priority = normalizePriority(task?.priority);
    const tags = collectNames(task?.Tags || task?.tags, 'name');
    const dueDate = task?.due_date || task?.due_date_at;
    const deferUntil = task?.defer_until;
    const note = typeof task?.note === 'string' ? task.note.trim() : '';

    if (projectName) {
        context.push(`Project: ${projectName}`);
    }
    if (priority) {
        context.push(`Priority: ${priority}`);
    }
    if (dueDate) {
        context.push(`Due date: ${dueDate}`);
    }
    if (deferUntil) {
        context.push(`Deferred until: ${deferUntil}`);
    }
    if (tags.length > 0) {
        context.push(`Tags: ${tags.join(', ')}`);
    }
    if (note) {
        context.push(`Task notes: ${note}`);
    }

    return context.slice(0, MAX_CONTEXT_ITEMS);
}

function buildTaskSnapshot(task) {
    return {
        name: task?.name || '',
        note: task?.note || '',
        priority: normalizePriority(task?.priority),
        due_date: task?.due_date || task?.due_date_at || null,
        defer_until: task?.defer_until || null,
        project: task?.Project?.name || task?.project?.name || null,
        tags: collectNames(task?.Tags || task?.tags, 'name'),
        existing_subtasks: getExistingSubtasks(task)
            .map((subtask) => subtask?.name)
            .filter(Boolean),
    };
}

function buildPrompt(task) {
    const snapshot = buildTaskSnapshot(task);
    const contextBullets = deriveContextBullets(task);

    return {
        system: [
            'You are an expert productivity assistant.',
            'Your job is to break a task into a short delegation plan with context-aware subtasks.',
            'Return strict JSON only.',
            'Use concise, actionable language and avoid filler.',
            'If context is provided, include it in the delegation_brief and context array.',
            `Return at most ${DEFAULT_SUBTASK_COUNT} subtasks.`,
        ].join(' '),
        user: JSON.stringify(
            {
                instruction:
                    'Create a delegation plan for this task. Respond with JSON containing summary, delegation_brief, context (string array), and subtasks (array of { name, context }).',
                task: snapshot,
                derived_context: contextBullets,
            },
            null,
            2
        ),
    };
}

function sanitizeText(value, fallback = '') {
    if (typeof value !== 'string') return fallback;
    return value.trim();
}

function sanitizePlan(plan, task) {
    const fallbackContext = deriveContextBullets(task);
    const rawSubtasks = Array.isArray(plan?.subtasks) ? plan.subtasks : [];
    const seen = new Set();

    const subtasks = rawSubtasks
        .map((item) => {
            if (typeof item === 'string') {
                return { name: item.trim(), context: '' };
            }
            return {
                name: sanitizeText(item?.name || item?.title),
                context: sanitizeText(item?.context || item?.why || item?.reason),
            };
        })
        .filter((item) => item.name)
        .filter((item) => {
            const key = item.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, DEFAULT_SUBTASK_COUNT);

    const context = Array.isArray(plan?.context)
        ? plan.context
              .map((item) => sanitizeText(item))
              .filter(Boolean)
              .slice(0, MAX_CONTEXT_ITEMS)
        : [];

    const mergedContext = Array.from(new Set([...context, ...fallbackContext])).slice(
        0,
        MAX_CONTEXT_ITEMS
    );

    return {
        summary:
            sanitizeText(plan?.summary) ||
            `Delegation plan for ${task?.name || 'this task'}`,
        delegation_brief:
            sanitizeText(plan?.delegation_brief || plan?.brief) ||
            `Complete "${task?.name || 'this task'}" with clear handoff context, a sensible order of operations, and a lightweight review step.`,
        context: mergedContext,
        subtasks,
    };
}

function createMockPlan(task) {
    const snapshot = buildTaskSnapshot(task);
    const derivedContext = deriveContextBullets(task);
    const projectPrefix = snapshot.project ? ` for ${snapshot.project}` : '';
    const dueSuffix = snapshot.due_date ? ` before ${snapshot.due_date}` : '';

    return sanitizePlan(
        {
            summary: `AI-ready delegation plan for ${snapshot.name}`,
            delegation_brief: `Break "${snapshot.name}" into practical steps${projectPrefix}${dueSuffix}. Keep context visible and make each subtask something another person could execute without guessing.`,
            context: derivedContext,
            subtasks: [
                {
                    name: `Clarify the outcome and success criteria for ${snapshot.name}`,
                    context: snapshot.note || 'Use the available task details to define done.',
                },
                {
                    name: `Gather the materials, links, and inputs needed for ${snapshot.name}`,
                    context: snapshot.tags.length
                        ? `Relevant tags: ${snapshot.tags.join(', ')}`
                        : 'Collect everything needed before execution starts.',
                },
                {
                    name: `Complete the core work for ${snapshot.name}`,
                    context: snapshot.project
                        ? `Keep the work aligned to project ${snapshot.project}.`
                        : 'Focus on the highest-value deliverable first.',
                },
                {
                    name: `Review the result and note follow-up actions for ${snapshot.name}`,
                    context: dueSuffix
                        ? `Confirm it is ready${dueSuffix}.`
                        : 'Capture any remaining loose ends before closing the task.',
                },
            ],
        },
        task
    );
}

function extractMessageContent(message) {
    if (!message) return '';
    if (typeof message.content === 'string') {
        return message.content;
    }
    if (Array.isArray(message.content)) {
        return message.content
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part?.type === 'text') return part.text || '';
                return '';
            })
            .join('')
            .trim();
    }
    return '';
}

function parsePlanResponse(rawContent, task) {
    let parsed;

    try {
        parsed = JSON.parse(rawContent);
    } catch (error) {
        const firstBrace = rawContent.indexOf('{');
        const lastBrace = rawContent.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            parsed = JSON.parse(rawContent.slice(firstBrace, lastBrace + 1));
        } else {
            throw error;
        }
    }

    const sanitized = sanitizePlan(parsed, task);
    if (sanitized.subtasks.length === 0) {
        throw new Error('The LLM did not return any usable subtasks.');
    }
    return sanitized;
}

function postJson(url, headers, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const request = https.request(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    ...headers,
                },
                timeout: timeoutMs,
            },
            (response) => {
                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });
                response.on('end', () => {
                    try {
                        const parsed = JSON.parse(data || '{}');
                        if (response.statusCode >= 400) {
                            const error = new Error(
                                parsed?.error?.message ||
                                    parsed?.error ||
                                    `LLM request failed with status ${response.statusCode}`
                            );
                            error.statusCode = response.statusCode;
                            reject(error);
                            return;
                        }
                        resolve(parsed);
                    } catch (error) {
                        reject(error);
                    }
                });
            }
        );

        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy(new Error('LLM request timed out.'));
        });
        request.write(body);
        request.end();
    });
}

async function requestDelegationPlan(task) {
    const config = getConfig();
    const llmConfig = config.llm || {};

    if (process.env.NODE_ENV === 'test' && !llmConfig.enabled) {
        return {
            ...createMockPlan(task),
            model: 'mock-test-model',
            source: 'mock',
        };
    }

    if (!llmConfig.enabled || !llmConfig.apiKey) {
        const error = new Error(
            'LLM task delegation is not configured. Set TUDUDI_LLM_API_KEY (or OPENAI_API_KEY) to enable it.'
        );
        error.statusCode = 503;
        throw error;
    }

    const { system, user } = buildPrompt(task);
    const payload = {
        model: llmConfig.model,
        temperature: llmConfig.temperature,
        response_format: { type: 'json_object' },
        max_tokens: 900,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
    };

    const baseUrl = String(llmConfig.baseUrl || 'https://api.openai.com/v1').replace(
        /\/$/,
        ''
    );
    const response = await postJson(
        `${baseUrl}/chat/completions`,
        {
            Authorization: `Bearer ${llmConfig.apiKey}`,
        },
        payload,
        llmConfig.timeoutMs || 20000
    );

    const rawContent = extractMessageContent(response?.choices?.[0]?.message);
    const plan = parsePlanResponse(rawContent, task);
    return {
        ...plan,
        model: llmConfig.model,
        source: 'llm',
    };
}

async function generateTaskDelegationPlan(task) {
    try {
        return await requestDelegationPlan(task);
    } catch (error) {
        logError('Error generating task delegation plan:', error);
        throw error;
    }
}

async function generateDelegationPlanFromText(text, extraContext = {}) {
    const pseudoTask = {
        name: text,
        note: extraContext.note || '',
        priority: extraContext.priority || null,
        due_date: extraContext.due_date || null,
        defer_until: extraContext.defer_until || null,
        Project: extraContext.project ? { name: extraContext.project } : null,
        tags: Array.isArray(extraContext.tags)
            ? extraContext.tags.map((name) => ({ name }))
            : [],
        subtasks: [],
    };

    return await generateTaskDelegationPlan(pseudoTask);
}

module.exports = {
    generateTaskDelegationPlan,
    generateDelegationPlanFromText,
    _buildTaskSnapshot: buildTaskSnapshot,
    _deriveContextBullets: deriveContextBullets,
    _sanitizePlan: sanitizePlan,
};
