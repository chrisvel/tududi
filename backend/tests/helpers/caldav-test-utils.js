const request = require('supertest');

function extendSupertestWithCalDAV(Test) {
    const originalMethods = ['propfind', 'report'];

    originalMethods.forEach(method => {
        if (!Test.prototype[method]) {
            Test.prototype[method] = function(url) {
                const req = this.app || this;
                return request(req)[method] ? request(req)[method](url) : this.get(url).set('X-HTTP-Method-Override', method.toUpperCase());
            };
        }
    });
}

function propfind(app, url) {
    return request(app)
        .request('PROPFIND', url);
}

function report(app, url) {
    return request(app)
        .request('REPORT', url);
}

module.exports = {
    extendSupertestWithCalDAV,
    propfind,
    report
};
