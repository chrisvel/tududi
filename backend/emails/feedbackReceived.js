'use strict';

// A message from the in-app feedback form, sent to the instance admins.
// Always English: it is read by us, not by the person who wrote it.
module.exports = (
    _i18n,
    { name, email, pageUrl, appVersion, message, url }
) => ({
    subject: `[tududi feedback] ${name || email}`,
    text: [
        `From: ${name ? `${name} <${email}>` : email}`,
        pageUrl && `Page: ${pageUrl}`,
        appVersion && `Version: ${appVersion}`,
        '',
        message,
        '',
        `All feedback: ${url}`,
    ]
        .filter((line) => typeof line === 'string')
        .join('\n'),
});
