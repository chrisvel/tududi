require('dotenv').config();
const { buildSequelizeOptions } = require('./db');

// Consumed by sequelize-cli (see .sequelizerc). The application itself builds
// its connection in models/index.js from the same buildSequelizeOptions().
module.exports = {
    development: buildSequelizeOptions({ logging: console.log }),
    test: buildSequelizeOptions({ logging: false }),
    production: buildSequelizeOptions({ logging: false }),
};
