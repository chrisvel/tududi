'use strict';

// Sent by the daily account lifecycle job to a Cloud account owner who made
// something and then stopped coming back. Once per quiet spell: it goes out
// again only after they have been active since the last one. `trialEndsOn`
// is set while their own trial runs.
module.exports = ({ t, formatDate }, { url, trialEndsOn = null }) => ({
    subject: t('comeBack.subject'),
    blocks: [
        { p: t('common.greeting') },
        { p: t('comeBack.intro') },
        { p: t('comeBack.tip') },
        { button: t('comeBack.button'), url },
        ...(trialEndsOn
            ? [{ p: t('common.trialUntil', { date: formatDate(trialEndsOn) }) }]
            : []),
        { p: t('comeBack.outro') },
    ],
});
