'use strict';

// Sent by the daily account lifecycle job a week before an unpaid, ended
// trial is deleted. Only where deletion is on (TUDUDI_DELETE_EXPIRED_TRIALS).
module.exports = ({ t, formatDate }, { deleteOn, subscribeUrl, exportUrl }) => {
    const date = formatDate(deleteOn);
    return {
        subject: t('deletionWarning.subject', { date }),
        blocks: [
            { p: t('common.greeting') },
            { p: t('deletionWarning.ended') },
            { p: t('deletionWarning.deleteOn', { date }), strong: true },
            { p: t('deletionWarning.keep') },
            { button: t('deletionWarning.button'), url: subscribeUrl },
            { p: t('deletionWarning.export') },
            { link: exportUrl },
            { p: t('deletionWarning.final', { date }) },
        ],
    };
};
