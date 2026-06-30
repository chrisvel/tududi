'use strict';

const peopleService = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
}

const peopleController = {
    async list(req, res, next) {
        try {
            const userId = requireUserId(req);
            const { archived, sort, relationship_type } = req.query;
            const people = await peopleService.getAll(userId, {
                archived,
                sort,
                relationship_type,
            });
            res.json({ people });
        } catch (err) {
            next(err);
        }
    },

    async getOne(req, res, next) {
        try {
            const userId = requireUserId(req);
            const person = await peopleService.getByUid(userId, req.params.uid);
            res.json(person);
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            const userId = requireUserId(req);
            const person = await peopleService.create(userId, req.body);
            res.status(201).json({ person });
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            const userId = requireUserId(req);
            const person = await peopleService.update(
                userId,
                req.params.uid,
                req.body
            );
            res.json({ person });
        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            const userId = requireUserId(req);
            await peopleService.delete(userId, req.params.uid);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    },
};

module.exports = peopleController;
