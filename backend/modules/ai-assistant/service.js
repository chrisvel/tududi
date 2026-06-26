'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const moment = require('moment-timezone');
const { User, Goal, Project, Area } = require('../../models');
const { computeTaskMetrics } = require('../tasks/queries/metrics-computation');

const PRIORITY_LABELS = { 0: 'low', 1: 'medium', 2: 'high' };
const STATUS_LABELS = {
    0: 'not started',
    1: 'in progress',
    2: 'done',
    3: 'archived',
    4: 'waiting',
    5: 'cancelled',
    6: 'planned',
};

function getAnthropicClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    return new Anthropic({ apiKey });
}

async function fetchUserContext(userId) {
    const user = await User.findByPk(userId, {
        attributes: ['id', 'timezone', 'email'],
    });
    if (!user) throw new Error('User not found');

    const timezone = user.timezone || 'UTC';

    const [goals, projects, metrics] = await Promise.all([
        Goal.findAll({
            where: { user_id: userId, status: 'active' },
            include: [{ model: Area, attributes: ['name'], required: false }],
            order: [['created_at', 'ASC']],
        }),
        Project.findAll({
            where: {
                user_id: userId,
                status: ['in_progress', 'planned', 'waiting'],
            },
            include: [
                { model: Area, attributes: ['name'], required: false },
                {
                    model: Goal,
                    as: 'Goal',
                    attributes: ['title'],
                    required: false,
                },
            ],
            order: [['created_at', 'ASC']],
        }),
        computeTaskMetrics(userId, timezone),
    ]);

    return { user, timezone, goals, projects, metrics };
}

