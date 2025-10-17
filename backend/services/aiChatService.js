const OpenAI = require('openai');
const { Task, Project, Note, Tag } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('./logService');
const intentParser = require('./intentParserService');
const queryHandler = require('./queryHandlerService');

class AIChatService {
    constructor() {
        this.provider = process.env.AI_PROVIDER || 'openai';
        this.initializeClient();

        // OpenAI pricing per 1M tokens (as of 2024)
        this.pricing = {
            'gpt-4': { input: 30.0, output: 60.0 },
            'gpt-4-turbo': { input: 10.0, output: 30.0 },
            'gpt-4o': { input: 2.5, output: 10.0 },
            'gpt-4o-mini': { input: 0.15, output: 0.6 },
            'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
            'gpt-3.5-turbo-0125': { input: 0.5, output: 1.5 },
        };

        // Context caching
        this.contextCache = new Map(); // conversationId -> {context, timestamp}
        this.cacheExpiry =
            parseInt(process.env.AI_CACHE_EXPIRY_MS) || 5 * 60 * 1000; // 5 minutes default

        // Configurable limits
        this.limits = {
            maxTasks: parseInt(process.env.AI_MAX_TASKS) || 30,
            maxProjects: parseInt(process.env.AI_MAX_PROJECTS) || 10,
            maxNotes: parseInt(process.env.AI_MAX_NOTES) || 5,
        };
    }

    calculateCost(model, usage) {
        if (!usage || !usage.prompt_tokens || !usage.completion_tokens) {
            return null;
        }

        // Find pricing for the model (try exact match first, then prefix match)
        let modelPricing = this.pricing[model];
        if (!modelPricing) {
            // Try to match by prefix (e.g., gpt-4-0125-preview -> gpt-4)
            const modelPrefix = Object.keys(this.pricing).find((key) =>
                model.startsWith(key)
            );
            modelPricing = modelPrefix ? this.pricing[modelPrefix] : null;
        }

        if (!modelPricing) {
            return null; // Unknown model
        }

        // Calculate cost (pricing is per 1M tokens)
        const inputCost = (usage.prompt_tokens / 1000000) * modelPricing.input;
        const outputCost =
            (usage.completion_tokens / 1000000) * modelPricing.output;
        const totalCost = inputCost + outputCost;

        return {
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            input_cost: inputCost,
            output_cost: outputCost,
            total_cost: totalCost,
        };
    }

