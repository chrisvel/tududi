/**
 * iCal Calendar Feed Route (Public - Token-based auth)
 *
 * Provides an iCalendar (.ics) feed of tasks with due dates.
 * This allows users to subscribe to their tududi calendar in
 * external calendar apps like Apple Calendar, Google Calendar, etc.
 *
 * Authentication: Dedicated ical_feed_token passed as query parameter (?token=...)
 * This is standard for calendar subscription URLs since calendar
 * apps cannot send Bearer tokens in headers.
 */

const express = require('express');
const router = express.Router();
const { Task, Project, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Escape special characters in iCalendar text fields
 * Per RFC 5545: backslash, semicolon, and comma must be escaped
 * Newlines become literal \n (the two characters, not a newline)
 */
function escapeICalText(text) {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n/g, '\\n')
        .replace(/\r/g, '\\n')
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
    return d
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
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
                    const days = weekdays
                        .map((d) => dayMap[parseInt(d)])
                        .filter(Boolean);
                    if (days.length > 0) {
                        parts.push(`BYDAY=${days.join(',')}`);
                    }
                }
            } else if (
                task.recurrence_weekday !== null &&
                task.recurrence_weekday !== undefined
            ) {
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
            } else if (
                task.recurrence_week_of_month &&
                task.recurrence_weekday !== null
            ) {
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

    // Build description: Project first, then description, then note
    // Only include fields that have content
    const descParts = [];

    // Project name first (if available)
    if (task.Project && task.Project.name) {
        descParts.push(`Project: ${task.Project.name}`);
    }

    // Task description (the main text field in tududi UI)
    if (task.description && task.description.trim()) {
        descParts.push(task.description.trim());
    }

    // Note field (if it exists and has content)
    if (task.note && task.note.trim()) {
        descParts.push(task.note.trim());
    }

    if (descParts.length > 0) {
        // Join with double newline for visual separation
        const descriptionText = descParts.join('\n\n');
        lines.push(`DESCRIPTION:${escapeICalText(descriptionText)}`);
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
 * This route uses token-based auth (not session) for calendar app compatibility.
 *
 * Query Parameters:
 *   - token (required): iCal feed token for authentication
 *   - completed: Include completed tasks (default: false)
 *   - project: Filter by project ID
 *
 * Example URL for Apple Calendar subscription:
 *   https://your-tududi.com/api/calendar/feed.ics?token=ical_xxxxx
 */
router.get('/calendar/feed.ics', async (req, res) => {
    try {
        const { token, completed, project } = req.query;

        // Validate token
        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                message:
                    'Please provide a calendar feed token using the ?token= parameter',
            });
        }

        // Find user by ical_feed_token
        const user = await User.findOne({
            where: {
                ical_feed_token: token,
                ical_feed_enabled: true,
            },
        });

        if (!user) {
            return res.status(401).json({
                error: 'Invalid or disabled calendar feed token',
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

module.exports = router;
