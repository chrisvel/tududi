'use strict';

// Sent right after a password sign-up, and once more (`reminder`) to a
// sign-up that has not verified 1 to 7 days later. On Cloud it also says
// what the trial gives, since the trial starts on this link.
module.exports = ({ t }, { url, expiryHours, trialDays = 0, reminder }) => {
    const scope = reminder ? 'verificationReminder' : 'verification';
    const trial =
        trialDays > 0
            ? [{ p: t('verification.trial', { count: trialDays }) }]
            : [];
    return {
        subject: t(`${scope}.subject`),
        blocks: [
            { p: reminder ? t('common.greeting') : t('verification.welcome') },
            { p: t(`${scope}.opening`) },
            { button: t('verification.button'), url },
            { p: t('common.copyLink') },
            { link: url },
            {
                p: t('verification.expires', { count: expiryHours }),
                strong: true,
            },
            ...trial,
            { p: t('verification.benefitsIntro') },
            { list: t('verification.benefits') },
            { p: t('verification.ignore') },
        ],
    };
};
