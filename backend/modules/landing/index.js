const { hostSwitch, createLandingRouter } = require('./routes');
const { preloadCatalogs, LOCALES, LOCALE_CODES } = require('./i18n');

module.exports = {
    hostSwitch,
    createLandingRouter,
    preloadCatalogs,
    LOCALES,
    LOCALE_CODES,
};
