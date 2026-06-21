'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(
            "UPDATE tags SET pinned = 1 WHERE tag_type = 'system' AND name IN ('someday', 'today')"
        );
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(
            "UPDATE tags SET pinned = 0 WHERE tag_type = 'system' AND name IN ('someday', 'today')"
        );
    },
};
