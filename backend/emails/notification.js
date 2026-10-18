'use strict';

// A task or project notification, for users who turned on email for it. The
// title and message are written by whatever raised the notification, the
// same text the app and Telegram show, so they are passed through as is.
module.exports = (_i18n, { title, message }) => ({
    subject: title,
    text: message,
});
