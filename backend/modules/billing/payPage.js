'use strict';

const { getConfig } = require('../../config/config');
const entitlements = require('../../services/entitlementsService');

// Paddle's default payment link: Paddle sends customers here with
// ?_ptxn=<transaction> for a new subscription (the app redirects here, as
// this page sits on the approved domain), to pay an invoice or to replace a
// failed card, often from an email and signed out. Paddle.js opens its
// checkout for _ptxn by itself; afterwards the customer lands on the
// billing tab, with the transaction id so the app can read the
// subscription at once.
function payPage(req, res) {
    const paddle = getConfig().hosted?.paddle || {};
    if (!entitlements.isHostedMode() || !paddle.clientToken) {
        return res.status(404).send('Not found');
    }
    const billingUrl = `${getConfig().frontendUrl}/profile?section=billing`;
    const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
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
<script>
${sandbox}
var billingUrl = ${json(billingUrl)};
Paddle.Initialize({
    token: ${json(paddle.clientToken)},
    checkout: { settings: { variant: 'one-page' } },
    eventCallback: function (event) {
        if (event.name === 'checkout.completed') {
            var id = event.data && event.data.transaction_id;
            window.location.assign(billingUrl + '&checkout=success' + (id ? '&session_id=' + encodeURIComponent(id) : ''));
        } else if (event.name === 'checkout.closed') {
            window.location.assign(billingUrl + '&checkout=cancel');
        }
    }
});
</script>
</body>
</html>`);
}

// The Supporter license: a voluntary one-time payment from people who
// self-host. Nothing in the software changes, so there is no account to
// attach it to; Paddle collects the email and the page says thank you.
function supporterPage(req, res) {
    const paddle = getConfig().hosted?.paddle || {};
    if (
        !entitlements.isHostedMode() ||
        !paddle.clientToken ||
        !paddle.supporterPriceId
    ) {
        return res.status(404).send('Not found');
    }
    const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
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
<title>tududi Supporter license</title>
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
</head>
<body style="font-family: system-ui, sans-serif; background: #f9fafb; color: #111827; text-align: center; padding: 20vh 16px 0; max-width: 32rem; margin: 0 auto; line-height: 1.5">
<h1 style="font-size: 1.5rem">tududi Supporter license</h1>
<p id="status">EUR 30, one time, for one year. It changes nothing in the software; it is a voluntary thank-you. Supporters get the Supporter role on Discord and a line in the README.</p>
<p><button id="open" type="button" style="font: inherit; padding: 0.6rem 1.4rem; border: 0; border-radius: 0.5rem; background: #2563eb; color: #fff; cursor: pointer">Become a supporter</button></p>
<script>
${sandbox}
var priceId = ${json(paddle.supporterPriceId)};
var button = document.getElementById('open');
function openCheckout() {
    Paddle.Checkout.open({ items: [{ priceId: priceId, quantity: 1 }] });
}
Paddle.Initialize({
    token: ${json(paddle.clientToken)},
    checkout: { settings: { variant: 'one-page' } },
    eventCallback: function (event) {
        if (event.name === 'checkout.completed') {
            button.style.display = 'none';
            document.getElementById('status').textContent =
                'Thank you. Your receipt is on its way by email; send it on Discord or by email to get the Supporter role and your README line.';
        }
    }
});
button.addEventListener('click', openCheckout);
openCheckout();
</script>
</body>
</html>`);
}

module.exports = { payPage, supporterPage };
