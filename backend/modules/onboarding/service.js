'use strict';

const { User } = require('../../models');

const onboardingService = {
    // Marks the welcome screen as seen. The first call sets the time; later
    // calls keep it, so a double submit or a page reload cannot move it.
    async complete(user) {
        const row = await User.findByPk(user.id, {
            attributes: ['id', 'onboarded_at'],
        });
        if (!row.onboarded_at) {
            row.onboarded_at = new Date();
            await row.save({ fields: ['onboarded_at'] });
        }
        return { onboarded_at: row.onboarded_at };
    },
};

module.exports = onboardingService;
