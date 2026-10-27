'use strict';

// Sent when someone's two-factor sign-in changes: turned on or off, reset by
// an admin, a recovery code used, or new recovery codes made. `event` names
// which; `url` opens the security settings.
module.exports = ({ t }, { event, url }) => ({
    subject: t(`securityNotice.${event}.subject`),
    blocks: [
        { p: t(`securityNotice.${event}.body`) },
        { button: t('securityNotice.button'), url },
        { p: t('securityNotice.notYou'), strong: true },
    ],
});