function buildContextSummary({ user, timezone, goals, projects, metrics }) {
    const now = moment().tz(timezone);
    const dateStr = now.format('dddd, MMMM D, YYYY');
    const timeStr = now.format('h:mm A z');

    const lines = [];

    lines.push(`# User Context`);
    lines.push(`Date: ${dateStr} | Time: ${timeStr} | Timezone: ${timezone}`);
    lines.push('');

    // Goals
    lines.push(`## Active Goals (${goals.length})`);
    if (goals.length === 0) {
        lines.push('No active goals set.');
    } else {
        goals.forEach((g) => {
            const area = g.Area ? ` [${g.Area.name}]` : '';
            const horizon = g.horizon ? ` (${g.horizon})` : '';
            const target = g.target_date ? ` — target: ${g.target_date}` : '';
            lines.push(`- "${g.title}"${area}${horizon}${target}`);
            if (g.why) lines.push(`  Why: ${g.why}`);
        });
    }
    lines.push('');

    // Projects
    lines.push(`## Active Projects (${projects.length})`);
    if (projects.length === 0) {
        lines.push('No active projects.');
    } else {
        projects.forEach((p) => {
            const area = p.Area ? ` [${p.Area.name}]` : '';
            const goal = p.Goal ? ` → Goal: "${p.Goal.title}"` : '';
            const priority = PRIORITY_LABELS[p.priority] || 'none';
            const due = p.due_date_at
                ? ` | due: ${moment(p.due_date_at).format('MMM D')}`
                : '';
            lines.push(
                `- "${p.name}" [${p.status}] [priority: ${priority}]${area}${goal}${due}`
            );
        });
    }
    lines.push('');

    // Task metrics
    lines.push(`## Today's Task Breakdown`);
    lines.push(`- Total open tasks: ${metrics.total_open_tasks}`);
    lines.push(
        `- Tasks pending over a month: ${metrics.tasks_pending_over_month}`
    );
    lines.push(`- In progress: ${metrics.tasks_in_progress_count}`);
    lines.push(`- Planned for today: ${metrics.today_plan_tasks_count}`);
    lines.push(`- Due today: ${metrics.tasks_due_today_count}`);
    lines.push(`- Overdue: ${(metrics.tasks_overdue || []).length}`);
    lines.push(`- Completed today: ${metrics.tasks_completed_today_count}`);
    lines.push('');

    // Weekly trend
    if (metrics.weekly_completions && metrics.weekly_completions.length > 0) {
        const weeklyStr = metrics.weekly_completions
            .map((d) => `${d.dayName}: ${d.count}`)
            .join(', ');
        lines.push(`## Weekly Completion Trend`);
        lines.push(weeklyStr);
        lines.push('');
    }

    // Overdue tasks (up to 5)
    const overdueTasks = metrics.tasks_overdue || [];
    if (overdueTasks.length > 0) {
        lines.push(
            `## Overdue Tasks (showing ${Math.min(5, overdueTasks.length)} of ${overdueTasks.length})`
        );
        overdueTasks.slice(0, 5).forEach((t) => {
            const daysAgo = t.due_date
                ? moment().diff(moment(t.due_date), 'days')
                : null;
            const overStr = daysAgo !== null ? ` (${daysAgo}d overdue)` : '';
            const project = t.Project?.name
                ? ` [Project: "${t.Project.name}"]`
                : '';
            lines.push(
                `- "${t.name}"${project}${overStr} [${PRIORITY_LABELS[t.priority] || 'no priority'}]`
            );
        });
        lines.push('');
    }

    // In-progress tasks (up to 5)
    const inProgressTasks = metrics.tasks_in_progress || [];
    if (inProgressTasks.length > 0) {
        lines.push(`## Currently In Progress`);
        inProgressTasks.slice(0, 5).forEach((t) => {
            const project = t.Project?.name
                ? ` [Project: "${t.Project.name}"]`
                : '';
            lines.push(
                `- "${t.name}"${project} [${PRIORITY_LABELS[t.priority] || 'no priority'}]`
            );
        });
        lines.push('');
    }

    // Planned for today (up to 5)
    const plannedTasks = metrics.today_plan_tasks || [];
    if (plannedTasks.length > 0) {
        lines.push(`## Planned for Today`);
        plannedTasks.slice(0, 5).forEach((t) => {
            const project = t.Project?.name
                ? ` [Project: "${t.Project.name}"]`
                : '';
            lines.push(
                `- "${t.name}"${project} [${STATUS_LABELS[t.status] || t.status}] [${PRIORITY_LABELS[t.priority] || 'no priority'}]`
            );
        });
        lines.push('');
    }

    // Suggested tasks (up to 5)
    const suggestedTasks = metrics.suggested_tasks || [];
    if (suggestedTasks.length > 0) {
        lines.push(
            `## System-Suggested Tasks (top ${Math.min(5, suggestedTasks.length)})`
        );
        suggestedTasks.slice(0, 5).forEach((t) => {
            const project = t.Project?.name
                ? ` [Project: "${t.Project.name}"]`
                : '';
            lines.push(
                `- "${t.name}"${project} [${PRIORITY_LABELS[t.priority] || 'no priority'}]`
            );
        });
        lines.push('');
    }

    return lines.join('\n');
}

async function getCachedBrief(userId) {
    const user = await User.findByPk(userId, {
        attributes: ['ai_daily_brief', 'ai_daily_brief_date'],
    });
    if (!user || !user.ai_daily_brief) return null;
    return user.ai_daily_brief;
}

