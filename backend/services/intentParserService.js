const use = require('@tensorflow-models/universal-sentence-encoder');
const { logError } = require('./logService');

// Intent training examples
const intentExamples = {
    list_tasks: [
        'show me my tasks',
        'list all tasks',
        'what tasks do I have',
        'my tasks',
        'tasks due today',
        'overdue tasks',
        'upcoming tasks',
        'tasks this week',
        'high priority tasks',
        'latest tasks',
        'recent tasks',
        'show me 5 latest tasks',
        'show me recent tasks',
    ],
    list_projects: [
        'show my projects',
        'list projects',
        'what projects am I working on',
        'my active projects',
        'all projects',
    ],
    list_notes: [
        'show my notes',
        'list notes',
        'what are my notes',
        'my notes',
        'all notes',
        'what are my notes about',
    ],
    search: [
        'find task about meeting',
        'search for project',
        'where is my task',
        'look for note',
    ],
    productivity: [
        'how productive am I',
        'my productivity',
        'show my performance',
        'am I being productive',
        'how am I doing',
        'my completion rate',
        'show my progress',
        'make me more productive',
    ],
    summary: [
        'summarize my work',
        'give me an overview',
        'what have I done',
        'my daily summary',
        'weekly summary',
        'what is my status',
    ],
    stats: [
        'show statistics',
        'my stats',
        'how many tasks completed',
        'task metrics',
        'show numbers',
    ],
    create_task: [
        'create a task',
        'add task',
        'new task',
        'make a task',
        'I need to do',
    ],
    create_project: [
        'create project',
        'new project',
        'start a project',
        'add project',
    ],
    advise: [
        'how can I improve',
        'give me advice',
        'suggest improvements',
        'help me be better',
        'recommend what to do',
        'what should I focus on',
    ],
    conversational: [
        'hello',
        'hi there',
        'thanks',
        'thank you',
        'how are you',
    ],
};

// Entity extraction patterns
const entityPatterns = {
    priority: {
        high: ['urgent', 'important', 'critical', 'high priority', 'asap'],
        medium: ['medium', 'normal', 'moderate'],
        low: ['low', 'minor', 'someday', 'maybe'],
    },
    timePeriod: {
        today: ['today', 'now'],
        tomorrow: ['tomorrow'],
        this_week: ['this week', 'week'],
        next_week: ['next week'],
        this_month: ['this month', 'month'],
        overdue: ['overdue', 'late', 'past due'],
    },
    itemType: {
        task: ['task', 'tasks', 'todo', 'todos'],
        project: ['project', 'projects'],
        note: ['note', 'notes'],
    },
};

// Productivity metrics mapping
const productivityMetrics = [
    'completion_rate',
    'overdue_rate',
    'task_age',
    'created_done_ratio',
];

// Local intents that can be handled without OpenAI
const localIntents = [
    'list_tasks',
    'list_projects',
    'list_notes',
    'search',
    'productivity',
    'summary',
    'stats',
];

// State management using closures
let model = null;
let isReady = false;
let initPromise = null;
let intentEmbeddings = {};

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
};

/**
 * Initialize the Universal Sentence Encoder model
 */
const initialize = async () => {
    if (isReady) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            console.log('Loading Universal Sentence Encoder model...');
            model = await use.load();

            // Pre-compute embeddings for intent examples
            intentEmbeddings = {};
            for (const [intent, examples] of Object.entries(intentExamples)) {
                const embeddings = await model.embed(examples);
                intentEmbeddings[intent] = await embeddings.array();
                embeddings.dispose();
            }

            isReady = true;
            console.log('Universal Sentence Encoder loaded successfully');
        } catch (error) {
            logError('Failed to load USE model:', error);
            isReady = false;
        }
    })();

    return initPromise;
};

/**
 * Extract entities using pattern matching
 */
