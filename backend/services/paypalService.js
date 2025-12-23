const { paypalSdk } = require('@paypal/paypal-server-sdk');
const crypto = require('crypto');
const { logError } = require('./logService');

// Initialize PayPal client
const getPayPalClient = () => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'live'

    if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials not configured');
    }

    const client = paypalSdk({
        clientCredentialsAuthCredentials: {
            oAuthClientId: clientId,
            oAuthClientSecret: clientSecret,
        },
        environment: environment,
    });

    return client;
};

// Tier pricing configuration
const TIER_PRICING = {
    bronze: { amount: '25.00', currency: 'USD' },
    silver: { amount: '50.00', currency: 'USD' },
    gold: { amount: '100.00', currency: 'USD' },
};

/**
 * Create a PayPal order for a supporter license purchase
 * @param {string} tier - Supporter tier (bronze, silver, gold)
 * @param {string} returnUrl - URL to return to after payment
 * @param {string} cancelUrl - URL to return to if payment is cancelled
 * @returns {Promise<Object>} PayPal order details with approval URL
 */
async function createPayPalOrder(tier, returnUrl, cancelUrl) {
    try {
        const pricing = TIER_PRICING[tier];
        if (!pricing) {
            throw new Error(`Invalid tier: ${tier}`);
        }

        const client = getPayPalClient();

        // Generate a unique license key to attach to the order
        const licenseKey = generateLicenseKey(tier);

        const request = {
            body: {
                intent: 'CAPTURE',
                purchaseUnits: [
                    {
                        amount: {
                            currencyCode: pricing.currency,
                            value: pricing.amount,
                        },
                        description: `Tududi ${tier.charAt(0).toUpperCase() + tier.slice(1)} Supporter License`,
                        customId: licenseKey, // Store license key for later retrieval
                    },
                ],
                applicationContext: {
                    returnUrl: returnUrl,
                    cancelUrl: cancelUrl,
                    brandName: 'Tududi',
                    userAction: 'PAY_NOW',
                },
            },
        };

        const response = await client.orders.ordersCreate(request);

        // Find the approval URL
        const approvalUrl = response.result.links.find(
            (link) => link.rel === 'approve'
        )?.href;

        return {
            orderId: response.result.id,
            approvalUrl: approvalUrl,
            licenseKey: licenseKey,
            tier: tier,
            amount: pricing.amount,
        };
    } catch (error) {
        logError('Error creating PayPal order:', error);
        throw new Error('Failed to create PayPal order');
    }
}

/**
 * Capture a PayPal order after user approval
 * @param {string} orderId - PayPal order ID
 * @returns {Promise<Object>} Capture details with license key
 */
async function capturePayPalOrder(orderId) {
    try {
        const client = getPayPalClient();

        const request = {
            id: orderId,
            body: {},
        };

        const response = await client.orders.ordersCapture(request);

        const captureId =
            response.result.purchaseUnits[0]?.payments?.captures[0]?.id;
        const licenseKey = response.result.purchaseUnits[0]?.customId;
        const amount =
            response.result.purchaseUnits[0]?.payments?.captures[0]?.amount
                ?.value;

        return {
            orderId: response.result.id,
            captureId: captureId,
            status: response.result.status,
            licenseKey: licenseKey,
            amount: parseFloat(amount),
        };
    } catch (error) {
        logError('Error capturing PayPal order:', error);
        throw new Error('Failed to capture PayPal payment');
    }
}

/**
 * Generate a unique license key
 * @param {string} tier - Supporter tier
 * @returns {string} License key in format XXXX-XXXX-XXXX-XXXX
 */
function generateLicenseKey(tier) {
    const prefix = tier.substring(0, 4).toUpperCase();
    const random1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const random2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const random3 = crypto.randomBytes(2).toString('hex').toUpperCase();

    return `${prefix}-${random1}-${random2}-${random3}`;
}

module.exports = {
    createPayPalOrder,
    capturePayPalOrder,
    generateLicenseKey,
    TIER_PRICING,
};
