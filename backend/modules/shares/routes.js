'use strict';

const express = require('express');
const router = express.Router();
const sharesController = require('./controller');

router.post('/shares', sharesController.create);
router.delete('/shares', sharesController.delete);
router.get('/shares', sharesController.getAll);

router.get('/shares/invitations', sharesController.listInvitations);
router.post(
    '/shares/invitations/:id/accept',
    sharesController.acceptInvitation
);
router.post(
    '/shares/invitations/:id/decline',
    sharesController.declineInvitation
);

module.exports = router;
