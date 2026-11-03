'use strict';

const repository = require('./repository');
const { Role, User } = require('../../models');
const { isAdmin } = require('../../services/rolesService');
const emailService = require('../../services/emailService');
const { logError } = require('../../services/logService');
const { getConfig } = require('../../config/config');
const { renderEmail } = require('../../emails');
const {
    ForbiddenError,
    NotFoundError,
    ValidationError,
} = require('../../shared/errors');

const MAX_MESSAGE_LENGTH = 5000;

const clip = (value, max) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : null;
};

// Only an in-app path is kept: the admin page renders it as a link, so a
// javascript: or off-site URL must never get stored.
const appPath = (value) => {
    const path = clip(value, 512);
    return path && /^\/(?![/\\])/.test(path) ? path : null;
};

const parseId = (id) => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
        throw new ValidationError('Invalid id');
    }
    return numericId;
};

const serialize = (row) => ({
    id: row.id,
    message: row.message,
    page_url: row.page_url,
    user_agent: row.user_agent,
    app_version: row.app_version,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    user: row.User
        ? {
              uid: row.User.uid,
              email: row.User.email,
              name: [row.User.name, row.User.surname].filter(Boolean).join(' '),
          }
        : null,
});

// Emails every admin of the instance about new feedback, with Reply-To set to
// the sender so an answer goes straight back. Never fails the submit.
async function notifyAdmins(userId, row) {
    try {
        const [sender, adminRoles] = await Promise.all([
            User.findByPk(userId, {
                attributes: ['email', 'name', 'surname'],
            }),
            Role.findAll({
                where: { is_admin: true },
                attributes: ['user_id'],
            }),
        ]);
        const admins = await User.findAll({
            where: { id: adminRoles.map((role) => role.user_id) },
            attributes: ['email'],
        });
        const recipients = admins.map((a) => a.email).filter(Boolean);
        if (!sender || recipients.length === 0) return;

        // The name goes into a header, so no line breaks or quotes survive.
        const name = [sender.name, sender.surname]
            .filter(Boolean)
            .join(' ')
            .replace(/[\r\n"]+/g, ' ')
            .trim();
        const email = renderEmail('feedbackReceived', {
            name,
            email: sender.email,
            pageUrl: row.page_url,
            appVersion: row.app_version,
            message: row.message,
            url: `${getConfig().frontendUrl}/admin/feedback`,
        });
        const result = await emailService.sendEmail({
            to: recipients.join(', '),
            replyTo: name ? `"${name}" <${sender.email}>` : sender.email,
            ...email,
        });
        if (!result.success && result.reason !== 'Email service is disabled') {
            logError(
                new Error(result.reason || 'send failed'),
                'Feedback email to admins was not sent'
            );
        }
    } catch (error) {
        logError(error, 'Feedback email to admins was not sent');
    }
}

class FeedbackService {
    async assertAdmin(requesterId) {
        if (!(await isAdmin(requesterId))) {
            throw new ForbiddenError('Forbidden');
        }
    }

    async submit(userId, body = {}, userAgent) {
        const message =
            typeof body.message === 'string' ? body.message.trim() : '';
        if (!message) {
            throw new ValidationError('Feedback message is required');
        }
        if (message.length > MAX_MESSAGE_LENGTH) {
            throw new ValidationError(
                `Feedback must be ${MAX_MESSAGE_LENGTH} characters or fewer`
            );
        }

        const row = await repository.create({
            user_id: userId,
            message,
            page_url: appPath(body.page_url),
            user_agent: clip(userAgent, 512),
            app_version: clip(body.app_version, 32),
        });
        await notifyAdmins(userId, row);
        return { id: row.id };
    }

    async list(requesterId, query = {}) {
        await this.assertAdmin(requesterId);
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
        const offset = Math.max(Number(query.offset) || 0, 0);
        const resolved =
            query.status === 'open'
                ? false
                : query.status === 'resolved'
                  ? true
                  : undefined;

        const [{ rows, count }, open] = await Promise.all([
            repository.list({ limit, offset, resolved }),
            repository.countOpen(),
        ]);
        return { total: count, open, feedback: rows.map(serialize) };
    }

    async setResolved(requesterId, id, body = {}) {
        await this.assertAdmin(requesterId);
        const row = await repository.findById(parseId(id));
        if (!row) throw new NotFoundError('Feedback not found');
        if (typeof body.resolved !== 'boolean') {
            throw new ValidationError('resolved must be true or false');
        }
        await row.update({ resolved_at: body.resolved ? new Date() : null });
        return { id: row.id, resolved_at: row.resolved_at };
    }

    async remove(requesterId, id) {
        await this.assertAdmin(requesterId);
        const removed = await repository.destroyById(parseId(id));
        if (!removed) throw new NotFoundError('Feedback not found');
    }
}

module.exports = new FeedbackService();