async function generateDailyBrief(userId) {
    const context = await fetchUserContext(userId);
    const contextSummary = buildContextSummary(context);

    const client = getAnthropicClient();

    const systemPrompt = `You are a productivity assistant in Tududi. Return a daily brief as JSON. Keep every field very short — no full sentences, no filler words.

Return a JSON object with exactly this shape:
{
  "focus": "≤10 words. The one most important task today. Include project name.",
  "priority_actions": [
    {
      "action": "Exact task name",
      "project": "Project name or null",
      "reason": "≤6 words — why this matters now.",
      "suggestion": "≤12 words. Guess what this task involves and give one motivating tip or next step. Be specific and human."
    }
  ],
  "watch_out": ["≤8 words. Name the at-risk task or project."]
}

Rules:
- priority_actions: exactly 3 items, ordered by importance
- suggestion: infer the task's nature from its name, then motivate — e.g. for "Write test cases" say "Start with the happy path, the rest will flow." Don't be generic.
- watch_out: 0–2 items; empty array [] if nothing urgent
- Plain text only — no markdown, no ** formatting
- Return only the JSON object, no other text`;

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        system: systemPrompt,
        messages: [{ role: 'user', content: contextSummary }],
        max_tokens: 500,
    });

    const raw = response.content[0]?.text || '{}';
    console.log('[AI Assistant] raw response:', raw);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = {
            focus: raw,
            priority_actions: [],
            goal_alignment: '',
            watch_out: [],
        };
    }
    console.log('[AI Assistant] parsed:', JSON.stringify(parsed));

    const brief = {
        focus: parsed.focus || '',
        priority_actions: Array.isArray(parsed.priority_actions)
            ? parsed.priority_actions
            : [],
        watch_out: Array.isArray(parsed.watch_out) ? parsed.watch_out : [],
        generated_at: new Date().toISOString(),
        model: response.model,
        usage: {
            prompt_tokens: response.usage?.input_tokens,
            completion_tokens: response.usage?.output_tokens,
        },
    };

    await User.update(
        {
            ai_daily_brief: brief,
            ai_daily_brief_date: moment().format('YYYY-MM-DD'),
        },
        { where: { id: userId } }
    );

    return brief;
}

async function getCachedTaskInsights(taskUid, userId) {
    const { Task } = require('../../models');
    const task = await Task.findOne({
        where: { uid: taskUid, user_id: userId },
        attributes: ['ai_insights'],
    });
    if (!task || !task.ai_insights) return null;

    const stored = task.ai_insights;

    // Handle legacy nested format: { request, response, generated_at }
    if (stored.response && typeof stored.response === 'object') {
        return {
            ...stored.response,
            generated_at: stored.generated_at || null,
            dismissed: stored.dismissed || false,
        };
    }

    return stored;
}

async function updateTaskInsightsDismissed(taskUid, userId, dismissed) {
    const { Task } = require('../../models');
    const task = await Task.findOne({
        where: { uid: taskUid, user_id: userId },
        attributes: ['ai_insights'],
    });
    if (!task || !task.ai_insights) return null;

    const stored = task.ai_insights;

    // Normalise legacy nested format before patching
    let flat = stored;
    if (stored.response && typeof stored.response === 'object') {
        flat = {
            ...stored.response,
            generated_at: stored.generated_at || null,
        };
    }

    const updated = { ...flat, dismissed };
    await Task.update(
        { ai_insights: updated },
        { where: { uid: taskUid, user_id: userId } }
    );
    return updated;
}

