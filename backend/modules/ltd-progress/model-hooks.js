'use strict';
const { invalidate } = require('./cache');

function install(models) {
    const changed = (_row, options = {}) => {
        invalidate();
        if (options.transaction)
            options.transaction.afterCommit(() => invalidate());
    };
    for (const name of [
        'Task',
        'Project',
        'Goal',
        'DailyPlan',
        'DailyPlanItem',
        'RecurringCompletion',
        'User',
    ]) {
        const model = models[name];
        for (const hook of [
            'afterCreate',
            'afterUpdate',
            'afterDestroy',
            'afterBulkCreate',
        ]) {
            model.addHook(hook, 'ltd-progress', changed);
        }
        for (const hook of ['afterBulkUpdate', 'afterBulkDestroy']) {
            model.addHook(hook, 'ltd-progress', (options) =>
                changed(null, options)
            );
        }
    }
}
module.exports = { install };
