const express = require('express');
const router = express.Router();
const {
    createPayPalOrder,
    capturePayPalOrder,
} = require('../services/paypalService');
const { SupporterLicense } = require('../models');
const { logError } = require('../services/logService');

// POST /api/supporter/paypal/create-order
// Create a PayPal order for supporter license purchase
router.post('/supporter/paypal/create-order', async (req, res) => {
    try {
        const { tier } = req.body;

        if (!tier || !['bronze', 'silver', 'gold'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier specified' });
        }

        // Get frontend URL from config
        const config = require('../config/config').getConfig();
        const frontendUrl = config.frontendUrl;

        const returnUrl = `${frontendUrl}/profile?section=supporter&payment=success`;
        const cancelUrl = `${frontendUrl}/profile?section=supporter&payment=cancelled`;

        const orderDetails = await createPayPalOrder(tier, returnUrl, cancelUrl);

        // Store order temporarily in session or database for verification
        req.session.pendingPayPalOrder = {
            orderId: orderDetails.orderId,
            licenseKey: orderDetails.licenseKey,
            tier: orderDetails.tier,
            amount: orderDetails.amount,
        };

        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            orderId: orderDetails.orderId,
            approvalUrl: orderDetails.approvalUrl,
        });
    } catch (error) {
        logError('Error in create-order:', error);
        res.status(500).json({
            error: error.message || 'Failed to create payment order',
        });
    }
});

// POST /api/supporter/paypal/capture-order
// Capture PayPal order and create supporter license
router.post('/supporter/paypal/capture-order', async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: 'Order ID required' });
        }

        // Verify this order belongs to the session
        const pendingOrder = req.session?.pendingPayPalOrder;
        if (!pendingOrder || pendingOrder.orderId !== orderId) {
            return res.status(400).json({ error: 'Invalid order' });
        }

        // Capture the PayPal payment
        const captureDetails = await capturePayPalOrder(orderId);

        if (captureDetails.status !== 'COMPLETED') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        // Get current user ID
        const userId = req.currentUser?.id || req.session?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Create supporter license in database
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now

        const license = await SupporterLicense.create({
            user_id: userId,
            license_key: captureDetails.licenseKey,
            tier: pendingOrder.tier,
            purchase_amount: captureDetails.amount,
            activated_at: new Date(),
            expires_at: expiresAt,
        });

        // Clear pending order from session
        delete req.session.pendingPayPalOrder;
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            license: {
                tier: license.tier,
                licenseKey: license.license_key,
                expiresAt: license.expires_at,
            },
        });
    } catch (error) {
        logError('Error in capture-order:', error);
        res.status(500).json({
            error: error.message || 'Failed to process payment',
        });
    }
});

module.exports = router;
