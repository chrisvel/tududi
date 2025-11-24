const { Task, Project, Note } = require('../models');
const { Op } = require('sequelize');
const productivityMetricsService = require('./productivityMetricsService');
const { logError } = require('./logService');

class QueryHandlerService {
    /**
     * Handle structured query based on parsed intent
     */
    async handleQuery(userId, parseResult) {
        const { intent, query, entities } = parseResult;

        try {
            switch (intent) {
                case 'list_tasks':
                    return await this.handleListTasks(userId, query);

                case 'list_projects':
                    return await this.handleListProjects(userId, query);

                case 'list_notes':
                    return await this.handleListNotes(userId, query);

                case 'productivity':
                    return await this.handleProductivity(userId, query);

                case 'summary':
                    return await this.handleSummary(userId, query);

                case 'stats':
                    return await this.handleStats(userId, query);

                case 'search':
                    return await this.handleSearch(userId, query);

                default:
                    return null; // Let OpenAI handle it
            }
        } catch (error) {
            logError('Error handling structured query:', error);
            return null; // Fallback to OpenAI on error
        }
    }

    /**
     * Handle list tasks query
     */
    async handleListTasks(userId, query) {
        const { filters } = query;
        const where = { user_id: userId };

        // Apply priority filter
        if (filters.priority) {
            const priorityMap = { low: 0, medium: 1, high: 2 };
            const priorityValue = priorityMap[filters.priority];
            if (priorityValue !== undefined) {
                where.priority = priorityValue;
                console.log(
                    `Filtering for priority: ${filters.priority} = ${priorityValue}`
                );
            }
        }

        // Always exclude completed and archived tasks (handle both numeric and string statuses)
        where.status = {
            [Op.notIn]: [
                2,
                3,
                Task.STATUS.DONE,
                Task.STATUS.ARCHIVED,
                'done',
                'archived',
                'completed',
            ],
        };
        // Extra guard: avoid anything with a completion timestamp even if status is stale
        where.completed_at = null;

        // Apply time filter
        if (filters.timePeriod) {
            const timeFilter = this.buildTimeFilter(filters.timePeriod);
            if (timeFilter) {
                where.due_date = timeFilter;
            }
        }

        // Exclude subtasks and recurring instances
        where.parent_task_id = null;
        where.recurring_parent_id = null;

        console.log('Task query WHERE:', JSON.stringify(where, null, 2));

        const tasks = await Task.findAll({
            where,
            order: [
                ['due_date', 'ASC'],
                ['priority', 'DESC'],
            ],
            limit: 8,
            attributes: ['uid', 'name', 'status', 'priority', 'due_date', 'note'],
            include: [
                {
                    model: Project,
                    attributes: ['name', 'uid'],
                },
            ],
        });

        console.log(
            `Found ${tasks.length} tasks. Sample:`,
            tasks.slice(0, 2).map((t) => ({
                name: t.name,
                status: t.status,
                priority: t.priority,
            }))
        );

        return this.formatTaskListResponse(tasks, filters);
    }

    /**
     * Handle list projects query
     */
    async handleListProjects(userId, query) {
        const { filters } = query;
        const where = { user_id: userId };

        // Default to active projects
        if (!filters.state) {
            where.state = { [Op.ne]: 'completed' };
        }

        const projects = await Project.findAll({
            where,
            order: [['updated_at', 'DESC']],
            limit: 10,
            attributes: ['uid', 'name', 'state', 'description'],
        });

        return this.formatProjectListResponse(projects);
    }

    /**
     * Handle list notes query
     */
    async handleListNotes(userId, query) {
        const notes = await Note.findAll({
            where: { user_id: userId },
            order: [['updated_at', 'DESC']],
            limit: 20,
            attributes: ['uid', 'title', 'content', 'updated_at'],
        });

        return this.formatNoteListResponse(notes);
    }

    /**
     * Handle productivity metrics query
     */
    async handleProductivity(userId, query) {
        const period = query.period || '30d';
        const metrics = await productivityMetricsService.calculateMetrics(
            userId,
            period
        );

        const recommendations =
            await productivityMetricsService.getRecommendations(
                userId,
                metrics
            );

        return this.formatProductivityResponse(metrics, recommendations);
    }

