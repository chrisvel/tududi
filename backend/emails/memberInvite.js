'use strict';

// Sent to a member an owner or admin added without a password, with the
// link that sets one.
module.exports = ({ t }, { url, expiryHours }) => ({
    subject: t('memberInvite.subject'),
    blocks: [
        { p: t('memberInvite.intro') },
        { p: t('memberInvite.action') },
        { button: t('memberInvite.button'), url },
        { p: t('common.copyLink') },
        { link: url },
        {
            p: t('memberInvite.expires', { count: expiryHours }),
            strong: true,
        },
    ],
});
