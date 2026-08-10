const logger = require('../../../services/logService');
const SyncStateRepository = require('../repositories/sync-state-repository');
const CalendarRepository = require('../repositories/calendar-repository');
const RemoteCalendarRepository = require('../repositories/remote-calendar-repository');
const PushPhase = require('../sync/push-phase');

const pushPhase = new PushPhase();

// A task deleted in Tududi has to be deleted on every CalDAV server it was
// pulled from. Without this the next pull still finds the VTODO, no local task
// matches it, and the merge phase re-creates the row - the task comes back after
// every delete, which is the "ghost task" in #1371.
//
// Must run before the task row is destroyed: the sync state is looked up by
// task id, and the remote DELETE needs the task's uid.
async function deleteTaskFromRemotes(task) {
    const result = { attempted: 0, deleted: 0, errors: [] };

    const syncStates = await SyncStateRepository.findByTaskId(task.id);
    if (syncStates.length === 0) {
        return result;
    }

    for (const syncState of syncStates) {
        const calendar = await CalendarRepository.findById(
            syncState.calendar_id
        );
        const remoteCalendar = calendar
            ? await RemoteCalendarRepository.findByLocalCalendarId(calendar.id)
            : null;

        if (!remoteCalendar || !remoteCalendar.enabled) {
            continue;
        }

        result.attempted++;

        try {
            await pushPhase.deleteTaskFromRemote(
                task,
                remoteCalendar,
                calendar
            );
            result.deleted++;
        } catch (error) {
            // Deleting locally is still the right outcome - the user asked for
            // it - but say plainly that the remote copy survived, because the
            // next pull will bring the task back.
            logger.logError(
                `Failed to delete task ${task.uid} from remote calendar ${remoteCalendar.id}: ${error.message}. The task may reappear on the next sync.`,
                error
            );
            result.errors.push({
                remoteCalendarId: remoteCalendar.id,
                error: error.message,
            });
        }
    }

    // Tasks are destroyed with foreign keys disabled, so the ON DELETE CASCADE
    // never fires and any state left by a failed or skipped remote would be
    // orphaned.
    await SyncStateRepository.deleteByTaskId(task.id);

    return result;
}

module.exports = {
    deleteTaskFromRemotes,
};
