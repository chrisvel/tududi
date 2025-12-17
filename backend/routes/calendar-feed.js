/**
 * iCal Calendar Feed Route
 *
 * Provides an iCalendar (.ics) feed of tasks with due dates.
 * This allows users to subscribe to their tududi calendar in
 * external calendar apps like Apple Calendar, Google Calendar, etc.
 *
 * Authentication: API token passed as query parameter (?token=...)
 * This is standard for calendar subscription URLs since calendar
 * apps cannot send Bearer tokens in headers.
 */

const express = require('express');
const router = express.Router();
const { Task, Project } = require('../models');
const { findValidTokenByValue } = require('../services/apiTokenService');
const { User } = require('../models');
const { Op } = require('sequelize');

/**
 * Escape special characters in iCalendar text fields
 * Per RFC 5545: backslash, semicolon, and comma must be escaped
 * Newlines become literal \n
 */
function escapeICalText(text) {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/**
 * Format a date as iCalendar DATE (YYYYMMDD) for all-day events
 */
function formatICalDate(date) {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Format a date as iCalendar DATETIME (YYYYMMDDTHHMMSSZ)
 */
function formatICalDateTime(date) {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Convert tududi recurrence settings to iCalendar RRULE
 * Returns null if task is not recurring
 */
function buildRRule(task) {
    if (!task.recurrence_type || task.recurrence_type === 'none') {
        return null;
    }

    const parts = [];
    const interval = task.recurrence_interval || 1;

    switch (task.recurrence_type) {
        case 'daily':
            parts.push('FREQ=DAILY');
            if (interval > 1) parts.push(`INTERVAL=${interval}`);
            break;

        case 'weekly':
            parts.push('FREQ=WEEKLY');
            if (interval > 1) parts.push(`INTERVAL=${interval}`);
            // Handle specific weekdays if set
            if (task.recurrence_weekdays) {
                // recurrence_weekdays might be stored as JSON array or comma-separated
                let weekdays = task.recurrence_weekdays;
                if (typeof weekdays === 'string') {
                    try {
                        weekdays = JSON.parse(weekdays);
                    } catch {
                        weekdays = weekdays.split(',');
                    }
                }
                if (Array.isArray(weekdays) && weekdays.length > 0) {
                    // Map day numbers (0=Sunday) to iCal day codes
                    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                    const days = weekdays.map((d) => dayMap[parseInt(d)]).filter(Boolean);
                    if (days.length > 0) {
                        parts.push(`BYDAY=${days.join(',')}`);
                    }
                }
            } else if (task.recurrence_weekday !== null && task.recurrence_weekday !== undefined) {
                const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                const day = dayMap[parseInt(task.recurrence_weekday)];
                if (day) {
                    parts.push(`BYDAY=${day}`);
                }
            }
            break;

        case 'monthly':
            parts.push('FREQ=MONTHLY');
            if (interval > 1) parts.push(`INTERVAL=${interval}`);
            // Handle specific day of month or week of month
            if (task.recurrence_month_day) {
                parts.push(`BYMONTHDAY=${task.recurrence_month_day}`);
            } else if (task.recurrence_week_of_month && task.recurrence_weekday !== null) {
                const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                const day = dayMap[parseInt(task.recurrence_weekday)];
                if (day) {
                    parts.push(`BYDAY=${task.recurrence_week_of_month}${day}`);
                }
            }
            break;

        case 'yearly':
            parts.push('FREQ=YEARLY');
            if (interval > 1) parts.push(`INTERVAL=${interval}`);
            break;

        default:
            return null;
    }

    // Add end date if specified
    if (task.recurrence_end_date) {
        parts.push(`UNTIL=${formatICalDate(task.recurrence_end_date)}`);
    }

    return parts.length > 0 ? parts.join(';') : null;
}

/**
 * Map tududi task status to a display string
 */
function getStatusText(status) {
    switch (status) {
        case 0:
        case 'not_started':
            return 'Not Started';
        case 1:
        case 'in_progress':
            return 'In Progress';
        case 2:
        case 'done':
            return 'Completed';
        default:
            return '';
    }
}

/**
 * Generate a single VEVENT component for a task
 */
function generateVEvent(task, hostname) {
    const lines = [];

    lines.push('BEGIN:VEVENT');

    // UID must be globally unique and persistent
    lines.push(`UID:task-${task.id}@${hostname}`);

    // Use due_date as the event date (all-day event)
    // Tasks typically don't have specific times, so we use VALUE=DATE
    const dueDate = formatICalDate(task.due_date);
    lines.push(`DTSTART;VALUE=DATE:${dueDate}`);
    lines.push(`DTEND;VALUE=DATE:${dueDate}`);

    // Created and modified timestamps
    if (task.created_at) {
        lines.push(`CREATED:${formatICalDateTime(task.created_at)}`);
    }
    if (task.updated_at) {
        lines.push(`DTSTAMP:${formatICalDateTime(task.updated_at)}`);
        lines.push(`LAST-MODIFIED:${formatICalDateTime(task.updated_at)}`);
    } else {
        lines.push(`DTSTAMP:${formatICalDateTime(new Date())}`);
    }

    // Task name as summary
    lines.push(`SUMMARY:${escapeICalText(task.name)}`);

    // Build description with task details
    const descParts = [];
    if (task.description) {
        descParts.push(task.description);
    }

    // Add project name if available
    if (task.Project && task.Project.name) {
        descParts.push(`Project: ${task.Project.name}`);
    }

    // Add status
    const statusText = getStatusText(task.status);
    if (statusText) {
        descParts.push(`Status: ${statusText}`);
    }

    // Add priority if set
    if (task.priority !== null && task.priority !== undefined) {
        const priorityMap = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High' };
        const priorityText = priorityMap[task.priority] || '';
        if (priorityText) {
            descParts.push(`Priority: ${priorityText}`);
        }
    }

    if (descParts.length > 0) {
        lines.push(`DESCRIPTION:${escapeICalText(descParts.join('\\n'))}`);
    }

    // Add categories based on tags
    if (task.Tags && task.Tags.length > 0) {
        const tagNames = task.Tags.map((t) => t.name).join(',');
        lines.push(`CATEGORIES:${escapeICalText(tagNames)}`);
    }

    // Map task status to VTODO-like status for visual indication
    // Note: VEVENT doesn't have STATUS=COMPLETED, but we can use TRANSP
    if (task.status === 2 || task.status === 'done') {
        lines.push('STATUS:CANCELLED'); // Shows as struck through in some calendars
        lines.push('TRANSP:TRANSPARENT');
    } else {
        lines.push('STATUS:CONFIRMED');
        lines.push('TRANSP:OPAQUE');
    }

    // Add recurrence rule if task is recurring
    const rrule = buildRRule(task);
    if (rrule) {
        lines.push(`RRULE:${rrule}`);
    }

    lines.push('END:VEVENT');

    return lines.join('\r\n');
}

/**
 * Generate the complete iCalendar document
 */
function generateICalendar(tasks, calendarName, hostname) {
    const lines = [];

    // Calendar header
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//tududi//Task Calendar//EN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');
    lines.push(`X-WR-CALNAME:${escapeICalText(calendarName)}`);
    lines.push('X-WR-TIMEZONE:UTC');

    // Generate events for each task
    for (const task of tasks) {
        lines.push(generateVEvent(task, hostname));
    }

    lines.push('END:VCALENDAR');

    // iCalendar requires CRLF line endings
    return lines.join('\r\n');
}

/**
 * GET /api/calendar/feed.ics
 *
 * Returns an iCalendar feed of all tasks with due dates.
 *
 * Query Parameters:
 *   - token (required): API token for authentication
 *   - completed: Include completed tasks (default: false)
 *   - project: Filter by project ID
 *
 * Example URL for Apple Calendar subscription:
 *   https://your-tududi.com/api/calendar/feed.ics?token=tt_xxxxx
 */
router.get('/calendar/feed.ics', async (req, res) => {
    try {
        const { token, completed, project } = req.query;

        // Validate token
        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please provide an API token using the ?token= parameter',
            });
        }

        const apiToken = await findValidTokenByValue(token);
        if (!apiToken) {
            return res.status(401).json({
                error: 'Invalid or expired API token',
            });
        }

        const user = await User.findByPk(apiToken.user_id);
        if (!user) {
            return res.status(401).json({
                error: 'User not found',
            });
        }

        // Build query conditions
        const whereConditions = {
            user_id: user.id,
            due_date: {
                [Op.not]: null,
            },
        };

        // Filter out completed tasks by default
        if (completed !== 'true' && completed !== '1') {
            whereConditions.status = {
                [Op.ne]: 2, // Exclude done/completed tasks
            };
        }

        // Filter by project if specified
        if (project) {
            const projectId = parseInt(project, 10);
            if (!isNaN(projectId)) {
                whereConditions.project_id = projectId;
            }
        }

        // Exclude recurring child tasks (they're virtual instances)
        // We only want parent recurring tasks which will have RRULE
        whereConditions.recurring_parent_id = null;

        // Fetch tasks with associations
        const tasks = await Task.findAll({
            where: whereConditions,
            include: [
                {
                    model: Project,
                    as: 'Project',
                    attributes: ['id', 'name'],
                },
                {
                    association: 'Tags',
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                },
            ],
            order: [['due_date', 'ASC']],
        });

        // Generate calendar name based on user
        const calendarName = `tududi Tasks - ${user.name || user.email}`;

        // Get hostname for UID generation
        const hostname = req.get('host') || 'tududi.local';

        // Generate iCalendar content
        const icalContent = generateICalendar(tasks, calendarName, hostname);

        // Set appropriate headers for calendar subscription
        res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'inline; filename="tududi-tasks.ics"',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });

        res.send(icalContent);
    } catch (error) {
        console.error('Error generating iCal feed:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to generate calendar feed',
        });
    }
});

