'use strict';

const express = require('express');
const router = express.Router();
const membersController = require('./controller');
const { requireCapability } = require('../../middleware/roles');
const { createResourceLimiter } = require('../../middleware/rateLimiter');

// Add a member: invite by email, sign up with a password, or add someone who
// cannot sign in yet. Needs the invite permission, which an admin always has.
router.post(
    '/members',
    createResourceLimiter,
    requireCapability('invite_members'),
    membersController.create
);

// Rename a member, give one without an email an address (which invites
// them), or remove one. Whoever created the account, or an admin.
router.patch('/members/:id', createResourceLimiter, membersController.update);
router.delete('/members/:id', createResourceLimiter, membersController.remove);

// A link that signs in a member who has no email. Whoever created the account,
// or an admin, can make one and take it back.
router.post(
    '/members/:id/sign-in-link',
    createResourceLimiter,
    membersController.createSignInLink
);
router.delete(
    '/members/:id/sign-in-link',
    createResourceLimiter,
    membersController.revokeSignInLink
);

module.exports = router;
