'use strict';

// Sent by the daily account lifecycle job when a never-paid Cloud trial has
// 3 days left, and again on its last day. `readOnlyDays` is set where access
// is sold (the account turns read-only, then is deleted) and null where an
// ended trial becomes a free account.
module.exports = (
    { t, formatDate },
    { daysLeft, endsOn, readOnlyDays, subscribeUrl }
) => {
    const date = formatDate(endsOn);
    const tomorrow = daysLeft === 1;
    return {
        subject: tomorrow
            ? t('trialReminder.subjectTomorrow')
            : t('trialReminder.subjectDays', { count: daysLeft }),
        blocks: [
            { p: t('common.greeting') },
            {
                p: [
                    tomorrow
                        ? t('trialReminder.endsTomorrow', { date })
                        : t('trialReminder.endsInDays', {
                              count: daysLeft,
                              date,
                          }),
                    readOnlyDays
                        ? t('trialReminder.afterReadOnly', {
                              count: readOnlyDays,
                          })
                        : t('trialReminder.afterFree'),
                ].join(' '),
            },
            { p: t('trialReminder.keep') },
            { button: t('trialReminder.button'), url: subscribeUrl },
        ],
    };
};
