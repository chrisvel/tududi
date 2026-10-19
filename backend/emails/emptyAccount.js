'use strict';

// Sent once by the daily account lifecycle job to a Cloud account owner who
// verified a couple of days ago and has not created anything yet. `trialEndsOn`
// is set while their own trial runs.
module.exports = ({ t, formatDate }, { url, trialEndsOn = null }) => ({
    subject: t('emptyAccount.subject'),
    blocks: [
        { p: t('common.greeting') },
        { p: t('emptyAccount.intro') },
        { list: t('emptyAccount.ideas') },
        { button: t('emptyAccount.button'), url },
        ...(trialEndsOn
            ? [{ p: t('common.trialUntil', { date: formatDate(trialEndsOn) }) }]
            : []),
        { p: t('emptyAccount.outro') },
    ],
});
