const { hostSwitch, createLandingRouter } = require('./routes');
const { appHostRobots } = require('./appHostRobots');
const { preloadCatalogs, LOCALES, LOCALE_CODES } = require('./i18n');

module.exports = {
    hostSwitch,
    appHostRobots,
    createLandingRouter,
    preloadCatalogs,
    LOCALES,
    LOCALE_CODES,
};
