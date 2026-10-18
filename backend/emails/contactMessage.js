'use strict';

// A message from the contact form on the landing site, sent to the operator.
// Always English: it is read by us, not by the person who wrote it.
module.exports = (_i18n, { name, email, ip, message }) => ({
    subject: `[tududi contact] ${name}`,
    text: `From: ${name} <${email}>\nIP: ${ip}\n\n${message}`,
});
