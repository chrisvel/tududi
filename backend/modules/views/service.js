'use strict';

const viewsRepository = require('./repository');
const { validateName } = require('./validation');
const { NotFoundError } = require('../../shared/errors');

class ViewsService {
    async getAll(userId) {
        return viewsRepository.findAllByUser(userId);
    }

    async getPinned(userId) {
        return viewsRepository.findPinnedByUser(userId);
    }

    async getByUid(userId, uid) {
        const view = await viewsRepository.findByUidAndUser(uid, userId);
        if (!view) {
            throw new NotFoundError('View not found');
        }
        return view;
    }

    async create(userId, data) {
        const {
            name,
            search_query,
            filters,
            priority,
            due,
            defer,
            tags,
            extras,
            recurring,
        } = data;

        const validatedName = validateName(name);

        return viewsRepository.createForUser(userId, {
            name: validatedName,
            search_query: search_query || null,
            filters: filters || [],
            priority: priority || null,
            due: due || null,
            defer: defer || null,
            tags: tags || [],
            extras: extras || [],
            recurring: recurring || null,
            is_pinned: false,
        });
    }

    async update(userId, uid, data) {
        const view = await viewsRepository.findByUidAndUser(uid, userId);
        if (!view) {
            throw new NotFoundError('View not found');
        }

        const {
            name,
            search_query,
            filters,
            priority,
            due,
            defer,
            tags,
            extras,
            recurring,
            is_pinned,
        } = data;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (search_query !== undefined) updates.search_query = search_query;
        if (filters !== undefined) updates.filters = filters;
        if (priority !== undefined) updates.priority = priority;
        if (due !== undefined) updates.due = due;
        if (defer !== undefined) updates.defer = defer;
        if (tags !== undefined) updates.tags = tags;
        if (extras !== undefined) updates.extras = extras;
        if (recurring !== undefined) updates.recurring = recurring;
        if (is_pinned !== undefined) updates.is_pinned = is_pinned;

        await viewsRepository.update(view, updates);
        return view;
    }

    async delete(userId, uid) {
        const view = await viewsRepository.findByUidAndUser(uid, userId);
        if (!view) {
            throw new NotFoundError('View not found');
        }
        await viewsRepository.destroy(view);
        return { message: 'View successfully deleted' };
    }
}

module.exports = new ViewsService();
