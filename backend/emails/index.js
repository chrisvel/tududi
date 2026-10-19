'use strict';

const { createTranslator, normalizeLanguage, LANGUAGES } = require('./i18n');
const { render } = require('./layout');

// Every email tududi sends, by name. Each module returns { subject, blocks }
// (rendered to text and HTML by layout.js) or a finished { subject, text }.
// See README.md for when each one goes out.
const EMAILS = {
    verification: require('./verification'),
    passwordReset: require('./passwordReset'),
    memberInvite: require('./memberInvite'),
    trialReminder: require('./trialReminder'),
    deletionWarning: require('./deletionWarning'),
    emptyAccount: require('./emptyAccount'),
    comeBack: require('./comeBack'),
    notification: require('./notification'),
    contactMessage: require('./contactMessage'),
};

// Builds the email `name` in `language` (a users.language code; anything
// unknown is English). Returns { subject, text, html? } for sendEmail.
function renderEmail(name, { language, ...vars } = {}) {
    const build = EMAILS[name];
    if (!build) throw new Error(`Unknown email: ${name}`);
    const i18n = createTranslator(language);
    const built = build(i18n, vars);
    if (!built.blocks) return built;
    return render({
        subject: built.subject,
        blocks: built.blocks,
        signoff: i18n.t('common.signoff'),
        dir: i18n.dir,
    });
}

module.exports = {
    EMAILS,
    LANGUAGES,
    renderEmail,
    normalizeLanguage,
};