const extractEntities = (text) => {
    const entities = {
        priority: null,
        timePeriod: null,
        itemType: null,
        searchTerm: null,
        metrics: [],
        period: '30d',
    };

    // Detect priority
    for (const [priority, keywords] of Object.entries(entityPatterns.priority)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                entities.priority = priority;
                break;
            }
        }
        if (entities.priority) break;
    }

    // Detect time period
    for (const [period, keywords] of Object.entries(entityPatterns.timePeriod)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                entities.timePeriod = period;
                break;
            }
        }
        if (entities.timePeriod) break;
    }

    // Detect item type
    for (const [type, keywords] of Object.entries(entityPatterns.itemType)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                entities.itemType = type;
                break;
            }
        }
        if (entities.itemType) break;
    }

    // Detect productivity metrics request
    if (
        text.includes('productive') ||
        text.includes('productivity') ||
        text.includes('make me')
    ) {
        entities.metrics = productivityMetrics;
    } else {
        if (text.includes('completion') || text.includes('complete')) {
            entities.metrics.push('completion_rate');
        }
        if (text.includes('overdue') || text.includes('late')) {
            entities.metrics.push('overdue_rate');
        }
        if (text.includes('age') || text.includes('old')) {
            entities.metrics.push('task_age');
        }
        if (text.includes('created')) {
            entities.metrics.push('created_done_ratio');
        }
    }

    // Extract time period in days
    const dayMatch = text.match(/(\d+)\s*day/);
    if (dayMatch) {
        entities.period = `${dayMatch[1]}d`;
    } else if (entities.timePeriod) {
        const periodMap = {
            today: '1d',
            tomorrow: '1d',
            this_week: '7d',
            next_week: '7d',
            this_month: '30d',
        };
        entities.period = periodMap[entities.timePeriod] || '30d';
    }

    return entities;
};

/**
 * Build structured query object
 */
const buildStructuredQuery = (intent, entities) => {
    const query = {
        intent,
        target: entities.itemType || 'task',
        filters: {},
    };

    if (entities.priority) {
        query.filters.priority = entities.priority;
    }

    if (entities.timePeriod) {
        query.filters.timePeriod = entities.timePeriod;
    }

    if (entities.metrics.length > 0) {
        query.metrics = entities.metrics;
        query.period = entities.period;
    }

    if (entities.searchTerm) {
        query.filters.search = entities.searchTerm;
    }

    return query;
};

/**
 * Determine if query needs OpenAI
 */
const needsOpenAI = (intent, confidence, text) => {
    // Low confidence queries should use OpenAI
    if (confidence < 0.6) {
        return true;
    }

    // Specific intents that can be handled locally
    if (localIntents.includes(intent)) {
        return false;
    }

    // Advice and conversational always need OpenAI
    if (intent === 'advise' || intent === 'conversational') {
        return true;
    }

    // Complex queries (long text) should use OpenAI
    if (text.length > 100 || text.split(' ').length > 20) {
        return true;
    }

    return false;
};

/**
 * Fallback pattern matching if TensorFlow fails
 */
const fallbackParse = (message) => {
    const text = message.toLowerCase();
    let intent = 'conversational';

    // Simple keyword matching
    if (text.includes('task') && (text.includes('show') || text.includes('list'))) {
        intent = 'list_tasks';
    } else if (
        text.includes('project') &&
        (text.includes('show') || text.includes('list'))
    ) {
        intent = 'list_projects';
    } else if (text.includes('productive') || text.includes('productivity')) {
        intent = 'productivity';
    } else if (text.includes('summary') || text.includes('summarize')) {
        intent = 'summary';
    }

    const entities = extractEntities(text);
    const query = buildStructuredQuery(intent, entities);

    return {
        intent,
        confidence: 0.5,
        entities,
        needsAI: intent === 'conversational' || intent === 'advise',
        originalMessage: message,
        query,
    };
};

/**
 * Parse user message and extract intent using semantic similarity
 */
const parse = async (message) => {
    // Ensure model is loaded
    if (!isReady) {
        await initialize();
    }

    if (!model) {
        // Fallback to simple pattern matching if model fails
        return fallbackParse(message);
    }

    try {
        const text = message.toLowerCase();

        // Get embedding for user message
        const messageEmbedding = await model.embed([text]);
        const messageVector = (await messageEmbedding.array())[0];
        messageEmbedding.dispose();

        // Find best matching intent using cosine similarity
        let bestIntent = 'conversational';
        let bestScore = 0;

        for (const [intent, exampleEmbeddings] of Object.entries(intentEmbeddings)) {
            for (const exampleVector of exampleEmbeddings) {
                const similarity = cosineSimilarity(messageVector, exampleVector);
                if (similarity > bestScore) {
                    bestScore = similarity;
                    bestIntent = intent;
                }
            }
        }

        // Extract entities
        const entities = extractEntities(text);

        // Determine if needs OpenAI
        const needsAI_result = needsOpenAI(bestIntent, bestScore, text);

        // Build structured query
        const query = buildStructuredQuery(bestIntent, entities);

        return {
            intent: bestIntent,
            confidence: bestScore,
            entities,
            needsAI: needsAI_result,
            originalMessage: message,
            query,
        };
    } catch (error) {
        logError('Error in intent parsing:', error);
        return fallbackParse(message);
    }
};

/**
 * Check if model is ready
 */
const ready = () => isReady;

module.exports = {
    parse,
    initialize,
    ready,
};
