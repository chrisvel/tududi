'use strict';

const { renderEmail, normalizeLanguage } = require('../emails');
const { logError } = require('./logService');

// Sends one of the emails in backend/emails to a user and records it in
// email_deliveries, sent or failed, so the admin can see what each user got.
// `variant` tells apart versions of one email (the days left in a trial
// reminder); `triggeredBy` is the admin who sent it by hand. Returns
// sendEmail's result. A failure to record never stops the email.
async function deliver(
    name,
    { user, vars = {}, variant = null, triggeredBy = null }
) {
    const { sendEmail } = require('./emailService');
    const language = normalizeLanguage(user.language);
    const email = renderEmail(name, { language, ...vars });
    const result = await sendEmail({ to: user.email, ...email });

    try {
        await require('../models').EmailDelivery.create({
            user_id: user.id,
            email: name,
            variant,
            recipient: user.email,
            subject: email.subject.slice(0, 500),
            language,
            status: result.success ? 'sent' : 'failed',
            error: result.success ? null : String(result.reason || 'not sent'),
            triggered_by_user_id: triggeredBy,
        });
    } catch (error) {
        logError(
            error,
            `Could not record the ${name} email to user ${user.id}`
        );
    }
    return result;
}

async function listForUser(userId) {
    return require('../models').EmailDelivery.findAll({
        where: { user_id: userId },
        order: [
            ['created_at', 'DESC'],
            ['id', 'DESC'],
        ],
        raw: true,
    });
}

module.exports = { deliver, listForUser };