    initializeClient() {
        if (this.provider === 'openai') {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                console.warn('OPENAI_API_KEY not set. AI chat will not work.');
                this.client = null;
                return;
            }
            this.client = new OpenAI({ apiKey });
            this.model = process.env.AI_MODEL || 'gpt-3.5-turbo';
        } else if (this.provider === 'ollama') {
            // Ollama support can be added later
            const Ollama = require('ollama').Ollama;
            this.client = new Ollama({
                host: process.env.OLLAMA_HOST || 'http://localhost:11434',
            });
            this.model = process.env.OLLAMA_MODEL || 'llama3';
        }
    }

    async buildUserContext(userId) {
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            // Smart task selection - prioritize:
            // 1. Overdue tasks (highest priority)
            // 2. Due today/tomorrow
            // 3. Due this week
            // 4. High priority tasks
            // 5. Recently updated tasks

            const overdueTasks = await Task.findAll({
                where: {
                    user_id: userId,
                    status: { [Op.ne]: 'completed' },
                    due_date: { [Op.lt]: now },
                },
                limit: Math.floor(this.limits.maxTasks * 0.4), // 40% for overdue
                order: [
                    ['due_date', 'ASC'],
                    ['priority', 'DESC'],
                ],
                attributes: [
                    'uid',
                    'name',
                    'status',
                    'priority',
                    'due_date',
                    'description',
                ],
                include: [{ model: Project, attributes: ['name'] }],
            });

            const upcomingTasks = await Task.findAll({
                where: {
                    user_id: userId,
                    status: { [Op.ne]: 'completed' },
                    due_date: { [Op.between]: [now, nextWeek] },
                },
                limit: Math.floor(this.limits.maxTasks * 0.4), // 40% for upcoming
                order: [
                    ['due_date', 'ASC'],
                    ['priority', 'DESC'],
                ],
                attributes: [
                    'uid',
                    'name',
                    'status',
                    'priority',
                    'due_date',
                    'description',
                ],
                include: [{ model: Project, attributes: ['name'] }],
            });

            const highPriorityTasks = await Task.findAll({
                where: {
                    user_id: userId,
                    status: { [Op.ne]: 'completed' },
                    priority: 'high',
                    [Op.or]: [
                        { due_date: null },
                        { due_date: { [Op.gt]: nextWeek } },
                    ],
                },
                limit: Math.floor(this.limits.maxTasks * 0.2), // 20% for high priority
                order: [['updated_at', 'DESC']],
                attributes: [
                    'uid',
                    'name',
                    'status',
                    'priority',
                    'due_date',
                    'description',
                ],
                include: [{ model: Project, attributes: ['name'] }],
            });

            // Combine and deduplicate tasks
            const taskIds = new Set();
            const tasks = [
                ...overdueTasks,
                ...upcomingTasks,
                ...highPriorityTasks,
            ]
                .filter((task) => {
                    if (taskIds.has(task.uid)) return false;
                    taskIds.add(task.uid);
                    return true;
                })
                .slice(0, this.limits.maxTasks);

            // Get active projects (prioritize recently updated)
            const projects = await Project.findAll({
                where: {
                    user_id: userId,
                    state: { [Op.ne]: 'completed' },
                },
                limit: this.limits.maxProjects,
                order: [['updated_at', 'DESC']],
                attributes: ['uid', 'name', 'state', 'description'],
            });

            // Get recent notes
            const notes = await Note.findAll({
                where: { user_id: userId },
                limit: this.limits.maxNotes,
                order: [['updated_at', 'DESC']],
                attributes: ['uid', 'title', 'content'],
            });

            // Get stats
            const totalActiveTasks = await Task.count({
                where: {
                    user_id: userId,
                    status: { [Op.ne]: 'completed' },
                },
            });

            const overdueCount = await Task.count({
                where: {
                    user_id: userId,
                    status: { [Op.ne]: 'completed' },
                    due_date: { [Op.lt]: now },
                },
            });

            return {
                tasks: tasks.map((t) => ({
                    id: t.uid,
                    name: t.name,
                    status: t.status,
                    priority: t.priority,
                    due_date: t.due_date,
                    project: t.Project?.name,
                    description: t.description
                        ? t.description.substring(0, 100)
                        : null,
                })),
                projects: projects.map((p) => ({
                    id: p.uid,
                    name: p.name,
                    state: p.state,
                })),
                notes: notes.map((n) => ({
                    id: n.uid,
                    title: n.title,
                })),
                stats: {
                    total_active_tasks: totalActiveTasks,
                    overdue_tasks: overdueCount,
                    active_projects: projects.length,
                    showing_tasks: tasks.length,
                    showing_projects: projects.length,
                    showing_notes: notes.length,
                },
            };
        } catch (error) {
            logError('Error building user context:', error);
            return {
                tasks: [],
                projects: [],
                notes: [],
                stats: {},
            };
        }
    }

    buildSystemPrompt(context) {
        const { stats, tasks, projects, notes } = context;

        // Format tasks with the EXACT marker format the AI should use
        const recentTasks = tasks
            .slice(0, 5)
            .map(
                (t) =>
                    `[TASK:${t.id}] ${t.name} (${t.priority} priority, status: ${t.status}${t.due_date ? `, due: ${t.due_date}` : ''})`
            )
            .join('\n');

        const activeProjects = projects
            .map((p) => `[PROJECT:${p.id}] ${p.name} (${p.state})`)
            .join('\n');

        const recentNotes = notes
            .slice(0, 3)
            .map((n) => `[NOTE:${n.id}] ${n.title}`)
            .join('\n');

        return `You are an AI assistant for Tududi, a personal task management system. You help users manage their tasks, projects, and notes.

Current user overview:
- Total active tasks: ${stats.total_active_tasks}
- Overdue tasks: ${stats.overdue_tasks}
- Active projects: ${stats.active_projects}

Context provided (prioritized):
- Showing ${stats.showing_tasks} most relevant tasks (out of ${stats.total_active_tasks} total)
- Showing ${stats.showing_projects} recent projects (out of ${stats.active_projects} total)
- Showing ${stats.showing_notes} recent notes

Most important tasks (overdue, upcoming, high priority):
${recentTasks || 'No tasks in context'}

Active projects:
${activeProjects || 'No active projects'}

Recent notes:
${recentNotes || 'No recent notes'}

NOTE: You are seeing a prioritized subset of the user's data. If asked about tasks not in this list, acknowledge that you're showing the most important items and the user may have additional tasks.

You can help users:
1. Search and filter their tasks and projects
2. Get summaries and insights about their work
3. Answer questions about their productivity
4. Provide recommendations

Guidelines:
- Be concise and helpful
- Format responses using markdown
- Use bullet points for lists
- Highlight important information with **bold**
- If you don't have enough information, ask clarifying questions
- Don't make up data - only use what's provided in context
- **ALWAYS reply in the same language as the user's question** - if they ask in Greek, reply in Greek; if in English, reply in English; etc.

⚠️ CRITICAL: ALWAYS USE USER DATA IN RESPONSES
When users ask generic questions like "how to be more productive", "what should I focus on", or "give me advice":
- NEVER give generic advice
- ALWAYS analyze their actual tasks, projects, and overdue items shown above
- Reference specific tasks by ID using [TASK:id] format
- Provide personalized recommendations based on their data
- Point out overdue tasks, upcoming deadlines, or high-priority items
- Base all suggestions on their actual workload and patterns

Example for "how to be more productive":
❌ WRONG: "1. Prioritize tasks, 2. Set goals, 3. Take breaks" (generic advice)
✅ CORRECT: "Based on your current workload, I recommend: 1. Address your ${stats.overdue_tasks} overdue tasks first, especially [TASK:id] Task name. 2. Focus on high-priority items like [TASK:id] Task name before they become overdue..."

⚠️ CRITICAL FORMATTING RULES - MANDATORY - NO EXCEPTIONS:

When referencing ANY task, project, or note, you MUST use this EXACT format:
[TASK:id] Task name
[PROJECT:id] Project name
[NOTE:id] Note title

This format creates CLICKABLE links. Without it, users cannot interact with items.

✅ CORRECT - Always do this:
[TASK:abc123] Complete quarterly report
[PROJECT:xyz789] Website Redesign
[NOTE:note123] Meeting notes

❌ WRONG - Never do this:
- "Complete quarterly report"
- "**Complete quarterly report**"
- "1. Complete quarterly report"
- "Complete quarterly report (ID: abc123)"
- Any format without square brackets [TYPE:id]

RULES:
1. Start with opening bracket [
2. Type in UPPERCASE: TASK, PROJECT, or NOTE
3. Colon :
4. The exact ID from context above
5. Closing bracket ]
6. Space
7. Item name

Example response when user asks "show my tasks":

Here are your most important tasks:

[TASK:abc123] Complete quarterly report
[TASK:def456] Review code changes
[TASK:ghi789] Update documentation

Each line MUST start with the bracket format. Do not add bullets, numbers, or markdown formatting before the brackets.`;
    }

    async chat(
        userId,
        message,
        conversationHistory = [],
        conversationId = null
    ) {
        try {
            // Step 1: Parse intent using TensorFlow
            console.log('Parsing intent for:', message);
            const parseResult = await intentParser.parse(message);
            console.log('Intent parsed:', {
                intent: parseResult.intent,
                confidence: parseResult.confidence,
                needsAI: parseResult.needsAI,
            });

            // Step 2: Try to handle with structured query handler (no OpenAI needed)
            if (!parseResult.needsAI) {
                const structuredResponse = await queryHandler.handleQuery(
                    userId,
                    parseResult
                );

                if (structuredResponse) {
                    console.log('Query handled without OpenAI');

                    // Prepend analysis information
                    const analysis = this.formatAnalysis(parseResult, false);
                    const fullMessage = `${analysis}\n\n---\n\n${structuredResponse.response}`;

                    return {
                        message: fullMessage,
                        intent: parseResult.intent,
                        confidence: parseResult.confidence,
                        usedAI: false,
                        cost: { total_cost: 0 }, // No cost for local processing
                    };
                }
            }

            // Step 3: Fall back to OpenAI for complex queries
            console.log('Falling back to OpenAI');

            if (!this.client) {
                throw new Error('AI client not initialized. Check API key.');
            }

            // Check cache first
            let context;
            const cacheKey = conversationId || `user_${userId}`;
            const cached = this.contextCache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                context = cached.context;
                console.log(`Using cached context for ${cacheKey}`);
            } else {
                // Build fresh context
                context = await this.buildUserContext(userId);
                this.contextCache.set(cacheKey, {
                    context,
                    timestamp: Date.now(),
                });
                console.log(`Built fresh context for ${cacheKey}`);
            }

            const systemPrompt = this.buildSystemPrompt(context);

            // Prepare messages (limit history to last 10 messages)
            const recentHistory = conversationHistory.slice(-10);

            // Always add formatting reminder to reinforce the rule
            const formattingReminder = [
                {
                    role: 'user',
                    content:
                        'Remember: when listing tasks, projects, or notes, always use [TASK:id] format, correct?',
                },
                {
                    role: 'assistant',
                    content:
                        'Absolutely! I will ALWAYS use the exact format: [TASK:id] Task name, [PROJECT:id] Project name, [NOTE:id] Note title. Never bold, bullets, or other formatting. Only the square bracket format.',
                },
            ];

            const messages = [
                { role: 'system', content: systemPrompt },
                ...formattingReminder,
                ...recentHistory,
                { role: 'user', content: message },
            ];

            // Call AI
            if (this.provider === 'openai') {
                const response = await this.client.chat.completions.create({
                    model: this.model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                });

                const cost = this.calculateCost(this.model, response.usage);

                // Prepend analysis information
                const analysis = this.formatAnalysis(parseResult, true);
                const fullMessage = `${analysis}\n\n---\n\n${response.choices[0].message.content}`;

                return {
                    message: fullMessage,
                    usage: response.usage,
                    cost: cost,
                    model: this.model,
                    intent: parseResult.intent,
                    confidence: parseResult.confidence,
                    usedAI: true,
                };
            } else if (this.provider === 'ollama') {
                const response = await this.client.chat({
                    model: this.model,
                    messages: messages,
                });

                // Prepend analysis information
                const analysis = this.formatAnalysis(parseResult, true);
                const fullMessage = `${analysis}\n\n---\n\n${response.message.content}`;

                return {
                    message: fullMessage,
                    model: this.model,
                    cost: null, // Ollama is free/local
                    intent: parseResult.intent,
                    confidence: parseResult.confidence,
                    usedAI: true,
                };
            }
        } catch (error) {
            logError('AI Chat Error:', error);
            throw error;
        }
    }

    async *chatStream(
        userId,
        message,
        conversationHistory = [],
        conversationId = null
    ) {
        if (!this.client) {
            throw new Error('AI client not initialized. Check API key.');
        }

        try {
            // Check cache first
            let context;
            const cacheKey = conversationId || `user_${userId}`;
            const cached = this.contextCache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                context = cached.context;
            } else {
                context = await this.buildUserContext(userId);
                this.contextCache.set(cacheKey, {
                    context,
                    timestamp: Date.now(),
                });
            }

            const systemPrompt = this.buildSystemPrompt(context);

            const recentHistory = conversationHistory.slice(-10);
            const messages = [
                { role: 'system', content: systemPrompt },
                ...recentHistory,
                { role: 'user', content: message },
            ];

            if (this.provider === 'openai') {
                const stream = await this.client.chat.completions.create({
                    model: this.model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: true,
                });

                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) {
                        yield content;
                    }
                }
            } else if (this.provider === 'ollama') {
                const stream = await this.client.chat({
                    model: this.model,
                    messages: messages,
                    stream: true,
                });

                for await (const chunk of stream) {
                    yield chunk.message.content;
                }
            }
        } catch (error) {
            logError('AI Stream Error:', error);
            throw error;
        }
    }

    isEnabled() {
        return this.client !== null;
    }

    clearCache(conversationId = null) {
        if (conversationId) {
            this.contextCache.delete(conversationId);
        } else {
            this.contextCache.clear();
        }
    }

    getCacheStats() {
        return {
            cached_conversations: this.contextCache.size,
            cache_expiry_ms: this.cacheExpiry,
            limits: this.limits,
        };
    }

    /**
     * Format analysis information for display
     */
    formatAnalysis(parseResult, usedAI) {
        const { intent, confidence, entities } = parseResult;

        // Format confidence percentage
        const confidencePercent = Math.round(confidence * 100);

        // Processing method
        const processingMethod = usedAI ? 'OpenAI API' : 'Local Processing';

        // Cost indicator
        const costIndicator = usedAI ? 'API Cost' : '$0';

        let analysis = `### Query Analysis\n\n`;
        analysis += `- **Intent:** ${intent}\n`;
        analysis += `- **Confidence:** ${confidencePercent}%\n`;
        analysis += `- **Processing:** ${processingMethod}\n`;
        analysis += `- **Cost:** ${costIndicator}`;

        // Add entity information if present
        if (entities) {
            const entityInfo = [];
            if (entities.priority)
                entityInfo.push(`Priority: ${entities.priority}`);
            if (entities.timePeriod)
                entityInfo.push(
                    `Time: ${entities.timePeriod.replace('_', ' ')}`
                );
            if (entities.metrics && entities.metrics.length > 0) {
                entityInfo.push(`Metrics: ${entities.metrics.join(', ')}`);
            }

            if (entityInfo.length > 0) {
                analysis += `\n- **Detected:** ${entityInfo.join(', ')}`;
            }
        }

        return analysis;
    }
}

module.exports = new AIChatService();
