const OpenAI = require('openai');
const { Task, Project, Note, Tag, User } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('./logService');
const intentParser = require('./intentParserService');
const queryHandler = require('./queryHandlerService');

class AIChatService {
    constructor() {
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

        // Client cache for performance (keyed by provider+apiKey hash)
        this.clientCache = new Map();
    }

    /**
     * Get user's AI settings from database
     */
    async getUserSettings(userId) {
        const user = await User.findByPk(userId, {
            attributes: ['ai_provider', 'openai_api_key', 'ollama_base_url', 'ollama_model'],
        });

        if (!user) {
            return null;
        }

        return {
            provider: user.ai_provider || 'openai',
            openaiApiKey: user.openai_api_key || process.env.OPENAI_API_KEY,
            ollamaBaseUrl: user.ollama_base_url || 'http://localhost:11434',
            ollamaModel: user.ollama_model || 'llama3',
        };
    }

    /**
     * Create AI client based on user settings
     */
    createClient(settings) {
        if (!settings) return { client: null, model: null, provider: null };

        const { provider, openaiApiKey, ollamaBaseUrl, ollamaModel } = settings;

        if (provider === 'openai') {
            if (!openaiApiKey) {
                return { client: null, model: null, provider: 'openai' };
            }
            const client = new OpenAI({ apiKey: openaiApiKey });
            const model = process.env.AI_MODEL || 'gpt-4o-mini';
            return { client, model, provider: 'openai' };
        } else if (provider === 'ollama') {
            try {
                const Ollama = require('ollama').Ollama;
                const client = new Ollama({ host: ollamaBaseUrl });
                return { client, model: ollamaModel, provider: 'ollama' };
            } catch (error) {
                logError('Failed to initialize Ollama client:', error);
                return { client: null, model: null, provider: 'ollama' };
            }
        }

        return { client: null, model: null, provider: null };
    }

    /**
     * Check if AI is enabled for a specific user
     */
    async isEnabledForUser(userId) {
        const settings = await this.getUserSettings(userId);
        if (!settings) return false;

        if (settings.provider === 'openai') {
            return !!settings.openaiApiKey;
        } else if (settings.provider === 'ollama') {
            return !!settings.ollamaBaseUrl;
        }

        return false;
    }

    /**
     * Get AI configuration for a specific user
     */
    async getConfigForUser(userId) {
        const settings = await this.getUserSettings(userId);
        if (!settings) {
            return { enabled: false, provider: null, model: null };
        }

        const { client, model, provider } = this.createClient(settings);
        return {
            enabled: !!client,
            provider,
            model,
            hasApiKey: settings.provider === 'openai' ? !!settings.openaiApiKey : true,
        };
    }

    getSchemaDefinition() {
        return `
You are a query planner. Convert the user question into a structured JSON payload that our app can run without more AI calls.

Entities:
- tasks: { uid, name, status (not_started|in_progress|blocked|done|archived), priority (low|medium|high), due_date, project_id, area_id, tags[] }
- projects: { uid, name, state (idea|planned|in_progress|blocked|completed), description, area_id, tags[] }
- notes: { uid, title, project_id, area_id, tags[] }
- areas: { uid, name }
- tags: { uid, name }

Allowed intents: list_tasks, list_projects, list_notes, summary, productivity, stats, search, conversational.

Allowed filters:
- priority: low|medium|high
- timePeriod: today|tomorrow|this_week|next_week|overdue
- state: idea|planned|in_progress|blocked|completed (projects)
- search: free text
- tag: tag uid or name
- area: area uid or name

Metrics options: completion_rate, overdue_rate, task_age, created_done_ratio.
Period options: 7d, 14d, 30d, 90d (default 30d).

Return ONLY compact JSON, no prose. Shape:
{
  "intent": "list_tasks|list_projects|list_notes|summary|productivity|stats|search|conversational",
  "target": "task|project|note|area|tag",
  "filters": { "priority": "...", "timePeriod": "...", "state": "...", "search": "...", "tag": "...", "area": "..." },
  "metrics": ["completion_rate"],
  "period": "30d",
  "confidence": 0.0-1.0
}

If the question is about productivity or completion rate, use intent "productivity" and include metrics like ["completion_rate"] with a sensible period. If you cannot map it, set intent "conversational".
        `;
    }

