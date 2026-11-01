'use strict';

module.exports = {
    // Check-ins used to mark a habit as done (status 2), which hid it from
    // Today, the planner, Upcoming and All tasks for good. Habits are never
    // done, so those rows go back to not started.
    async up(queryInterface) {
        await queryInterface.bulkUpdate(
            'tasks',
            { status: 0 },
            { habit_mode: true, status: 2 }
        );
    },

    async down() {
        // The old status carried no information, nothing to restore.
    },
};
