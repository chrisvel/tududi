'use strict';

const express = require('express');
const { handleProtectedResource } = require('./protectedResource');

const router = express.Router();

router.get('/.well-known/oauth-protected-resource', handleProtectedResource);

module.exports = router;