    extractJson(text) {
        if (!text) return null;
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
            return null;
        }
        const jsonString = text.slice(jsonStart, jsonEnd + 1);
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            logError('Failed to parse LLM structured payload', {
                error: error.message,
                text,
            });
            return null;
        }
    }

    normalizeLLMQuery(payload) {
        if (!payload) return null;
        return {
            intent: payload.intent || 'conversational',
            target: payload.target || 'task',
            filters: payload.filters || {},
            metrics: Array.isArray(payload.metrics) ? payload.metrics : [],
            period: payload.period || '30d',
            confidence: typeof payload.confidence === 'number' ? payload.confidence : 0.5,
        };
    }

    async inferStructuredQuery(message, client, model, provider) {
        if (!client) return null;

        try {
            if (provider === 'openai') {
                const completion = await client.chat.completions.create({
                    model: model,
                    temperature: 0,
                    messages: [
                        { role: 'system', content: this.getSchemaDefinition() },
                        {
                            role: 'user',
                            content: `User question: ${message}`,
                        },
                    ],
                });

                const content = completion.choices[0]?.message?.content || '';
                const parsed = this.extractJson(content);
                if (!parsed) return null;
                return {
                    payload: this.normalizeLLMQuery(parsed),
                    usage: completion.usage,
                };
            } else if (provider === 'ollama') {
                const response = await client.chat({
                    model: model,
                    messages: [
                        { role: 'system', content: this.getSchemaDefinition() },
                        {
                            role: 'user',
                            content: `User question: ${message}`,
                        },
                    ],
                });

                const content = response.message?.content || '';
                const parsed = this.extractJson(content);
                if (!parsed) return null;
                return {
                    payload: this.normalizeLLMQuery(parsed),
                    usage: null, // Ollama doesn't provide usage stats
                };
            }
            return null;
        } catch (error) {
            logError('LLM schema inference failed', error);
            return null;
        }
    }

    async generateAnswerFromData(message, plan, data, client, model, provider) {
        if (!client) {
            return { answer: 'AI is not configured.', cost: null };
        }

        const limitedData = {
            tasks: Array.isArray(data?.tasks) ? data.tasks.slice(0, 15) : [],
            projects: Array.isArray(data?.projects)
                ? data.projects.slice(0, 10)
                : [],
            notes: Array.isArray(data?.notes) ? data.notes.slice(0, 10) : [],
            summary: data?.response || '',
        };

        const messages = [
            {
                role: 'system',
                content:
                    'You are an assistant that helps with tasks, projects, and notes. IMPORTANT: Only reference items that exist in the provided Data. When referencing existing items, use the exact format [TASK:uid], [PROJECT:uid], or [NOTE:uid] with the uid from the data. NEVER invent or make up IDs. If no relevant items exist in the data, just describe what the user could do without using item markers. Be concise and helpful.',
            },
            {
                role: 'user',
                content: `Question: ${message}\nPlan: ${JSON.stringify(
                    plan
                )}\nData: ${JSON.stringify(limitedData)}`,
            },
        ];

        if (provider === 'openai') {
            const completion = await client.chat.completions.create({
                model: model,
                temperature: 0.3,
                messages,
            });

            const answer = completion.choices[0]?.message?.content || '';
            const cost = this.calculateCost(model, completion.usage);
            return { answer, cost };
        } else if (provider === 'ollama') {
            const response = await client.chat({
                model: model,
                messages,
            });

            const answer = response.message?.content || '';
            return { answer, cost: null }; // Ollama is free/local
        }

        return { answer: 'Unknown provider.', cost: null };
    }

    async chatStructured(userId, message, conversationId = null) {
        // Get user's AI settings
        const settings = await this.getUserSettings(userId);
        const { client, model, provider } = this.createClient(settings);

        const planResult = await this.inferStructuredQuery(message, client, model, provider);
        const plan =
            planResult?.payload || {
                intent: 'conversational',
                target: 'task',
                filters: {},
                metrics: [],
                period: '30d',
                confidence: 0.5,
            };

        let data = {};
        if (plan.intent && plan.intent !== 'conversational') {
            const parseResult = {
                intent: plan.intent,
                confidence: plan.confidence || 0.5,
                entities: {
                    itemType: plan.target,
                    priority: plan.filters?.priority,
                    timePeriod: plan.filters?.timePeriod,
                    metrics: plan.metrics || [],
                    period: plan.period,
                    searchTerm: plan.filters?.search,
                },
                query: plan,
                needsAI: false,
            };
            data =
                (await queryHandler.handleQuery(userId, parseResult)) || {
                    response: 'No data found.',
                };
        }

        // If we have structured data with a response that includes task/project/note references,
        // use it directly instead of asking AI to reformulate (which may lose UIDs)
        const hasStructuredItems = data.tasks?.length > 0 || data.projects?.length > 0 || data.notes?.length > 0;
        const hasFormattedResponse = data.response && data.response.includes('[TASK:') ||
                                      data.response && data.response.includes('[PROJECT:') ||
                                      data.response && data.response.includes('[NOTE:');

        if (hasStructuredItems || hasFormattedResponse) {
            // Use the structured response directly - it has proper UIDs
            return {
                answer: data.response || 'Here are the results.',
                plan,
                data,
                cost: planResult?.usage ? this.calculateCost(model, planResult.usage) : null,
            };
        }

        // Only use AI for conversational queries or when we need to generate a response
        const answerResult = await this.generateAnswerFromData(
            message,
            plan,
            data,
            client,
            model,
            provider
        );

        return {
            answer: answerResult.answer,
            plan,
            data,
            cost: answerResult.cost,
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
            const activeStatusFilter = {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    'done',
                    'archived',
                    'completed',
                ],
            };

            // Smart task selection - prioritize:
            // 1. Overdue tasks (highest priority)
            // 2. Due today/tomorrow
            // 3. Due this week
            // 4. High priority tasks
            // 5. Recently updated tasks

            const baseActiveWhere = {
                user_id: userId,
                status: activeStatusFilter,
                completed_at: null,
            };

            const overdueTasks = await Task.findAll({
                where: {
                    ...baseActiveWhere,
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
                    ...baseActiveWhere,
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
                    ...baseActiveWhere,
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
            const totalActiveTasks = await Task.count({ where: baseActiveWhere });

            const overdueCount = await Task.count({
                where: {
                    ...baseActiveWhere,
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
            // Get user's AI settings
            const settings = await this.getUserSettings(userId);
            const { client, model, provider } = this.createClient(settings);

            // Step 1: Parse intent using TensorFlow
            console.log('Parsing intent for:', message);
            const parseResult = await intentParser.parse(message);
            console.log('Intent parsed:', {
                intent: parseResult.intent,
                confidence: parseResult.confidence,
                needsAI: parseResult.needsAI,
                entities: parseResult.entities,
                query: parseResult.query,
            });

            // Step 2: Try to handle with structured query handler (no AI needed)
            if (!parseResult.needsAI) {
                const structuredResponse = await queryHandler.handleQuery(
                    userId,
                    parseResult
                );

                if (structuredResponse) {
                    console.log('Query handled without AI');

                    // Prepend analysis information
                    const analysis = this.formatAnalysis(parseResult);
                    const fullMessage = `${analysis}${structuredResponse.response}`;

                    return {
                        message: fullMessage,
                        intent: parseResult.intent,
                        confidence: parseResult.confidence,
                        usedAI: false,
                        cost: { total_cost: 0 }, // No cost for local processing
                    };
                }
            }

            // Step 2.5: If still needs AI, ask the model to produce a structured query using schema
            if (parseResult.needsAI && client) {
                const llmStructured = await this.inferStructuredQuery(message, client, model, provider);
                const llmPayload = llmStructured?.payload;

                if (llmPayload && llmPayload.intent && llmPayload.intent !== 'conversational') {
                    const llmParseResult = {
                        intent: llmPayload.intent,
                        confidence: llmPayload.confidence || parseResult.confidence,
                        entities: {
                            itemType: llmPayload.target,
                            priority: llmPayload.filters?.priority,
                            timePeriod: llmPayload.filters?.timePeriod,
                            metrics: llmPayload.metrics || [],
                            period: llmPayload.period,
                            searchTerm: llmPayload.filters?.search,
                        },
                        query: llmPayload,
                        needsAI: false,
                    };

                    const structuredResponse = await queryHandler.handleQuery(
                        userId,
                        llmParseResult
                    );

                    if (structuredResponse) {
                        console.log('Query handled via LLM schema parsing');
                        const analysis = this.formatAnalysis(llmParseResult);
                        const fullMessage = `${analysis}${structuredResponse.response}`;
                        return {
                            message: fullMessage,
                            intent: llmParseResult.intent,
                            confidence: llmParseResult.confidence,
                            usedAI: false,
                            cost: this.calculateCost(model, llmStructured?.usage),
                        };
                    }
                }
            }

            // Step 3: Fall back to AI for complex queries
            console.log('Falling back to AI');

            if (!client) {
                throw new Error('AI client not initialized. Check API key in Profile Settings.');
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
            if (provider === 'openai') {
                const response = await client.chat.completions.create({
                    model: model,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                });

                const cost = this.calculateCost(model, response.usage);

                // Prepend analysis information
                const analysis = this.formatAnalysis(parseResult);
                const fullMessage = `${analysis}${response.choices[0].message.content}`;

                return {
                    message: fullMessage,
                    usage: response.usage,
                    cost: cost,
                    model: model,
                    intent: parseResult.intent,
                    confidence: parseResult.confidence,
                    usedAI: true,
                };
            } else if (provider === 'ollama') {
                const response = await client.chat({
                    model: model,
                    messages: messages,
                });

                // Prepend analysis information
                const analysis = this.formatAnalysis(parseResult);
                const fullMessage = `${analysis}${response.message.content}`;

                return {
                    message: fullMessage,
                    model: model,
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
        // Get user's AI settings
        const settings = await this.getUserSettings(userId);
        const { client, model, provider } = this.createClient(settings);

        if (!client) {
            throw new Error('AI client not initialized. Check API key in Profile Settings.');
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

            if (provider === 'openai') {
                const stream = await client.chat.completions.create({
                    model: model,
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
            } else if (provider === 'ollama') {
                const stream = await client.chat({
                    model: model,
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

    /**
     * @deprecated Use isEnabledForUser(userId) instead
     */
    isEnabled() {
        // For backwards compatibility, check if env vars are set
        return !!process.env.OPENAI_API_KEY;
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
    formatAnalysis(parseResult) {
        const { intent, confidence, entities, query } = parseResult;

        // Format confidence percentage
        const confidencePercent = Math.round(confidence * 100);

        // Build compact metadata info
        const metaParts = [
            `intent: ${intent}`,
            `${confidencePercent}% confidence`,
        ];

        // Add entity information if present
        if (entities) {
            if (entities.priority) metaParts.push(entities.priority);
            if (entities.timePeriod)
                metaParts.push(entities.timePeriod.replace('_', ' '));
            if (entities.metrics && entities.metrics.length > 0) {
                metaParts.push(entities.metrics.join(', '));
            }
        }

        // Build detailed analysis for collapsible section
        const detailedAnalysis = {
            intent,
            confidence: confidencePercent,
            entities: entities || {},
            filters: query?.filters || {},
        };

        // Return metadata with detailed analysis in JSON
        return `[METADATA]${metaParts.join(' · ')}[DETAILS]${JSON.stringify(detailedAnalysis)}[/DETAILS][/METADATA]\n\n`;
    }
}

module.exports = new AIChatService();
