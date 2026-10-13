// Hold a response back until an unread request body has been drained.
//
// Node tears the socket down when a response ends before its request body has
// been read, so the client meets a closed connection and sees ECONNRESET instead
// of the 401. Mounted once, after the body parsers, so any middleware that can
// refuse a request first - auth, a rate limiter, a feature gate, CSRF - still
// delivers its answer. A body the parsers already consumed, or none at all,
// leaves `req.complete` true and the response goes out untouched. The body is
// discarded, not parsed; Node's requestTimeout still bounds a stalled client.

function drainRequestBody(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return next();
    }

    const end = res.end;
    let alreadyWaited = false;

    res.end = function (...args) {
        const self = this;

        if (alreadyWaited || req.readableEnded || req.complete) {
            return end.apply(self, args);
        }

        alreadyWaited = true;

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            end.apply(self, args);
        };

        req.on('end', finish);
        req.on('error', finish);
        // The client gave up, so there is nothing left to deliver.
        req.on('close', finish);
        req.resume();

        return self;
    };

    return next();
}

module.exports = drainRequestBody;
