const request = require('supertest');

function extendSupertestWithCalDAV(Test) {
    const originalMethods = ['propfind', 'report'];

    originalMethods.forEach((method) => {
        if (!Test.prototype[method]) {
            Test.prototype[method] = function (url) {
                const req = this.app || this;
                return request(req)[method]
                    ? request(req)[method](url)
                    : this.get(url).set(
                          'X-HTTP-Method-Override',
                          method.toUpperCase()
                      );
            };
        }
    });
}

function propfind(app, url) {
    const agent = request(app);
    const req = agent.get(url);
    req.method = 'PROPFIND';
    return req;
}

function report(app, url) {
    const agent = request(app);
    const req = agent.get(url);
    req.method = 'REPORT';
    return req;
}

module.exports = {
    extendSupertestWithCalDAV,
    propfind,
    report,
};