async function generateTaskInsights(taskContext, userId) {
    const client = getAnthropicClient();

    const {
        taskUid,
        taskName,
        taskNote,
        taskStatus,
        taskPriority,
        taskDueDate,
        taskTags,
        subtaskCount,
        projectName,
        projectDescription,
        projectStatus,
        projectGoal,
        projectArea,
    } = taskContext;

    const lines = [];
    lines.push(`Task: "${taskName}"`);
    lines.push(`Status: ${STATUS_LABELS[taskStatus] || taskStatus}`);
    lines.push(`Priority: ${PRIORITY_LABELS[taskPriority] || 'none'}`);
    if (taskDueDate) lines.push(`Due: ${taskDueDate}`);
    if (taskTags && taskTags.length > 0)
        lines.push(`Tags: ${taskTags.join(', ')}`);
    if (subtaskCount > 0) lines.push(`Subtasks: ${subtaskCount}`);
    if (taskNote) lines.push(`Notes: ${taskNote.slice(0, 300)}`);
    if (projectName) {
        lines.push(`Project: "${projectName}" [${projectStatus || 'active'}]`);
        if (projectArea) lines.push(`Area: ${projectArea}`);
        if (projectGoal) lines.push(`Goal: ${projectGoal}`);
        if (projectDescription)
            lines.push(
                `Project description: ${projectDescription.slice(0, 200)}`
            );
    }

    const systemPrompt = `You are a productivity assistant in Tududi. A user is viewing a task and needs real, specific help — not a paraphrase of the task name. Use the task name, project, tags, and notes to infer what this work actually involves, then give guidance that would only apply to THIS specific task.

CRITICAL RULE: Never echo the task name back as your insight. If the task is "Write deployment procedures", your insight must explain what deployment procedures typically cover, what makes them hard, what done looks like — not just "this involves writing deployment procedures."

Return a JSON object with exactly this shape:
{
  "insight": "3–4 sentences. Explain what this work actually involves at a domain level — what specifically needs to be researched, written, built, or decided. Describe what a good final deliverable looks like. Call out non-obvious scope or complexity a beginner would miss.",
  "next_step": "2–3 sentences. Name the single most concrete first action. Give a real example — e.g. 'Open a blank doc and write the heading: Environment Requirements. List the 3 things someone would need installed before they can deploy.' Don't say 'start by planning' or 'gather requirements'.",
  "breakdown": [
    "Concrete action phrase specific to this task (not generic)",
    "Next concrete action phrase",
    "Next concrete action phrase",
    "Final concrete action phrase (optional)"
  ],
  "links": [
    { "label": "Short display name", "url": "https://example.com/specific-page" }
  ],
  "watch_out": "1–2 sentences. Name a real, specific risk that applies to THIS task — a dependency, an assumption that could be wrong, or something that commonly causes this kind of task to fail or get stuck. Or null if genuinely nothing to flag."
}

EXAMPLE of BAD output (too generic — never do this):
{
  "insight": "Creating detailed steps for software deployment.",
  "next_step": "Draft an outline of key deployment steps.",
  "breakdown": ["Plan the steps", "Write the document", "Review it"],
  "links": [],
  "watch_out": "Avoid last-minute changes."
}

EXAMPLE of GOOD output for task "Write deployment procedures" in project "E-commerce platform":
{
  "insight": "Deployment procedures for an e-commerce platform need to cover the full release lifecycle: pre-deploy checks, the exact sequence of commands to push code and run migrations, how to verify the deploy succeeded, and a rollback plan if something breaks. Done means a team member with no prior context could follow the doc and deploy successfully without asking questions. The tricky part is usually capturing the implicit knowledge that lives in people's heads — things like 'always restart the worker queue after migrations' or 'check the Stripe webhook endpoint is still pointed at prod'.",
  "next_step": "Open a doc and write a section called 'Pre-deployment checklist' first — this is usually the most forgotten part. List things like: feature flags off, migrations tested on staging, cache warmed, CDN purge queued. Once the checklist exists, the rest of the doc almost writes itself.",
  "breakdown": ["List all environments and who can deploy to each", "Document pre-deploy checklist (migrations, flags, dependencies)", "Write step-by-step deploy commands with expected output", "Add rollback procedure with exact revert steps", "Include post-deploy smoke tests to confirm success"],
  "links": [
    { "label": "GitHub Actions: Deploy", "url": "https://docs.github.com/en/actions/deployment/about-deployments/about-continuous-deployment" },
    { "label": "12-Factor App", "url": "https://12factor.net/build-release-run" }
  ],
  "watch_out": "If this project has database migrations, the deploy order matters — running migrations before or after the code deploy can break things in production for a few seconds. Make sure the doc specifies the exact order and whether the app needs to be in maintenance mode during the migration."
}

EXAMPLE of GOOD output for task "Plan museum visits in Paris" in project "Europe Trip 2024":
{
  "insight": "Planning Paris museum visits means deciding which of the city's 130+ museums fit your interests, then sequencing them geographically to avoid wasting half a day on the Métro. The Louvre alone needs 3–4 hours minimum — most people underestimate it and leave feeling rushed. 'Done' looks like a day-by-day schedule with museum names, opening hours, pre-booked ticket links, and nearby lunch spots to bridge visits.",
  "next_step": "Start with the Paris Museum Pass — it covers 50+ museums with no queue and saves money if you visit more than 2–3 major sites. Go to parismuseumpass.fr, check which museums are included, and decide whether a 2-day or 4-day pass fits your itinerary before booking anything else.",
  "breakdown": ["Pick top 5–8 museums based on interests (art, history, science)", "Check which are covered by the Paris Museum Pass", "Group museums by arrondissement to plan walking routes", "Book timed-entry tickets for Louvre and Versailles (sell out weeks ahead)", "Build a day-by-day schedule with opening hours and travel time"],
  "links": [
    { "label": "Louvre — Book tickets", "url": "https://www.louvre.fr/en/visit/tickets-passes" },
    { "label": "Musée d'Orsay", "url": "https://www.musee-orsay.fr/en/visit/practical-information/opening-times-and-admission-prices" },
    { "label": "Paris Museum Pass", "url": "https://www.parismuseumpass.fr/en" }
  ],
  "watch_out": "The Louvre and Palace of Versailles require timed-entry tickets booked weeks in advance during summer — walking up on the day almost always means turning back. Book these two first before planning the rest of the itinerary around them."
}

Rules:
- breakdown: 3–5 items, ordered by sequence, specific to THIS task
- links: 2–3 items. Prefer SPECIFIC, DIRECT links to the actual resources implied by this task — official websites of the museums/places/tools/docs mentioned, not generic homepages. Examples of good specificity: for "Plan museum visits in Paris" → link directly to https://www.louvre.fr/en, https://www.musee-orsay.fr/en, https://www.parismuseumpass.fr; for "Research flights to Tokyo" → https://www.google.com/travel/flights, https://www.skyscanner.com; for "Fix React useEffect bug" → https://react.dev/reference/react/useEffect. Use the exact official URL you know for this specific institution or tool. If you only know the root domain and not the specific page, use the root (e.g. https://www.centrepompidou.fr). Empty array [] only if no useful links genuinely apply.
- Plain text only in text fields — no markdown, no ** formatting
- Always reference the actual task name, project name, or tags in your response
- Return only the JSON object, no other text`;

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        system: systemPrompt,
        messages: [{ role: 'user', content: lines.join('\n') }],
        max_tokens: 1000,
    });

    const raw = response.content[0]?.text || '{}';
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = {};
    }

    const rawLinks = Array.isArray(parsed.links) ? parsed.links : [];
    const links = rawLinks
        .filter(
            (l) =>
                l &&
                typeof l.label === 'string' &&
                typeof l.url === 'string' &&
                /^https?:\/\/.+/.test(l.url)
        )
        .slice(0, 3);

    const result = {
        insight: parsed.insight || '',
        next_step: parsed.next_step || '',
        breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown : [],
        links,
        watch_out: parsed.watch_out || null,
        generated_at: new Date().toISOString(),
        dismissed: false,
    };

    if (taskUid && userId) {
        const { Task } = require('../../models');
        await Task.update(
            { ai_insights: result },
            { where: { uid: taskUid, user_id: userId } }
        );
    }

    return result;
}

