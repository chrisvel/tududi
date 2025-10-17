const { Task } = require('../models');
const { Op } = require('sequelize');
const { logError } = require('./logService');

class ProductivityMetricsService {
    /**
     * Calculate productivity metrics for a user over a given period
     */
    async calculateMetrics(userId, period = '30d') {
        try {
            const days = parseInt(period.replace('d', ''));
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const now = new Date();

            // Get all tasks in the period
            const tasksInPeriod = await Task.findAll({
                where: {
                    user_id: userId,
                    created_at: {
                        [Op.gte]: startDate,
                    },
                },
            });

            // Get completed tasks
            const completedTasks = tasksInPeriod.filter(
                (t) => t.status === 'completed' && t.completed_at
            );

            // Get overdue tasks
            const overdueTasks = await Task.findAll({
                where: {
                    user_id: userId,
                    status: { [Op.ne]: 'completed' },
                    due_date: { [Op.lt]: now },
                },
            });

            // Calculate metrics
            const metrics = {
                completion_rate: this.calculateCompletionRate(
                    tasksInPeriod,
                    completedTasks
                ),
                overdue_rate: await this.calculateOverdueRate(
                    userId,
                    overdueTasks
                ),
                task_age: await this.calculateAverageTaskAge(
                    userId,
                    tasksInPeriod
                ),
                created_done_ratio: this.calculateCreatedDoneRatio(
                    tasksInPeriod,
                    completedTasks
                ),
                total_tasks: tasksInPeriod.length,
                completed_tasks: completedTasks.length,
                overdue_tasks: overdueTasks.length,
                period_days: days,
            };

            // Add insights
            metrics.insights = this.generateInsights(metrics);

            return metrics;
        } catch (error) {
            logError('Error calculating productivity metrics:', error);
            throw error;
        }
    }

    /**
     * Calculate completion rate (percentage of completed tasks)
     */
    calculateCompletionRate(allTasks, completedTasks) {
        if (allTasks.length === 0) return 0;
        return Math.round((completedTasks.length / allTasks.length) * 100);
    }

    /**
     * Calculate overdue rate (percentage of active tasks that are overdue)
     */
    async calculateOverdueRate(userId, overdueTasks) {
        const activeTasks = await Task.count({
            where: {
                user_id: userId,
                status: { [Op.ne]: 'completed' },
            },
        });

        if (activeTasks === 0) return 0;
        return Math.round((overdueTasks.length / activeTasks) * 100);
    }

    /**
     * Calculate average age of active tasks (in days)
     */
    async calculateAverageTaskAge(userId, tasksInPeriod) {
        const activeTasks = tasksInPeriod.filter((t) => t.status !== 'completed');

        if (activeTasks.length === 0) return 0;

        const now = new Date();
        const totalAge = activeTasks.reduce((sum, task) => {
            const createdDate = new Date(task.created_at);
            const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
            return sum + ageInDays;
        }, 0);

        return Math.round(totalAge / activeTasks.length);
    }

    /**
     * Calculate ratio of tasks created vs completed
     */
    calculateCreatedDoneRatio(allTasks, completedTasks) {
        if (completedTasks.length === 0) return 0;
        return (allTasks.length / completedTasks.length).toFixed(2);
    }

