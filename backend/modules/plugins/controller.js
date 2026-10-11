'use strict';

const AppError = require('../../shared/errors/AppError');
const service = require('./service');
const installer = require('./installer');
const { canManagePlugins } = require('./access');

/**
 * Plugin listing, per-user plugin state, and installing or removing a plugin.
 *
 * Enabling a plugin is presentation state: it changes what this user's browser
 * loads, and is never treated as an authorization decision. Plugin code runs in
 * the page with the user's own session, so installing a plugin is an
 * operator-level trust decision instead - see `access.js` for who counts as an
 * operator - and `canManage` tells the browser whether to offer it.
 */

const isPlainObject = (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const buildPayload = async (req) => {
    const plugins = service.listInstalled();
    const state = service.readState(req.currentUser);

    return {
        pluginApiVersion: service.PLUGIN_API_VERSION,
        hostVersion: service.getHostVersion(),
        pluginsDir: service.getPluginsDir(),
        canManage: await canManagePlugins(req.currentUser),
        ...state,
        plugins: service.describeForClient(plugins, state),
    };
};

const pluginsController = {
    async list(req, res, next) {
        try {
            res.json(await buildPayload(req));
        } catch (error) {
            next(error);
        }
    },

    /**
     * Install a plugin from an uploaded archive, or update one by uploading a
     * newer archive of the same plugin.
     *
     * The response carries the same payload as a listing - the plugin list has
     * changed, and re-sending it saves the browser a second round trip - plus a
     * summary of what happened, so the UI can say which plugin and version it
     * now has rather than just re-rendering.
     */
    async install(req, res, next) {
        try {
            if (!req.file || !req.file.buffer) {
                throw new AppError(
                    'No plugin archive was uploaded.',
                    400,
                    'VALIDATION_ERROR'
                );
            }

            const installed = await installer.installFromBuffer(
                req.file.buffer
            );
            const payload = await buildPayload(req);

            res.status(installed.updated ? 200 : 201).json({
                ...payload,
                install: {
                    id: installed.id,
                    name: installed.name,
                    version: installed.version,
                    updated: installed.updated,
                },
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Remove an installed plugin.
     *
     * A description left behind in some account's settings is harmless: the
     * payload only ever describes plugins the server still has, so an id that
     * no longer exists is simply not reported. Re-installing the same plugin
     * restores that account's choice along with it.
     */
    async remove(req, res, next) {
        try {
            const { id } = req.params;
            const removed = await installer.removePlugin(id);
            const payload = await buildPayload(req);

            res.json({ ...payload, remove: { id: removed.id } });
        } catch (error) {
            next(error);
        }
    },

    async updatePlugin(req, res, next) {
        try {
            const { id } = req.params;
            const plugins = service.listInstalled();
            const plugin = plugins.find((entry) => entry.id === id);

            if (!plugin) {
                throw new AppError(`Unknown plugin: ${id}`, 404, 'NOT_FOUND');
            }

            const body = isPlainObject(req.body) ? req.body : {};
            const patch = {};

            if (body.enabled !== undefined) {
                if (typeof body.enabled !== 'boolean') {
                    throw new AppError(
                        '`enabled` must be a boolean',
                        400,
                        'VALIDATION_ERROR'
                    );
                }
                if (body.enabled && !plugin.ok) {
                    // Enabling something the host cannot load would leave the
                    // user with a plugin that silently never appears.
                    throw new AppError(
                        `Plugin ${id} cannot be enabled: ${plugin.errors.join('; ')}`,
                        400,
                        'VALIDATION_ERROR'
                    );
                }
                patch.enabled = body.enabled;
            }

            if (body.settings !== undefined) {
                if (!isPlainObject(body.settings)) {
                    throw new AppError(
                        '`settings` must be an object',
                        400,
                        'VALIDATION_ERROR'
                    );
                }
            }

            const current = service.readState(req.currentUser);
            const update = {};

            if (patch.enabled !== undefined) {
                const next = new Set(current.enabled);
                if (patch.enabled) next.add(id);
                else next.delete(id);
                update.enabled = Array.from(next);
            }

            if (body.settings !== undefined) {
                update.settings = {
                    ...current.settings,
                    [id]: {
                        ...(isPlainObject(current.settings[id])
                            ? current.settings[id]
                            : {}),
                        ...body.settings,
                    },
                };
            }

            if (Object.keys(update).length > 0) {
                await service.writeState(req.currentUser, update);
            }

            res.json(await buildPayload(req));
        } catch (error) {
            next(error);
        }
    },

    async updateState(req, res, next) {
        try {
            const body = isPlainObject(req.body) ? req.body : {};
            const patch = {};

            if (body.activeTheme !== undefined) {
                if (
                    body.activeTheme !== null &&
                    typeof body.activeTheme !== 'string'
                ) {
                    throw new AppError(
                        '`activeTheme` must be a string or null',
                        400,
                        'VALIDATION_ERROR'
                    );
                }
                patch.activeTheme = body.activeTheme;
            } else {
                throw new AppError(
                    'Nothing to update: pass `activeTheme`',
                    400,
                    'VALIDATION_ERROR'
                );
            }

            await service.writeState(req.currentUser, patch);
            res.json(await buildPayload(req));
        } catch (error) {
            next(error);
        }
    },
};

module.exports = pluginsController;