async function getCachedProjectInsights(projectUid, userId) {
    const { Project } = require('../../models');
    const project = await Project.findOne({
        where: { uid: projectUid, user_id: userId },
        attributes: ['ai_insights'],
    });
    if (!project || !project.ai_insights) return null;
    return project.ai_insights;
}

async function updateProjectInsightsDismissed(projectUid, userId, dismissed) {
    const { Project } = require('../../models');
    const project = await Project.findOne({
        where: { uid: projectUid, user_id: userId },
        attributes: ['ai_insights'],
    });
    if (!project || !project.ai_insights) return null;

    const updated = { ...project.ai_insights, dismissed };
    await Project.update(
        { ai_insights: updated },
        { where: { uid: projectUid, user_id: userId } }
    );
    return updated;
}

async function generateProjectInsights(projectContext, userId) {
    const client = getAnthropicClient();

    const {
        projectUid,
        projectName,
        projectDescription,
        projectStatus,
        projectPriority,
        projectDueDate,
        projectGoal,
        projectArea,
        totalTasks,
        openTasks,
        completedTasks,
        inProgressTasks,
        overdueTaskCount,
    } = projectContext;

    const lines = [];
    lines.push(`Project: "${projectName}"`);
    lines.push(`Status: ${projectStatus || 'not_started'}`);
    if (projectPriority !== undefined && projectPriority !== null) {
        lines.push(`Priority: ${PRIORITY_LABELS[projectPriority] || 'none'}`);
    }
    if (projectDueDate) lines.push(`Due: ${projectDueDate}`);
    if (projectArea) lines.push(`Area: ${projectArea}`);
    if (projectGoal) lines.push(`Goal: ${projectGoal}`);
    if (projectDescription)
        lines.push(`Description: ${projectDescription.slice(0, 300)}`);
    lines.push(
        `Tasks: ${totalTasks || 0} total, ${openTasks || 0} open, ${completedTasks || 0} completed, ${inProgressTasks || 0} in progress`
    );
    if (overdueTaskCount > 0) lines.push(`Overdue tasks: ${overdueTaskCount}`);

    const systemPrompt = `You are a productivity assistant in Tududi. A user is viewing a project and needs specific, actionable guidance — not generic advice. Use the project name, description, status, and task data to infer what this project is actually about, then give insights that only apply to THIS specific project.

CRITICAL RULE: Never just echo back the project name or status. Give real domain-level analysis.

Return a JSON object with exactly this shape:
{
  "insight": "3–4 sentences. Explain what this project is actually about at a domain level — what the work involves, what success looks like, and the current state based on the task data. Call out non-obvious scope or complexity.",
  "next_action": "2–3 sentences. Name the single most concrete next action to advance this project right now. Be specific — reference what kind of task should be created or worked on, based on the project's domain. Don't say 'add more tasks' or 'keep working'.",
  "health": "1–2 sentences. Give an honest assessment of project health based on the task numbers and due date. Is it on track, stalled, behind, or healthy? Reference actual numbers where relevant.",
  "watch_out": "1–2 sentences. Name a real, specific risk that applies to THIS project — a dependency, an assumption, something commonly causing this kind of project to stall. Or null if genuinely nothing to flag."
}

Rules:
- Plain text only — no markdown, no ** formatting
- Always reference the actual project name, domain, or task data in your response
- health must reference actual numbers if available
- watch_out should be null (JSON null) if there's no meaningful risk to flag
- Return only the JSON object, no other text`;

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        system: systemPrompt,
        messages: [{ role: 'user', content: lines.join('\n') }],
        max_tokens: 600,
    });

    const raw = response.content[0]?.text || '{}';
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = {};
    }

    const result = {
        insight: parsed.insight || '',
        next_action: parsed.next_action || '',
        health: parsed.health || '',
        watch_out: parsed.watch_out || null,
        generated_at: new Date().toISOString(),
        dismissed: false,
    };

    if (projectUid && userId) {
        const { Project } = require('../../models');
        await Project.update(
            { ai_insights: result },
            { where: { uid: projectUid, user_id: userId } }
        );
    }

    return result;
}

module.exports = {
    generateDailyBrief,
    getCachedBrief,
    generateTaskInsights,
    getCachedTaskInsights,
    updateTaskInsightsDismissed,
    generateProjectInsights,
    getCachedProjectInsights,
    updateProjectInsightsDismissed,
};
