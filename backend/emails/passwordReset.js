'use strict';

// Sent when someone asks for a password reset from the sign-in page.
module.exports = ({ t }, { url, expiryMinutes }) => ({
    subject: t('passwordReset.subject'),
    blocks: [
        { p: t('passwordReset.intro') },
        { p: t('passwordReset.action') },
        { button: t('passwordReset.button'), url },
        { p: t('common.copyLink') },
        { link: url },
        {
            p: t('passwordReset.expires', { count: expiryMinutes }),
            strong: true,
        },
    ],
});
