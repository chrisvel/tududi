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

        // Apply filters
        if (filters.priority) {
            where.priority = filters.priority;
        }

        if (filters.timePeriod) {
            const timeFilter = this.buildTimeFilter(filters.timePeriod);
            if (timeFilter) {
                where.due_date = timeFilter;
            }
        } else {
            // Default to active tasks
            where.status = { [Op.ne]: 'completed' };
        }

        const tasks = await Task.findAll({
            where,
            order: [
                ['due_date', 'ASC'],
                ['priority', 'DESC'],
            ],
            limit: 20,
            attributes: ['uid', 'name', 'status', 'priority', 'due_date'],
        });

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
     * Handle productivity metrics query
     */
    async handleProductivity(userId, query) {
        const period = query.period || '30d';
        const metrics = await productivityMetricsService.calculateMetrics(
            userId,
            period
        );

        const recommendations =
            await productivityMetricsService.getRecommendations(userId, metrics);

        return this.formatProductivityResponse(metrics, recommendations);
    }

    /**
     * Handle summary query
     */
    async handleSummary(userId, query) {
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));

        // Get tasks completed today
        const completedToday = await Task.count({
            where: {
                user_id: userId,
                status: 'completed',
                completed_at: { [Op.gte]: today },
            },
        });

        // Get active tasks
        const activeTasks = await Task.count({
            where: {
                user_id: userId,
                status: { [Op.ne]: 'completed' },
            },
        });

        // Get overdue tasks
        const overdueTasks = await Task.count({
            where: {
                user_id: userId,
                status: { [Op.ne]: 'completed' },
                due_date: { [Op.lt]: now },
            },
        });

        // Get tasks due today
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const dueToday = await Task.count({
            where: {
                user_id: userId,
                status: { [Op.ne]: 'completed' },
                due_date: { [Op.between]: [today, tomorrow] },
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

        return this.formatStatsResponse(metrics);
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
            title = `Tasks ${filters.timePeriod.replace('_', ' ')}`;
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
            response: `**${title}**\n\n${taskList}`,
            tasks: tasks.map((t) => ({
                id: t.uid,
                name: t.name,
                status: t.status,
                priority: t.priority,
            })),
        };
    }

    /**
     * Format project list response
     */
    formatProjectListResponse(projects) {
        if (projects.length === 0) {
            return {
                response: '**Your Active Projects**\n\nNo active projects found.',
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
     * Format productivity response
     */
    formatProductivityResponse(metrics, recommendations) {
        const formatted =
            productivityMetricsService.formatMetricsForDisplay(metrics);

        let response = `**Productivity Report**\n${formatted.overview}\n\n`;
        response += formatted.stats.join('\n\n') + '\n\n';

        if (formatted.insights.length > 0) {
            response += '**Insights:**\n\n';
            formatted.insights.forEach((insight) => {
                const emoji =
                    insight.type === 'positive'
                        ? '🎉'
                        : insight.type === 'warning'
                          ? '⚠️'
                          : 'ℹ️';
                response += `${emoji} ${insight.message}\n\n`;
            });
        }

        if (recommendations.length > 0) {
            response += '**Recommendations:**\n\n';
            recommendations.forEach((rec) => {
                const emoji = rec.priority === 'high' ? '🔴' : '🟡';
                response += `${emoji} **${rec.action}**: ${rec.details}\n\n`;
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
        let response = '**Daily Summary**\n\n';
        response += `✅ Completed today: ${stats.completedToday}\n\n`;
        response += `📋 Active tasks: ${stats.activeTasks}\n\n`;

        if (stats.overdueTasks > 0) {
            response += `⚠️ Overdue: ${stats.overdueTasks}\n\n`;
        }

        response += `📅 Due today: ${stats.dueToday}\n\n`;
        response += `📁 Active projects: ${stats.activeProjects}`;

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
            response += tasks.map((t) => `[TASK:${t.uid}] ${t.name}`).join('\n\n');
            response += '\n\n';
        }

        if (projects.length > 0) {
            response += '**Projects:**\n\n';
            response +=
                projects.map((p) => `[PROJECT:${p.uid}] ${p.name}`).join('\n\n');
        }

        return {
            response,
            tasks,
            projects,
        };
    }
}

module.exports = new QueryHandlerService();