    /**
     * Generate insights based on metrics
     */
    generateInsights(metrics) {
        const insights = [];

        // Completion rate insights
        if (metrics.completion_rate >= 80) {
            insights.push({
                type: 'positive',
                metric: 'completion_rate',
                message: `Excellent! You're completing ${metrics.completion_rate}% of your tasks.`,
            });
        } else if (metrics.completion_rate >= 50) {
            insights.push({
                type: 'neutral',
                metric: 'completion_rate',
                message: `You're completing ${metrics.completion_rate}% of your tasks. Consider breaking down larger tasks.`,
            });
        } else {
            insights.push({
                type: 'warning',
                metric: 'completion_rate',
                message: `Only ${metrics.completion_rate}% of tasks completed. Focus on finishing what you start.`,
            });
        }

        // Overdue rate insights
        if (metrics.overdue_rate === 0) {
            insights.push({
                type: 'positive',
                metric: 'overdue_rate',
                message: 'Great! No overdue tasks.',
            });
        } else if (metrics.overdue_rate < 20) {
            insights.push({
                type: 'neutral',
                metric: 'overdue_rate',
                message: `${metrics.overdue_rate}% of tasks are overdue. Try to prioritize them.`,
            });
        } else {
            insights.push({
                type: 'warning',
                metric: 'overdue_rate',
                message: `${metrics.overdue_rate}% of tasks are overdue. Consider rescheduling or delegating.`,
            });
        }

        // Task age insights
        if (metrics.task_age < 7) {
            insights.push({
                type: 'positive',
                metric: 'task_age',
                message: `Tasks are averaging ${metrics.task_age} days old. You're staying on top of things!`,
            });
        } else if (metrics.task_age < 14) {
            insights.push({
                type: 'neutral',
                metric: 'task_age',
                message: `Tasks are averaging ${metrics.task_age} days old. Consider tackling older tasks.`,
            });
        } else {
            insights.push({
                type: 'warning',
                metric: 'task_age',
                message: `Tasks are averaging ${metrics.task_age} days old. Old tasks may need review or archiving.`,
            });
        }

        // Created/done ratio insights
        const ratio = parseFloat(metrics.created_done_ratio);
        if (ratio <= 1.2) {
            insights.push({
                type: 'positive',
                metric: 'created_done_ratio',
                message: `You're completing tasks almost as fast as you create them (${ratio}:1 ratio).`,
            });
        } else if (ratio <= 2) {
            insights.push({
                type: 'neutral',
                metric: 'created_done_ratio',
                message: `You're creating ${ratio}x more tasks than completing. Consider being more selective.`,
            });
        } else {
            insights.push({
                type: 'warning',
                metric: 'created_done_ratio',
                message: `You're creating ${ratio}x more tasks than completing. Stop adding new tasks and focus on existing ones.`,
            });
        }

        return insights;
    }

    /**
     * Get recommendations to improve productivity
     */
    async getRecommendations(userId, metrics) {
        const recommendations = [];

        // Based on overdue rate
        if (metrics.overdue_rate > 20) {
            recommendations.push({
                priority: 'high',
                action: 'Address overdue tasks',
                details: `You have ${metrics.overdue_tasks} overdue tasks. Review and reschedule them.`,
            });
        }

        // Based on task age
        if (metrics.task_age > 14) {
            recommendations.push({
                priority: 'medium',
                action: 'Review old tasks',
                details:
                    'Some tasks are very old. Consider archiving or re-evaluating their priority.',
            });
        }

        // Based on completion rate
        if (metrics.completion_rate < 50) {
            recommendations.push({
                priority: 'high',
                action: 'Break down large tasks',
                details:
                    'Low completion rate suggests tasks might be too large. Break them into smaller, actionable steps.',
            });
        }

        // Based on created/done ratio
        const ratio = parseFloat(metrics.created_done_ratio);
        if (ratio > 2) {
            recommendations.push({
                priority: 'high',
                action: 'Stop creating new tasks',
                details: `You're creating tasks faster than completing them. Focus on your existing ${metrics.total_tasks} tasks first.`,
            });
        }

        return recommendations;
    }

    /**
     * Format metrics for display
     */
    formatMetricsForDisplay(metrics) {
        return {
            overview: `Over the last ${metrics.period_days} days:`,
            stats: [
                `✅ Completed: ${metrics.completed_tasks}/${metrics.total_tasks} tasks (${metrics.completion_rate}%)`,
                `⏰ Overdue: ${metrics.overdue_tasks} tasks (${metrics.overdue_rate}%)`,
                `📅 Average task age: ${metrics.task_age} days`,
                `➕ Created vs Done ratio: ${metrics.created_done_ratio}:1`,
            ],
            insights: metrics.insights,
        };
    }
}

module.exports = new ProductivityMetricsService();