    /**
     * Handle summary query
     */
    async handleSummary(userId, query) {
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));

        // Get tasks completed today (status = 2 is DONE)
        const completedToday = await Task.count({
            where: {
                user_id: userId,
                status: 2, // DONE
                completed_at: { [Op.gte]: today },
            },
        });

        // Get active tasks (not DONE=2 and not ARCHIVED=3)
        const activeTasks = await Task.count({
            where: {
                user_id: userId,
                status: { [Op.notIn]: [2, 3] },
                parent_task_id: null,
                recurring_parent_id: null,
            },
        });

        // Get overdue tasks
        const overdueTasks = await Task.count({
            where: {
                user_id: userId,
                status: { [Op.notIn]: [2, 3] },
                due_date: { [Op.lt]: now },
                parent_task_id: null,
                recurring_parent_id: null,
            },
        });

        // Get tasks due today
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dueToday = await Task.count({
            where: {
                user_id: userId,
                status: { [Op.notIn]: [2, 3] },
                due_date: { [Op.between]: [today, tomorrow] },
                parent_task_id: null,
                recurring_parent_id: null,
            },
        });

        // Get active projects
        const activeProjects = await Project.count({
            where: {
                user_id: userId,
                state: { [Op.ne]: 'completed' },
            },
        });

        return this.formatSummaryResponse({
            completedToday,
            activeTasks,
            overdueTasks,
            dueToday,
            activeProjects,
        });
    }

    /**
     * Handle stats query
     */
    async handleStats(userId, query) {
        const period = query.period || '30d';
        const metrics = await productivityMetricsService.calculateMetrics(
            userId,
            period
        );

        // If asking about overdue specifically, include the actual overdue tasks
        const { filters } = query;
        if (filters?.timePeriod === 'overdue') {
            const overdueTasks = await Task.findAll({
                where: {
                    user_id: userId,
                    status: { [Op.notIn]: [2, 3] },
                    due_date: { [Op.lt]: new Date() },
                    completed_at: null,
                    parent_task_id: null,
                    recurring_parent_id: null,
                },
                order: [['due_date', 'ASC']],
                limit: 15,
                attributes: ['uid', 'name', 'status', 'priority', 'due_date'],
                include: [{ model: Project, attributes: ['name', 'uid'] }],
            });

            return this.formatStatsWithTasksResponse(metrics, overdueTasks, 'overdue');
        }

        return this.formatStatsResponse(metrics);
    }

    /**
     * Format stats response with tasks included
     */
    formatStatsWithTasksResponse(metrics, tasks, filterType) {
        const formatted =
            productivityMetricsService.formatMetricsForDisplay(metrics);

        let response = `**Statistics**\n${formatted.overview}\n\n`;

        // Add task list if we have tasks
        if (tasks.length > 0) {
            const titleMap = {
                overdue: 'Overdue Tasks',
                today: 'Tasks Due Today',
                this_week: 'Tasks Due This Week',
            };
            const title = titleMap[filterType] || 'Tasks';

            response += `\n**${title}** (${tasks.length})\n\n`;
            response += tasks
                .map((t) => `[TASK:${t.uid}] ${t.name}`)
                .join('\n\n');
        }

        return {
            response,
            metrics,
            tasks: tasks.map((t) => ({
                id: t.uid,
                name: t.name,
                status: t.status,
                priority: t.priority,
                due_date: t.due_date,
            })),
        };
    }

    /**
     * Handle search query
     */
    async handleSearch(userId, query) {
        const { filters } = query;
        const searchTerm = filters.search || '';

        if (!searchTerm) {
            return {
                response: 'What would you like to search for?',
                needsMoreInfo: true,
            };
        }

        // Search tasks
        const tasks = await Task.findAll({
            where: {
                user_id: userId,
                [Op.or]: [
                    { name: { [Op.like]: `%${searchTerm}%` } },
                    { description: { [Op.like]: `%${searchTerm}%` } },
                ],
            },
            limit: 10,
            attributes: ['uid', 'name', 'status', 'priority'],
        });

        // Search projects
        const projects = await Project.findAll({
            where: {
                user_id: userId,
                [Op.or]: [
                    { name: { [Op.like]: `%${searchTerm}%` } },
                    { description: { [Op.like]: `%${searchTerm}%` } },
                ],
            },
            limit: 5,
            attributes: ['uid', 'name', 'state'],
        });

        return this.formatSearchResponse(searchTerm, tasks, projects);
    }

    /**
     * Build time filter for queries
     */
    buildTimeFilter(timePeriod) {
        const now = new Date();

        switch (timePeriod) {
            case 'today':
                const today = new Date(now.setHours(0, 0, 0, 0));
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return { [Op.between]: [today, tomorrow] };

            case 'tomorrow':
                const tomorrowStart = new Date(now.setHours(0, 0, 0, 0));
                tomorrowStart.setDate(tomorrowStart.getDate() + 1);
                const tomorrowEnd = new Date(tomorrowStart);
                tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
                return { [Op.between]: [tomorrowStart, tomorrowEnd] };

            case 'this_week':
                const weekStart = new Date(now);
                const weekEnd = new Date(now);
                weekEnd.setDate(weekEnd.getDate() + 7);
                return { [Op.between]: [weekStart, weekEnd] };

            case 'overdue':
                return { [Op.lt]: now };

            default:
                return null;
        }
    }

    /**
     * Format task list response
     */
    formatTaskListResponse(tasks, filters) {
        let title = 'Your tasks';
        if (filters.priority) {
            title = `Your ${filters.priority} priority tasks`;
        }
        if (filters.timePeriod) {
            const periodMap = {
                today: 'due today',
                tomorrow: 'due tomorrow',
                this_week: 'due this week',
                overdue: 'overdue',
            };
            title = `Tasks ${periodMap[filters.timePeriod] || filters.timePeriod.replace('_', ' ')}`;
        }

        if (tasks.length === 0) {
            return {
                response: `**${title}**\n\nNo tasks found.`,
                tasks: [],
            };
        }

        const taskList = tasks
            .map((t) => `[TASK:${t.uid}] ${t.name}`)
            .join('\n\n');

        return {
            response: `**${title}** (${tasks.length})\n\n${taskList}`,
            tasks: tasks.map((t) => ({
                id: t.uid,
                name: t.name,
                status: t.status,
                priority: t.priority,
                due_date: t.due_date,
            })),
        };
    }

    /**
     * Format project list response
     */
    formatProjectListResponse(projects) {
        if (projects.length === 0) {
            return {
                response:
                    '**Your Active Projects**\n\nNo active projects found.',
                projects: [],
            };
        }

        const projectList = projects
            .map((p) => `[PROJECT:${p.uid}] ${p.name}`)
            .join('\n\n');

        return {
            response: `**Your Active Projects**\n\n${projectList}`,
            projects: projects.map((p) => ({
                id: p.uid,
                name: p.name,
                state: p.state,
            })),
        };
    }

    /**
     * Format note list response
     */
    formatNoteListResponse(notes) {
        if (notes.length === 0) {
            return {
                response: '**Your Notes**\n\nNo notes found.',
                notes: [],
            };
        }

        const noteList = notes
            .map((n) => `[NOTE:${n.uid}] ${n.title}`)
            .join('\n\n');

        return {
            response: `**Your Notes**\n\n${noteList}`,
            notes: notes.map((n) => ({
                id: n.uid,
                title: n.title,
            })),
        };
    }

    /**
     * Format productivity response
     */
    formatProductivityResponse(metrics, recommendations) {
        const formatted =
            productivityMetricsService.formatMetricsForDisplay(metrics);

        let response = `**Productivity Report**\n\n`;
        response += `${formatted.overview}\n\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Stats section
        response += `**Key Metrics**\n\n`;
        formatted.stats.forEach((stat) => {
            response += `${stat}\n\n`;
        });

        response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (formatted.insights.length > 0) {
            response += `**Insights**\n\n`;
            formatted.insights.forEach((insight) => {
                response += `${insight.message}\n\n`;
            });
            response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        }

        if (recommendations.length > 0) {
            response += `**Recommendations**\n\n`;
            recommendations.forEach((rec) => {
                response += `${rec.action}\n\n`;
                response += `${rec.details}\n\n`;
            });
        }

        return {
            response,
            metrics,
            recommendations,
        };
    }

    /**
     * Format summary response
     */
    formatSummaryResponse(stats) {
        let response = '# Daily Summary\n\n';
        response += `**Completed today:** ${stats.completedToday}\n\n`;
        response += `**Active tasks:** ${stats.activeTasks}\n\n`;

        if (stats.overdueTasks > 0) {
            response += `**Overdue:** ${stats.overdueTasks}\n\n`;
        }

        response += `**Due today:** ${stats.dueToday}\n\n`;
        response += `**Active projects:** ${stats.activeProjects}`;

        return {
            response,
            stats,
        };
    }

    /**
     * Format stats response
     */
    formatStatsResponse(metrics) {
        const formatted =
            productivityMetricsService.formatMetricsForDisplay(metrics);

        let response = `**Statistics**\n${formatted.overview}\n\n`;
        response += formatted.stats.join('\n\n');

        return {
            response,
            metrics,
        };
    }

    /**
     * Format search response
     */
    formatSearchResponse(searchTerm, tasks, projects) {
        if (tasks.length === 0 && projects.length === 0) {
            return {
                response: `**Search Results**\n\nNo results found for "${searchTerm}".`,
                tasks: [],
                projects: [],
            };
        }

        let response = `**Search Results for "${searchTerm}"**\n\n`;

        if (tasks.length > 0) {
            response += '**Tasks:**\n\n';
            response += tasks
                .map((t) => `[TASK:${t.uid}] ${t.name}`)
                .join('\n\n');
            response += '\n\n';
        }

        if (projects.length > 0) {
            response += '**Projects:**\n\n';
            response += projects
                .map((p) => `[PROJECT:${p.uid}] ${p.name}`)
                .join('\n\n');
        }

        return {
            response,
            tasks,
            projects,
        };
    }
}

module.exports = new QueryHandlerService();
