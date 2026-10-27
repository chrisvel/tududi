'use strict';

const { getConfig } = require('../../config/config');
const entitlements = require('../../services/entitlementsService');

// Paddle's default payment link: Paddle sends customers here with
// ?_ptxn=<transaction> to pay an invoice or replace a failed card, often
// from an email and signed out. Paddle.js opens its checkout for _ptxn by
// itself; afterwards the customer lands on the billing tab.
function payPage(req, res) {
    const paddle = getConfig().hosted?.paddle || {};
    if (!entitlements.isHostedMode() || !paddle.clientToken) {
        return res.status(404).send('Not found');
    }
    const settings = {
        token: paddle.clientToken,
        checkout: {
            settings: {
                successUrl: `${getConfig().frontendUrl}/profile?section=billing&checkout=success`,
            },
        },
    };
    const sandbox =
        paddle.environment === 'sandbox'
            ? "Paddle.Environment.set('sandbox');"
            : '';
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>tududi payment</title>
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
</head>
<body style="font-family: system-ui, sans-serif; background: #f9fafb; color: #111827; text-align: center; padding-top: 20vh">
<p>Opening the secure checkout&hellip;</p>
<script>${sandbox}Paddle.Initialize(${JSON.stringify(settings).replace(/</g, '\\u003c')});</script>
</body>
</html>`);
}

module.exports = { payPage };
