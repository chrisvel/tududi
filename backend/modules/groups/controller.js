'use strict';

const groupsService = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
}

const groupsController = {
    async listForPicker(req, res, next) {
        try {
            requireUserId(req);
            const groups = await groupsService.listForPicker();
            res.json({ groups });
        } catch (err) {
            next(err);
        }
    },

    async list(req, res, next) {
        try {
            const groups = await groupsService.listForAdmin(requireUserId(req));
            res.json({ groups });
        } catch (err) {
            next(err);
        }
    },

    async getOne(req, res, next) {
        try {
            const detail = await groupsService.getDetail(
                requireUserId(req),
                req.params.uid
            );
            res.json(detail);
        } catch (err) {
            next(err);
        }
    },

    async create(req, res, next) {
        try {
            const group = await groupsService.create(
                requireUserId(req),
                req.body
            );
            res.status(201).json({ group });
        } catch (err) {
            next(err);
        }
    },

    async update(req, res, next) {
        try {
            const group = await groupsService.update(
                requireUserId(req),
                req.params.uid,
                req.body
            );
            res.json({ group });
        } catch (err) {
            next(err);
        }
    },

    async delete(req, res, next) {
        try {
            await groupsService.remove(requireUserId(req), req.params.uid);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    },

    async addMembers(req, res, next) {
        try {
            const result = await groupsService.addMembers(
                requireUserId(req),
                req.params.uid,
                req.body
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    },

    async removeMember(req, res, next) {
        try {
            await groupsService.removeMember(
                requireUserId(req),
                req.params.uid,
                req.params.userId
            );
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    },
};

module.exports = groupsController;
