'use strict';

const express = require('express');
const { handleProtectedResource } = require('./protectedResource');
const ltdOauth = require('../ltd-oauth/config');

const router = express.Router();

router.get('/.well-known/oauth-protected-resource', handleProtectedResource);
// LTD-PATCH(T-702): the path-suffixed form for the /api/mcp resource (RFC 9728 §3.1).
router.get('/.well-known/oauth-protected-resource/api/mcp', (req, res, next) =>
    ltdOauth.enabled() ? handleProtectedResource(req, res) : next()
);

module.exports = router;