/**
 * GET /api/calendar/feed-url
 *
 * Returns the subscription URL for the authenticated user.
 * Requires standard Bearer token authentication.
 * This endpoint helps users get their personalized feed URL.
 */
router.get('/calendar/feed-url', async (req, res) => {
    try {
        // This endpoint requires the user to be authenticated via session or Bearer token
        // The requireAuth middleware should be applied before this route
        if (!req.currentUser) {
            return res.status(401).json({
                error: 'Authentication required',
            });
        }

        // User needs to have an API token to use the feed
        // We don't generate one automatically - they should create one in settings
        const { ApiToken } = require('../models');
        const tokens = await ApiToken.findAll({
            where: {
                user_id: req.currentUser.id,
                revoked_at: null,
            },
            order: [['created_at', 'DESC']],
        });

        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        if (tokens.length === 0) {
            return res.json({
                hasToken: false,
                message: 'You need to create an API token first to use the calendar feed.',
                instructions: 'Go to Settings > API Tokens to create a new token.',
                baseUrl: `${baseUrl}/api/calendar/feed.ics`,
            });
        }

        // Return the feed URL with their most recent valid token prefix
        // We don't return the full token for security - they need to know it
        res.json({
            hasToken: true,
            message: 'Add this URL to your calendar app as a subscription.',
            feedUrl: `${baseUrl}/api/calendar/feed.ics?token=YOUR_API_TOKEN`,
            tokenHint: `Your most recent token starts with: ${tokens[0].token_prefix}...`,
            parameters: {
                token: 'Your API token (required)',
                completed: 'Set to "true" to include completed tasks',
                project: 'Filter by project ID',
            },
        });
    } catch (error) {
        console.error('Error getting feed URL:', error);
        res.status(500).json({
            error: 'Internal server error',
        });
    }
});

module.exports = router;
