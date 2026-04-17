const logger = require('../../../services/logService');

class ConflictResolver {
    async resolve(localTask, remoteTask, strategy = 'last_write_wins') {
        logger.logInfo(
            `Resolving conflict for task ${localTask.uid} using strategy: ${strategy}`
        );

        switch (strategy) {
            case 'last_write_wins':
                return this._lastWriteWins(localTask, remoteTask);

            case 'local_wins':
                return this._localWins(localTask);

            case 'remote_wins':
                return this._remoteWins(remoteTask);

            case 'manual':
                return this._manual(localTask, remoteTask);

            default:
                logger.logWarn(
                    `Unknown conflict resolution strategy: ${strategy}, falling back to last_write_wins`
                );
                return this._lastWriteWins(localTask, remoteTask);
        }
    }

    _lastWriteWins(localTask, remoteTask) {
        const localTime = new Date(localTask.updated_at).getTime();
        const remoteTime = remoteTask.updated_at
            ? new Date(remoteTask.updated_at).getTime()
            : new Date(remoteTask.last_modified || Date.now()).getTime();

        if (localTime > remoteTime) {
            logger.logInfo(
                `Local task ${localTask.uid} is newer (${localTask.updated_at} > ${remoteTask.updated_at || remoteTask.last_modified}), keeping local version`
            );
            return {
                strategy: 'last_write_wins',
                winner: 'local',
                taskData: localTask.toJSON(),
            };
        }

        logger.logInfo(
            `Remote task ${localTask.uid} is newer (${remoteTask.updated_at || remoteTask.last_modified} >= ${localTask.updated_at}), keeping remote version`
        );
        return {
            strategy: 'last_write_wins',
            winner: 'remote',
            taskData: {
                ...remoteTask,
                id: localTask.id,
                user_id: localTask.user_id,
            },
        };
    }

    _localWins(localTask) {
        logger.logInfo(
            `Using local version for task ${localTask.uid} (local_wins strategy)`
        );
        return {
            strategy: 'local_wins',
            winner: 'local',
            taskData: localTask.toJSON(),
        };
    }

    _remoteWins(remoteTask) {
        logger.logInfo(`Using remote version for task (remote_wins strategy)`);
        return {
            strategy: 'remote_wins',
            winner: 'remote',
            taskData: remoteTask,
        };
    }

    _manual(localTask, remoteTask) {
        logger.logInfo(
            `Conflict for task ${localTask.uid} requires manual resolution`
        );
        return {
            strategy: 'manual',
            winner: null,
            taskData: null,
            localVersion: localTask.toJSON(),
            remoteVersion: remoteTask,
        };
    }

    compareTaskFields(localTask, remoteTask) {
        const differences = [];
        const fields = [
            'name',
            'note',
            'due_date',
            'defer_until',
            'status',
            'priority',
            'completed_at',
        ];

        for (const field of fields) {
            const localValue = localTask[field];
            const remoteValue = remoteTask[field];

            if (localValue !== remoteValue) {
                differences.push({
                    field,
                    localValue,
                    remoteValue,
                });
            }
        }

        return differences;
    }

    mergeNonConflictingFields(localTask, remoteTask) {
        const merged = { ...localTask.toJSON() };
        const differences = this.compareTaskFields(localTask, remoteTask);

        for (const diff of differences) {
            if (diff.field === 'updated_at' || diff.field === 'created_at') {
                continue;
            }

            if (
                diff.localValue === null ||
                diff.localValue === undefined ||
                diff.localValue === ''
            ) {
                merged[diff.field] = diff.remoteValue;
            }
        }

        return merged;
    }
}

module.exports = new ConflictResolver();
