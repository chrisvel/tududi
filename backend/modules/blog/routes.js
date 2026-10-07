'use strict';

const express = require('express');
const blogService = require('./service');

const router = express.Router();

// Mounted before the authentication middleware. Unlike a note's public
// link, the blog is meant to be found, so it may be cached and indexed.
const cacheable = (res) =>
    res.set('Cache-Control', 'public, max-age=300, must-revalidate');

router.get('/public/blog', async (req, res, next) => {
    try {
        const index = await blogService.getIndex();
        cacheable(res);
        res.json(index);
    } catch (error) {
        next(error);
    }
});

router.get('/public/blog/posts/:slug', async (req, res, next) => {
    try {
        const post = await blogService.getPost(req.params.slug);
        cacheable(res);
        res.json(post);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
